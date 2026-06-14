import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LocationPicker, type LocationValue } from '@/components/ui/LocationPicker';
import { SelectPicker, type SelectOption } from '@/components/ui/SelectPicker';
import { DatePicker } from '@/components/ui/DatePicker';
import { OnboardingPhotoGrid } from '@/components/onboarding/OnboardingPhotoGrid';
import {
  ALL_COUNTRIES,
  AFRICAN_COUNTRY_CODES,
  resolveCountryFromStored,
} from '@/lib/country-data';
import { FONT, COLORS, MAX_PROFILE_PHOTOS } from '@/constants';
import {
  ONBOARDING_TOTAL_STEPS as TOTAL_STEPS,
  ONBOARDING_STEP_METAS as STEPS,
  ONBOARDING_INTEREST_OPTIONS as INTEREST_OPTIONS,
  ONBOARDING_GENDER_OPTIONS as GENDER_ONBOARD,
  ONBOARDING_LOOKING_FOR_OPTIONS as LOOKING_FOR_OPTS,
} from '@/constants/onboarding-screen-data';
import { Gender, InterestedIn, LookingFor } from '@/types';
import { validateFirstName, getValidationState } from '@/lib/validation';
import { saveOnboardingSkippedHints } from '@/lib/post-onboarding-nudges';
import { appDialog } from '@/lib/app-dialog';
import { track, EVENTS } from '@/lib/analytics';
import {
  type CultureOptionSet,
  getEthnicityOptions,
  getLanguageOptions,
} from '@/lib/cultural-data';
import { logWarn } from '@/lib/logger';
import {
  hasDiscoverBasics,
  hasDiscoverPhoto,
  isProfileCompleteForDiscover,
} from '@/lib/profile-completion';
import { primaryProfilePhotoUrl } from '@/lib/primary-profile-photo-url';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingProgressBar } from '@/components/onboarding/OnboardingProgressBar';
import { AuthLegalConsentRow } from '@/components/auth/AuthLegalConsentRow';

// Keep Dimensions import for downstream layout (step chip layouts) even when not directly used here.

// Step 7 is the celebration screen; steps 1–6 are defined in ONBOARDING_STEP_METAS.

export default function OnboardingScreen() {
  const params = useLocalSearchParams<{ userId: string; email: string; termsAccepted?: string }>();
  const hydrateUserFromServer = useAuthStore((s) => s.hydrateUserFromServer);
  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);

  const [step, setStep] = useState(1);

  // Step 1
  const [fullName, setFullName] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [termsAccepted, setTermsAccepted] = useState(params.termsAccepted === '1');

  // Step 2
  const [photoUris, setPhotoUris] = useState<string[]>([]);

  // Step 3
  const [birthdate, setBirthdate] = useState<Date | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [interestedIn, setInterestedIn] = useState<InterestedIn | null>(null);
  const [ageYears, setAgeYears] = useState<number | null>(null);
  const [step3Errors, setStep3Errors] = useState<Record<string, boolean>>({});

  const handleBirthdateChange = (d: Date | null) => {
    setBirthdate(d);
    setStep3Errors((prev) => ({ ...prev, birthdate: false }));
    if (!d) {
      setAgeYears(null);
      return;
    }
    const years = (Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    setAgeYears(years);
  };

  // Step 4
  const [lookingFor, setLookingFor] = useState<LookingFor[]>([]);
  const toggleLookingFor = (val: LookingFor) =>
    setLookingFor((p) => (p.includes(val) ? p.filter((v) => v !== val) : [...p, val]));

  // Step 5 — location
  const [location, setLocation] = useState<Partial<LocationValue>>({});
  const [originLocation, setOriginLocation] = useState<Partial<LocationValue>>({});

  // Step 6 — ethnicity & languages
  const [ethnicity, setEthnicity] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [cultureEthnicityOptions, setCultureEthnicityOptions] = useState<CultureOptionSet | null>(
    null,
  );
  const [cultureLanguageOptions, setCultureLanguageOptions] = useState<CultureOptionSet | null>(
    null,
  );
  const [cultureOptionsLoading, setCultureOptionsLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const saveInFlightRef = useRef(false);
  const [photoProgress, setPhotoProgress] = useState<{ uploaded: number; total: number } | null>(
    null,
  );
  const [photoPickingProgress, setPhotoPickingProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const pickPhotosInFlightRef = useRef(false);

  const firstNameValidation = validateFirstName(fullName);
  const showTermsConsent = !termsAccepted;

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const meta = data.session?.user.user_metadata as Record<string, unknown> | undefined;
      if (typeof meta?.terms_accepted_at === 'string' && meta.terms_accepted_at.length > 0) {
        setTermsAccepted(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Returning users who skipped photos: land on the photo step with basics prefilled.
  useEffect(() => {
    if (!user || step !== 1 || isAuthLoading) return;
    if (!hasDiscoverBasics(user) || hasDiscoverPhoto(user)) return;
    setFullName(user.full_name ?? '');
    setTermsAccepted(true);
    if (user.birthdate) {
      const d = new Date(user.birthdate);
      setBirthdate(d);
      setAgeYears((Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    }
    if (user.gender) setGender(user.gender);
    if (user.interested_in) setInterestedIn(user.interested_in);
    if (user.looking_for?.length) setLookingFor(user.looking_for);
    if (user.country) {
      const livingResolved = resolveCountryFromStored(user.country);
      setLocation({
        country: user.country,
        countryCode: livingResolved?.code,
        subdivision: user.state ?? undefined,
        city: user.city ?? undefined,
      });
    }
    if (user.origin_country) {
      const originResolved = resolveCountryFromStored(user.origin_country);
      setOriginLocation({
        country: user.origin_country,
        countryCode: originResolved?.code,
        subdivision: user.origin_state ?? undefined,
        city: user.origin_city ?? undefined,
      });
    }
    const existingPhoto = primaryProfilePhotoUrl(user);
    if (existingPhoto) setPhotoUris([existingPhoto]);
    setStep(2);
  }, [user, step, isAuthLoading]);

  // ── Cultural location derivations ──────────────────────────────────────────
  const africanCountryCodes = AFRICAN_COUNTRY_CODES;
  const livingCountry = useMemo(
    () =>
      (location.countryCode ? resolveCountryFromStored(location.countryCode) : undefined) ??
      resolveCountryFromStored(location.country),
    [location.country, location.countryCode],
  );
  const livesInAfrica = livingCountry ? africanCountryCodes.has(livingCountry.code) : false;
  const needsOriginCountry = Boolean(livingCountry) && !livesInAfrica;
  const originMatchesLiving =
    Boolean(originLocation.countryCode) &&
    originLocation.countryCode === (location.countryCode ?? livingCountry?.code);
  const culturalLocation = livesInAfrica
    ? location
    : needsOriginCountry &&
        originLocation.countryCode &&
        africanCountryCodes.has(originLocation.countryCode) &&
        !originMatchesLiving
      ? originLocation
      : null;
  const locationPathComplete = Boolean(
    culturalLocation?.country && culturalLocation?.subdivision && culturalLocation?.city,
  );
  /** Step 6 when cultural data is available, or diaspora users can still add roots manually. */
  const showRootsStep = livesInAfrica ? locationPathComplete : Boolean(livingCountry);
  const progressDenominator =
    step <= 4 ? TOTAL_STEPS : step === 5 && !showRootsStep ? 5 : TOTAL_STEPS;

  useEffect(() => {
    if (step !== 6 || locationPathComplete || needsOriginCountry) return;
    const t = setTimeout(() => setStep(5), 0);
    return () => clearTimeout(t);
  }, [step, locationPathComplete, needsOriginCountry]);

  const suggestedLanguages = cultureLanguageOptions?.suggested ?? [];
  const allLanguages = cultureLanguageOptions?.all ?? [];

  const originCountryOptions: SelectOption[] = useMemo(
    () =>
      ALL_COUNTRIES.map((c) => ({
        value: c.code,
        label: c.name,
      })),
    [],
  );

  // Load ethnicity & language options whenever location path is complete
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!locationPathComplete || !culturalLocation?.countryCode) {
        setCultureEthnicityOptions(null);
        setCultureLanguageOptions(null);
        setCultureOptionsLoading(false);
        return;
      }
      setCultureOptionsLoading(true);
      try {
        const [ethOpts, langOpts] = await Promise.all([
          getEthnicityOptions(
            culturalLocation.countryCode,
            culturalLocation.subdivision,
            culturalLocation.city,
          ),
          getLanguageOptions(
            culturalLocation.countryCode,
            ethnicity || null,
            culturalLocation.subdivision,
            culturalLocation.city,
          ),
        ]);
        if (cancelled) return;
        setCultureEthnicityOptions(ethOpts);
        setCultureLanguageOptions(langOpts);
      } catch (e) {
        console.error('Culture options load failed', e);
        if (!cancelled) {
          setCultureEthnicityOptions(null);
          setCultureLanguageOptions(null);
        }
      } finally {
        if (!cancelled) setCultureOptionsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [
    culturalLocation?.countryCode,
    culturalLocation?.subdivision,
    culturalLocation?.city,
    ethnicity,
    locationPathComplete,
  ]);

  // Age is derived when DOB changes (avoid setState-in-effect lint).

  const handleLivingLocationChange = (value: Partial<LocationValue>) => {
    setLocation((cur) => {
      if (value.countryCode && value.countryCode !== cur.countryCode) {
        setOriginLocation({});
        setEthnicity('');
        setLanguages([]);
      } else if (value.subdivision !== undefined || value.city !== undefined) {
        setEthnicity('');
        setLanguages([]);
      }
      return { ...cur, ...value };
    });
  };

  const handleOriginLocationChange = (value: Partial<LocationValue>) => {
    setOriginLocation((cur) => {
      if (value.countryCode && value.countryCode !== cur.countryCode) {
        setEthnicity('');
        setLanguages([]);
      } else if (value.subdivision !== undefined || value.city !== undefined) {
        setEthnicity('');
        setLanguages([]);
      }
      return { ...cur, ...value };
    });
  };

  const toggleLanguage = (lang: string) =>
    setLanguages((cur) => (cur.includes(lang) ? cur.filter((l) => l !== lang) : [...cur, lang]));

  // Pre-fill living location from IP when user reaches location step (country + best-effort region/city).
  useEffect(() => {
    if (step !== 5) return;
    if (location.country || location.countryCode) return;
    let cancelled = false;
    (async () => {
      try {
        const { detectLocationFromIp } = await import('@/lib/geo-country');
        const detected = await detectLocationFromIp();
        if (cancelled || !detected) return;
        setLocation((cur) => {
          if (cur.country || cur.countryCode) return cur;
          return {
            ...cur,
            country: detected.country,
            countryCode: detected.countryCode,
            subdivision: detected.subdivision,
            city: detected.city,
          };
        });
      } catch (e) {
        logWarn('[onboarding] IP location prefill failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, location.country, location.countryCode]);

  const pickPhotos = async () => {
    if (pickPhotosInFlightRef.current) return;
    try {
      const remaining = MAX_PROFILE_PHOTOS - photoUris.length;
      if (remaining <= 0) return;
      const ImagePicker = await import('expo-image-picker');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });
      if (result.canceled) return;
      const newUris = result.assets.map((a) => a.uri).slice(0, remaining);
      if (newUris.length === 0) return;

      if (!params.userId) {
        appDialog({
          title: 'Session error',
          message: 'Please go back and try again.',
          icon: 'alert-circle-outline',
        });
        return;
      }

      pickPhotosInFlightRef.current = true;

      const { validateFacesInPhotos, faceRejectionMessage } = await import('@/lib/face-detection');
      const { uploadToAvatarsBucket } = await import('@/lib/storage-image-upload');
      setPhotoPickingProgress({ current: 0, total: newUris.length });
      const { approved: approvedLocalUris, rejected } = await validateFacesInPhotos(newUris);
      const rejectedCount = rejected.length;
      setPhotoPickingProgress(null);

      if (approvedLocalUris.length === 0) {
        appDialog({
          title: 'No faces detected',
          message:
            'None of the selected photos clearly show a face. Please choose photos where your face is visible and well-lit.',
          icon: 'happy-outline',
        });
        return;
      }

      setPhotoProgress({ uploaded: 0, total: approvedLocalUris.length });
      let uploadedCount = 0;
      for (let i = 0; i < approvedLocalUris.length; i++) {
        const out = await uploadToAvatarsBucket(params.userId, approvedLocalUris[i]);
        if (!('error' in out)) {
          uploadedCount += 1;
          setPhotoUris((prev) =>
            prev.length >= MAX_PROFILE_PHOTOS
              ? prev
              : [...prev, out.publicUrl].slice(0, MAX_PROFILE_PHOTOS),
          );
        }
        setPhotoProgress({ uploaded: i + 1, total: approvedLocalUris.length });
      }
      setPhotoProgress(null);

      if (uploadedCount === 0) {
        appDialog({
          title: 'Photo upload failed',
          message: 'We could not upload your photos. Check your connection and try again.',
          icon: 'cloud-offline-outline',
        });
        return;
      }
      if (rejectedCount > 0) {
        const { title, message } = faceRejectionMessage(rejectedCount, uploadedCount);
        appDialog({ title, message, icon: 'happy-outline' });
      }
    } catch (e) {
      console.error('Image picker failed', e);
      appDialog({
        title: 'Photos',
        message: 'We could not open your photo library. Check permissions and try again.',
        icon: 'images-outline',
      });
    } finally {
      pickPhotosInFlightRef.current = false;
      setPhotoPickingProgress(null);
      setPhotoProgress(null);
    }
  };

  const handleSaveProfile = async (skipCultureFields: boolean) => {
    if (saveInFlightRef.current) return;
    if (!params.userId || !params.email) {
      appDialog({
        title: 'Session error',
        message: 'Please go back and try again.',
        icon: 'alert-circle-outline',
      });
      return;
    }
    if (!firstNameValidation.valid) {
      setStep(1);
      return;
    }
    if (!termsAccepted) {
      setStep(1);
      appDialog({
        title: 'Please accept the Terms',
        message:
          'Agree to the Terms of Service and Privacy Policy to finish creating your profile.',
        icon: 'document-text-outline',
      });
      return;
    }
    if (!birthdate || !gender || !interestedIn) {
      setStep(3);
      setStep3Errors({
        birthdate: !birthdate,
        gender: !gender,
        interestedIn: !interestedIn,
      });
      return;
    }
    const ageMs = Date.now() - birthdate.getTime();
    const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
    if (!Number.isFinite(ageYears) || ageYears < 18) {
      setStep(3);
      appDialog({
        title: 'You must be 18 or older',
        message: 'Africana is only for adults. Please update your date of birth to continue.',
        icon: 'alert-circle-outline',
      });
      return;
    }
    if (ageYears > 120) {
      setStep(3);
      appDialog({
        title: 'Check your date of birth',
        message: 'That date looks off — please double-check it.',
        icon: 'calendar-outline',
      });
      return;
    }
    if (!location.country) {
      setStep(5);
      appDialog({
        title: 'Missing location',
        message: 'Please select your country.',
        icon: 'location-outline',
      });
      return;
    }
    if (lookingFor.length === 0) {
      setStep(4);
      appDialog({
        title: 'Almost there',
        message: 'Please choose at least one option for what you’re looking for.',
        icon: 'heart-outline',
      });
      return;
    }

    saveInFlightRef.current = true;
    setLoading(true);
    try {
      let {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        const { data } = await supabase.auth.refreshSession();
        session = data.session;
      }
      if (!session) {
        appDialog({
          title: 'Session expired',
          message: 'Please log in again to complete your profile.',
        });
        router.replace('/(auth)/login');
        return;
      }

      const meta = session.user.user_metadata as Record<string, unknown> | undefined;
      const termsAcceptedAt =
        typeof meta?.terms_accepted_at === 'string' && meta.terms_accepted_at.length > 0
          ? meta.terms_accepted_at
          : new Date().toISOString();

      const uploadedUrls = photoUris.filter((uri) => uri.startsWith('http'));
      const avatarUrl = uploadedUrls[0] ?? null;
      if (uploadedUrls.length === 0) {
        setStep(2);
        appDialog({
          title: 'Add a profile photo',
          message:
            'A photo is required before you can appear in Discover or browse other members.',
          icon: 'camera-outline',
        });
        return;
      }

      const savedEthnicity = skipCultureFields ? null : ethnicity.trim() || null;
      const savedLanguages = skipCultureFields ? [] : languages;

      const { error } = await supabase.from('profiles').upsert(
        {
          id: params.userId,
          // NOTE: do NOT include `email` here. `public.profiles` has no `email`
          // column — email lives in `auth.users.email` and is enriched onto
          // the User object client-side via the session in `fetchProfile`.
          // PostgREST will reject the whole upsert with "Could not find the
          // 'email' column" if this is sent.
          full_name: fullName.trim(),
          username: params.email,
          birthdate: birthdate.toISOString().split('T')[0],
          gender,
          interested_in: interestedIn,
          looking_for: lookingFor,
          country: location.country || '',
          state: location.subdivision || null,
          city: location.city || null,
          origin_country: originLocation.country?.trim() || null,
          origin_state: originLocation.subdivision?.trim() || null,
          origin_city: originLocation.city?.trim() || null,
          ethnicity: savedEthnicity,
          languages: savedLanguages,
          avatar_url: avatarUrl,
          profile_photos: uploadedUrls,
          terms_accepted_at: termsAcceptedAt,
        },
        { onConflict: 'id' },
      );

      if (error) {
        if (error.message.includes('security policy') || error.code === '42501') {
          appDialog({
            title: 'Please sign in again',
            message: 'Your session is no longer active. Sign in again, then finish your profile.',
            icon: 'log-in-outline',
          });
        } else {
          appDialog({
            title: 'Something went wrong',
            message: error.message,
            icon: 'alert-circle-outline',
          });
        }
        return;
      }

      await saveOnboardingSkippedHints({
        bio: true,
        photo: uploadedUrls.length === 0,
        goals: false,
        work: true,
        moreDetails: skipCultureFields || !(savedEthnicity || savedLanguages.length > 0),
      });

      setStep(7); // celebration — before hydrate so complete-profile guard doesn't skip it
      await hydrateUserFromServer(params.userId);
      track(EVENTS.AUTH_SIGNUP_COMPLETE);
    } catch (e) {
      console.error('Onboarding save failed', e);
      appDialog({
        title: 'Something went wrong',
        message: e instanceof Error ? e.message : 'Please try again in a moment.',
        icon: 'alert-circle-outline',
      });
    } finally {
      saveInFlightRef.current = false;
      setLoading(false);
    }
  };

  const [now] = useState(Date.now);
  const birthdateAgeYears = useMemo(() => {
    return birthdate
      ? (now - birthdate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      : null;
  }, [birthdate]);

  const canProceed = () => {
    if (step === 1) return firstNameValidation.valid && termsAccepted;
    if (step === 2) return photoUris.length > 0 && !photoPickingProgress && !photoProgress;
    if (step === 3) {
      if (!birthdate || !gender || !interestedIn) return false;
      const years = birthdateAgeYears ?? ageYears ?? 0;
      return years >= 18 && years <= 120;
    }
    if (step === 4) return lookingFor.length > 0;
    if (step === 5) {
      if (livesInAfrica) return locationPathComplete;
      return !!location.country;
    }
    return true; // steps 6 & 7 always ok
  };

  const goNext = async () => {
    if (step === 6) {
      await handleSaveProfile(false);
      return;
    }
    if (step === 7) {
      router.replace('/(tabs)/discover');
      return;
    }
    if (step === 5 && !showRootsStep) {
      await handleSaveProfile(true);
      return;
    }
    setStep(step + 1);
  };

  // Redirect already-complete users unless they're on the celebration screen (step 7).
  useEffect(() => {
    if (step === 7) return;
    if (!isAuthLoading && isProfileCompleteForDiscover(user)) {
      router.replace('/(tabs)/discover');
    }
  }, [isAuthLoading, user, step]);

  // Step 1 only needs route params — don't block the name field on profile hydration.
  if (isAuthLoading && step !== 1) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (step !== 7 && isProfileCompleteForDiscover(user)) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  // ─── Celebration screen (step 7) ─────────────────────────────────────────
  if (step === 7) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
        <View style={s.celebContainer}>
          <Text style={{ fontSize: 72, marginBottom: 24 }}>🎉</Text>
          <Text style={s.celebTitle}>Welcome to Africana!</Text>
          <Text style={s.celebSub}>
            Your profile is live. Start exploring members near you, and enrich your profile anytime
            from the Me tab.
          </Text>
        </View>
        <View style={s.celebFooter}>
          <Button
            title="Start Exploring →"
            onPress={() => router.replace('/(tabs)/discover')}
            fullWidth
            size="lg"
          />
        </View>
      </SafeAreaView>
    );
  }

  // ─── Data-collection steps 1–6 ───────────────────────────────────────────
  const cur = STEPS[step - 1];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* ── Header ── */}
        <OnboardingHeader
          step={step}
          total={progressDenominator}
          canGoBack={step > 1}
          onBack={() => setStep(step - 1)}
        />

        {/* ── Animated progress bar ── */}
        <OnboardingProgressBar step={step} denominator={progressDenominator} />

        <ScrollView
          contentContainerStyle={{ padding: 24, paddingTop: 16, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text
            style={[
              s.stepTitle,
              step <= 5 ? s.stepTitleTightTop : null,
              step >= 3 && step <= 6 ? s.stepTitleSolo : null,
            ]}
          >
            {cur.title}
          </Text>
          {(step === 1 || step === 2) && <Text style={s.stepSub}>{cur.subtitle}</Text>}

          {/* ════ STEP 1 — Name ════ */}
          {step === 1 && (
            <>
              <Input
                value={fullName}
                onChangeText={(v) => {
                  setFullName(v);
                  if (!touched.fullName) setTouched((t) => ({ ...t, fullName: true }));
                }}
                onBlur={() => setTouched((t) => ({ ...t, fullName: true }))}
                placeholder="e.g. Amara"
                autoCapitalize="words"
                validationState={getValidationState(
                  Boolean(touched.fullName),
                  firstNameValidation,
                  Boolean(fullName.trim()),
                )}
                error={touched.fullName ? firstNameValidation.message : undefined}
                autoFocus
              />
              {showTermsConsent && (
                <AuthLegalConsentRow
                  checked={termsAccepted}
                  onToggle={() => setTermsAccepted((v) => !v)}
                  style={{ marginTop: 12 }}
                />
              )}
            </>
          )}

          {/* ════ STEP 2 — Photos ════ */}
          {step === 2 && (
            <View>
              <OnboardingPhotoGrid
                photoUris={photoUris}
                onAdd={() => {
                  if (photoPickingProgress) return;
                  void pickPhotos().catch((e: unknown) => {
                    const msg = e instanceof Error ? e.message : '';
                    if (msg !== 'User cancelled' && !msg.includes('cancel')) {
                      appDialog({
                        title: 'Could not add photo',
                        message: 'Please try again or pick a different photo.',
                        icon: 'image-outline',
                      });
                    }
                  });
                }}
                onRemoveAt={(i) => setPhotoUris((p) => p.filter((_, idx) => idx !== i))}
              />
              {photoPickingProgress && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    marginTop: 12,
                  }}
                >
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={{ fontSize: 13, color: COLORS.textSecondary }}>
                    Checking photo {photoPickingProgress.current} of {photoPickingProgress.total}…
                  </Text>
                </View>
              )}
              {photoProgress && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    marginTop: 12,
                  }}
                >
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={{ fontSize: 13, color: COLORS.textSecondary }}>
                    Uploading photo {photoProgress.uploaded} of {photoProgress.total}…
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ════ STEP 3 — Birthday · Gender · Interested In ════ */}
          {step === 3 && (
            <View>
              <DatePicker
                  label="Date of Birth"
                  value={birthdate}
                  onChange={handleBirthdateChange}
                  placeholder="Tap to select"
              />
              {step3Errors.birthdate && (
                <Text style={s.fieldError}>Please select your date of birth</Text>
              )}

              <Text style={s.label}>I am a</Text>
              <View style={s.rowEqual}>
                {GENDER_ONBOARD.map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => {
                      setGender(opt.value);
                      setStep3Errors((prev) => ({ ...prev, gender: false }));
                    }}
                    style={[s.bigChip, gender === opt.value && s.chipOn]}
                  >
                    <Text style={{ fontSize: 26, marginBottom: 6 }}>{opt.emoji}</Text>
                    <Text style={[s.chipTxt, gender === opt.value && s.chipTxtOn]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {step3Errors.gender && <Text style={s.fieldError}>Please select your gender</Text>}

              <Text style={[s.label, { marginTop: 20 }]}>Interested in</Text>
              <View style={s.rowEqual}>
                {INTEREST_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => {
                      setInterestedIn(opt.value);
                      setStep3Errors((prev) => ({ ...prev, interestedIn: false }));
                    }}
                    style={[s.bigChip, interestedIn === opt.value && s.chipOn]}
                  >
                    <Text style={{ fontSize: 26, marginBottom: 6 }}>{opt.emoji}</Text>
                    <Text style={[s.chipTxt, interestedIn === opt.value && s.chipTxtOn]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {step3Errors.interestedIn && (
                <Text style={s.fieldError}>Please select who you&apos;re interested in</Text>
              )}
            </View>
          )}

          {/* ════ STEP 4 — What are you looking for? ════ */}
          {step === 4 && (
            <View style={{ gap: 10 }}>
              {LOOKING_FOR_OPTS.map((opt) => {
                const on = lookingFor.includes(opt.value as LookingFor);
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => toggleLookingFor(opt.value as LookingFor)}
                    style={[s.card, on && s.cardOn]}
                  >
                    <Text style={{ fontSize: 28 }}>{opt.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.cardLabel, on && { color: COLORS.success }]}>
                        {opt.label}
                      </Text>
                    </View>
                    <View style={[s.checkCircle, on && s.checkCircleOn]}>
                      {on && <Ionicons name="checkmark" size={14} color="#FFF" />}
                    </View>
                  </Pressable>
                );
              })}
              <Text style={s.hint}>
                You can pick more than one — choose at least one to continue.
              </Text>
            </View>
          )}

          {/* ════ STEP 5 — Location ════ */}
          {step === 5 && (
            <View>
              <LocationPicker value={location} onChange={handleLivingLocationChange} />

              {needsOriginCountry && (
                <>
                  <Text style={[s.hint, { marginBottom: 10, lineHeight: 18 }]}>
                    Add an African origin to unlock ethnicity and language options for your
                    heritage.
                  </Text>
                  <SelectPicker
                    label="Origin country"
                    placeholder="Select origin country..."
                    options={originCountryOptions}
                    value={originLocation.countryCode ?? null}
                    onChange={(code) => {
                      const found = ALL_COUNTRIES.find((c) => c.code === code);
                      setOriginLocation(
                        found
                          ? {
                              country: found.name,
                              countryCode: found.code,
                              subdivision: '',
                              city: '',
                            }
                          : {},
                      );
                      setEthnicity('');
                      setLanguages([]);
                    }}
                    clearable
                  />
                </>
              )}

              {originLocation.countryCode &&
                africanCountryCodes.has(originLocation.countryCode) &&
                !originMatchesLiving && (
                  <LocationPicker
                    value={originLocation}
                    onChange={handleOriginLocationChange}
                    showCountryField={false}
                  />
                )}
            </View>
          )}

          {/* ════ STEP 6 — Ethnicity & Languages ════ */}
          {step === 6 && (
            <View>
              {cultureOptionsLoading && (
                <ActivityIndicator color={COLORS.success} style={{ marginBottom: 20 }} />
              )}

              {/* Ethnicity */}
              {locationPathComplete && culturalLocation?.country && cultureEthnicityOptions ? (
                <>
                  <SelectPicker
                    label="Ethnicity"
                    placeholder="Select your ethnicity"
                    options={cultureEthnicityOptions.all.map((o) => ({ value: o, label: o }))}
                    value={ethnicity || null}
                    onChange={(v) => setEthnicity(v ?? '')}
                    clearable
                  />
                  {cultureEthnicityOptions.suggested.length > 0 ? (
                    <View style={{ marginTop: 16 }}>
                      <Text style={s.label}>
                        Common in {culturalLocation.subdivision || culturalLocation.city || culturalLocation.country}
                      </Text>
                      <View style={s.row}>
                        {cultureEthnicityOptions.suggested.map((opt) => {
                          const on = ethnicity === opt;
                          return (
                            <Pressable
                              key={opt}
                              onPress={() => setEthnicity(on ? '' : opt)}
                              style={[s.chip, on && s.chipOn]}
                            >
                              <Text style={[s.chipTxt, on && s.chipTxtOn]}>{opt}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}
                </>
              ) : (locationPathComplete || needsOriginCountry) && !cultureOptionsLoading ? (
                <Input
                  label="Ethnicity"
                  value={ethnicity}
                  onChangeText={setEthnicity}
                  placeholder="Enter your ethnicity"
                  leftIcon="people-outline"
                />
              ) : null}

              {/* Languages */}
              {locationPathComplete && cultureLanguageOptions ? (
                <>
                  <SelectPicker
                    label="Languages you speak"
                    placeholder="Select languages you speak"
                    options={allLanguages.map((o) => ({ value: o, label: o }))}
                    values={languages}
                    onChange={setLanguages}
                    multiple
                    clearable
                  />
                  {suggestedLanguages.length > 0 ? (
                    <View style={{ marginTop: 16 }}>
                      <Text style={s.label}>
                        Common in{' '}
                        {culturalLocation?.subdivision ||
                          culturalLocation?.city ||
                          culturalLocation?.country}
                      </Text>
                      <View style={s.row}>
                        {suggestedLanguages.map((opt) => {
                          const on = languages.includes(opt);
                          return (
                            <Pressable
                              key={opt}
                              onPress={() => toggleLanguage(opt)}
                              style={[s.chip, on && s.chipOn]}
                            >
                              <Text style={[s.chipTxt, on && s.chipTxtOn]}>{opt}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}
                </>
              ) : (locationPathComplete || needsOriginCountry) && !cultureOptionsLoading ? (
                <Input
                  label="Languages spoken"
                  value={languages.join(', ')}
                  onChangeText={(v) =>
                    setLanguages(
                      v
                        .split(',')
                        .map((l) => l.trim())
                        .filter(Boolean),
                    )
                  }
                  placeholder="e.g. Amharic, English"
                  leftIcon="chatbubbles-outline"
                />
              ) : null}

              {!locationPathComplete && needsOriginCountry && (
                <Text style={[s.hint, { textAlign: 'center', marginTop: 8 }]}>
                  Set an African origin on the previous step for local suggestions, or enter your
                  roots manually above.
                </Text>
              )}
              {!locationPathComplete && !needsOriginCountry && (
                <Text style={[s.hint, { textAlign: 'center', marginTop: 8 }]}>
                  Complete your country, region, and city in the previous step to see local options.
                </Text>
              )}
            </View>
          )}

          {/* ── Buttons ── */}
          <View style={{ marginTop: 32, gap: 10 }}>
            <Button
              title={step === 6 ? 'Finish Setup 🎉' : 'Continue →'}
              onPress={() => void goNext().catch((e) => console.error('goNext', e))}
              fullWidth
              size="lg"
              variant="primary"
              loading={loading}
              disabled={!canProceed()}
              style={s.ctaPrimary}
            />
            {step === 6 && (
              <Button
                title="Skip for now"
                variant="ghost"
                onPress={() =>
                  void handleSaveProfile(true).catch((e) =>
                    console.error('handleSaveProfile skip', e),
                  )
                }
                fullWidth
                disabled={loading}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  stepTitle: {
    fontSize: 24,
    fontWeight: FONT.extrabold,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  /** When hero emoji is hidden (steps 1–2), pull title up slightly. */
  stepTitleTightTop: { marginTop: 4 },
  /** Selection steps (3–6) omit `stepSub`; extra space below title. */
  stepTitleSolo: { marginBottom: 20 },
  stepSub: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },

  label: { fontSize: 14, fontWeight: FONT.bold, color: COLORS.text, marginBottom: 10 },
  fieldError: {
    fontSize: 12,
    fontWeight: FONT.semibold,
    color: COLORS.error,
    marginTop: 4,
    marginBottom: 8,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  rowEqual: { flexDirection: 'row', flexWrap: 'nowrap', gap: 10 },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  bigChip: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
  },
  ctaPrimary: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 5,
  },
  chipOn: { borderColor: COLORS.success, backgroundColor: COLORS.successSurface },
  chipTxt: { fontSize: 14, color: COLORS.textSecondary, fontWeight: FONT.medium },
  chipTxtOn: { color: COLORS.success, fontWeight: FONT.bold },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    gap: 14,
  },
  cardOn: { borderColor: COLORS.success, backgroundColor: COLORS.successSurface },
  cardLabel: { fontSize: 16, fontWeight: FONT.bold, color: COLORS.text },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleOn: { borderColor: COLORS.success, backgroundColor: COLORS.success },

  hint: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },

  celebContainer: { flex: 1, padding: 28, justifyContent: 'center', alignItems: 'center' },
  celebTitle: {
    fontSize: 32,
    fontWeight: FONT.extrabold,
    color: COLORS.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  celebSub: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  celebFooter: { paddingHorizontal: 28, paddingBottom: 32 },
});
