import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Animated,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { uploadToAvatarsBucket } from '@/lib/storage-image-upload';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { LocationPicker, LocationValue } from '@/components/ui/LocationPicker';
import { SelectOption, SelectPicker } from '@/components/ui/SelectPicker';
import { COLORS, MAX_PROFILE_PHOTOS } from '@/constants';
import { Gender, InterestedIn, LookingFor } from '@/types';
import { validateFirstName, getValidationState } from '@/lib/validation';
import { saveOnboardingSkippedHints } from '@/lib/post-onboarding-nudges';
import { appDialog } from '@/lib/app-dialog';
import { track, EVENTS } from '@/lib/analytics';
import { ALL_COUNTRIES, AFRICAN_COUNTRY_CODES } from '@/lib/country-data';
import { CultureOptionSet, getEthnicityOptions, getLanguageOptions } from '@/lib/cultural-data';
import { detectCountryFromIp } from '@/lib/geo-country';
import { validateFacesInPhotos, faceRejectionMessage } from '@/lib/face-detection';

const { width } = Dimensions.get('window');

// 6 data-collection steps; step 7 is the celebration screen
const TOTAL_STEPS = 6;

const STEPS = [
  { emoji: '👤', title: "What's your name?",          subtitle: "This is how you'll appear to others on Africana.", bg: '#FFF3E0' },
  { emoji: '📸', title: 'Add your photo',             subtitle: 'Profiles with a photo get 6× more matches.',       bg: '#FFF8E1' },
  { emoji: '🎂', title: 'A bit about you',            subtitle: 'A few basics to help us find the right people.',   bg: '#E8F5E9' },
  { emoji: '💞', title: 'What are you looking for?',  subtitle: "Be honest — the right match is out there.",        bg: '#FCE4EC' },
  { emoji: '📍', title: 'Where do you live?',         subtitle: 'Your location helps people near you find you.',    bg: '#E0F7FA' },
  { emoji: '🌍', title: 'Your roots',                 subtitle: 'Ethnicity and languages help us find your people.', bg: '#E8F5E9' },
];

const INTEREST_OPTIONS: { value: InterestedIn; label: string; emoji: string }[] = [
  { value: 'women', label: 'Women', emoji: '👩' },
  { value: 'men', label: 'Men', emoji: '👨' },
];

const GENDER_ONBOARD = [
  { value: 'male' as const, label: 'Male', emoji: '👨' },
  { value: 'female' as const, label: 'Female', emoji: '👩' },
];

const LOOKING_FOR_OPTS = [
  { value: 'relationship', emoji: '💑', label: 'Relationship', desc: 'A deep, meaningful connection' },
  { value: 'marriage',     emoji: '💍', label: 'Marriage',     desc: 'Serious, long-term commitment' },
  { value: 'friendship',   emoji: '🤝', label: 'Friendship',   desc: 'Friends first, see what happens' },
  { value: 'pen_pal',      emoji: '✉️', label: 'Pen Pal',      desc: 'Chat, share stories, connect' },
];

function MultiChipSelect({
  label, options, values, onToggle,
}: {
  label: string;
  options: string[];
  values: string[];
  onToggle: (v: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={s.label}>{label}</Text>
      <View style={s.row}>
        {options.map((opt) => {
          const on = values.includes(opt);
          return (
            <Pressable key={opt} onPress={() => onToggle(opt)} style={[s.chip, on && s.chipOn]}>
              <Text style={[s.chipTxt, on && s.chipTxtOn]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
  const params = useLocalSearchParams<{ userId: string; email: string }>();
  const { fetchProfile, fetchSettings } = useAuthStore();

  const [step, setStep] = useState(1);
  const progressAnim = useRef(new Animated.Value((1 / TOTAL_STEPS) * 100)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (Math.min(step, TOTAL_STEPS) / TOTAL_STEPS) * 100,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [step]);

  // Step 1
  const [fullName, setFullName] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  // Legal consent — captured on step 1 so both email and OAuth paths record it.
  // Gated by `canProceed` and persisted as `profiles.terms_accepted_at` on save.
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Step 2
  const [photoUris, setPhotoUris] = useState<string[]>([]);

  // Step 3
  const [birthdate, setBirthdate]       = useState<Date | null>(null);
  const [gender, setGender]             = useState<Gender | null>(null);
  const [interestedIn, setInterestedIn] = useState<InterestedIn | null>(null);

  // Step 4
  const [lookingFor, setLookingFor] = useState<LookingFor[]>([]);
  const toggleLookingFor = (val: LookingFor) =>
    setLookingFor((p) => p.includes(val) ? p.filter((v) => v !== val) : [...p, val]);

  // Step 5 — location
  const [location, setLocation]             = useState<Partial<LocationValue>>({});
  const [originLocation, setOriginLocation] = useState<Partial<LocationValue>>({});

  // Step 6 — ethnicity & languages
  const [ethnicity, setEthnicity]   = useState('');
  const [languages, setLanguages]   = useState<string[]>([]);
  const [cultureEthnicityOptions, setCultureEthnicityOptions] = useState<CultureOptionSet | null>(null);
  const [cultureLanguageOptions, setCultureLanguageOptions]   = useState<CultureOptionSet | null>(null);
  const [cultureOptionsLoading, setCultureOptionsLoading]     = useState(false);

  const [loading, setLoading] = useState(false);
  const saveInFlightRef = useRef(false);

  const firstNameValidation = validateFirstName(fullName);

  // ── Cultural location derivations ──────────────────────────────────────────
  const livesInAfrica = location.countryCode ? AFRICAN_COUNTRY_CODES.has(location.countryCode) : false;
  const needsOriginCountry = Boolean(location.countryCode) && !livesInAfrica;
  const originMatchesLiving = Boolean(originLocation.countryCode) && originLocation.countryCode === location.countryCode;
  const culturalLocation = livesInAfrica
    ? location
    : (needsOriginCountry && originLocation.countryCode && AFRICAN_COUNTRY_CODES.has(originLocation.countryCode) && !originMatchesLiving)
      ? originLocation
      : null;
  const locationPathComplete = Boolean(
    culturalLocation?.country && culturalLocation?.subdivision && culturalLocation?.city
  );
  const suggestedLanguages = cultureLanguageOptions?.suggested ?? [];
  const allLanguages       = cultureLanguageOptions?.all ?? [];

  const originCountryOptions: SelectOption[] = ALL_COUNTRIES.map((c) => ({ value: c.code, label: c.name }));

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
          getEthnicityOptions(culturalLocation.countryCode, culturalLocation.subdivision, culturalLocation.city),
          getLanguageOptions(culturalLocation.countryCode, ethnicity || null, culturalLocation.subdivision, culturalLocation.city),
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
    return () => { cancelled = true; };
  }, [culturalLocation?.countryCode, culturalLocation?.subdivision, culturalLocation?.city, ethnicity, locationPathComplete]);

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
    setLanguages((cur) => cur.includes(lang) ? cur.filter((l) => l !== lang) : [...cur, lang]);

  // Pre-fill living country from IP when user reaches location step (once per empty state).
  useEffect(() => {
    if (step !== 5) return;
    if (location.country || location.countryCode) return;
    let cancelled = false;
    (async () => {
      try {
        const detected = await detectCountryFromIp();
        if (cancelled || !detected) return;
        setLocation((cur) => {
          if (cur.country || cur.countryCode) return cur;
          return {
            ...cur,
            country: detected.country,
            countryCode: detected.countryCode,
            subdivision: '',
            city: '',
          };
        });
      } catch (e) {
        console.error('IP country prefill failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, location.country, location.countryCode]);

  const pickPhotos = async () => {
    try {
      const remaining = MAX_PROFILE_PHOTOS - photoUris.length;
      if (remaining <= 0) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });
      if (result.canceled) return;
      const newUris = result.assets.map((a) => a.uri);

      const { approved, rejected } = await validateFacesInPhotos(newUris);
      if (approved.length === 0) {
        appDialog({
          title: 'No faces detected',
          message: 'None of the selected photos clearly show a face. Please choose photos where your face is visible and well-lit.',
          icon: 'happy-outline',
        });
        return;
      }
      if (rejected.length > 0) {
        const { title, message } = faceRejectionMessage(rejected.length, approved.length);
        appDialog({ title, message, icon: 'happy-outline' });
      }

      setPhotoUris((prev) => [...prev, ...approved].slice(0, MAX_PROFILE_PHOTOS));
    } catch (e) {
      console.error('Image picker failed', e);
      appDialog({
        title: 'Photos',
        message: 'We could not open your photo library. Check permissions and try again.',
        icon: 'images-outline',
      });
    }
  };

  const handleSaveProfile = async (skipCultureFields: boolean) => {
    if (saveInFlightRef.current) return;
    if (!params.userId || !params.email) {
      appDialog({ title: 'Session error', message: 'Please go back and try again.', icon: 'alert-circle-outline' });
      return;
    }
    if (!firstNameValidation.valid) { setStep(1); return; }
    if (!termsAccepted) {
      setStep(1);
      appDialog({
        title: 'Please accept the Terms',
        message: 'You need to agree to the Terms of Service and Privacy Policy to use Africana.',
        icon: 'document-text-outline',
      });
      return;
    }
    if (!birthdate || !gender || !interestedIn) {
      appDialog({ title: 'Incomplete', message: 'Please complete step 3.' });
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
      appDialog({ title: 'Missing location', message: 'Please select your country.', icon: 'location-outline' });
      return;
    }
    if (lookingFor.length === 0) {
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
      let { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const { data } = await supabase.auth.refreshSession();
        session = data.session;
      }
      if (!session) {
        appDialog({ title: 'Session expired', message: 'Please log in again to complete your profile.' });
        router.replace('/(auth)/login');
        return;
      }

      let uploadedUrls: string[] = [];
      if (photoUris.length > 0) {
        for (const uri of photoUris) {
          const out = await uploadToAvatarsBucket(params.userId, uri);
          if (!('error' in out)) uploadedUrls.push(out.publicUrl);
        }
        if (uploadedUrls.length === 0) {
          appDialog({
            title: 'Photo upload failed',
            message: 'We could not upload your photos. You can add them later from your profile.',
            icon: 'cloud-offline-outline',
          });
        }
      }
      const avatarUrl = uploadedUrls[0] ?? null;

      const savedEthnicity = skipCultureFields ? null : ethnicity.trim() || null;
      const savedLanguages = skipCultureFields ? [] : languages;

      const { error } = await supabase.from('profiles').upsert({
        id:             params.userId,
        email:          params.email,
        full_name:      fullName.trim(),
        username:       params.email,
        birthdate:      birthdate.toISOString().split('T')[0],
        gender,
        interested_in:  interestedIn,
        looking_for:    lookingFor,
        country:        location.country || '',
        state:          location.subdivision || null,
        city:           location.city || null,
        origin_country: originLocation.country?.trim() || null,
        origin_state:   originLocation.subdivision?.trim() || null,
        origin_city:    originLocation.city?.trim() || null,
        ethnicity:      savedEthnicity,
        languages:      savedLanguages,
        avatar_url:     avatarUrl,
        profile_photos: uploadedUrls,
        terms_accepted_at: new Date().toISOString(),
      }, { onConflict: 'id' });

      if (error) {
        if (error.message.includes('security policy') || error.code === '42501') {
          appDialog({
            title: 'One more step',
            message: 'Go to Supabase → Authentication → Email → turn OFF "Confirm email" → Save. Then try again.',
            icon: 'settings-outline',
          });
        } else {
          appDialog({ title: 'Something went wrong', message: error.message, icon: 'alert-circle-outline' });
        }
        return;
      }

      await saveOnboardingSkippedHints({
        bio:         true,
        photo:       uploadedUrls.length === 0,
        goals:       false,
        work:        true,
        moreDetails: skipCultureFields || !(savedEthnicity || savedLanguages.length > 0),
      });

      await Promise.all([fetchProfile(params.userId), fetchSettings(params.userId)]);
      track(EVENTS.AUTH_SIGNUP_COMPLETE);
      setStep(7); // celebration
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

  const canProceed = () => {
    if (step === 1) return firstNameValidation.valid && termsAccepted;
    if (step === 2) return true;
    if (step === 3) {
      if (!birthdate || !gender || !interestedIn) return false;
      const ageYears = (Date.now() - birthdate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      return ageYears >= 18 && ageYears <= 120;
    }
    if (step === 4) return lookingFor.length > 0;
    if (step === 5) return !!location.country;
    return true; // steps 6 & 7 always ok
  };

  const goNext = async () => {
    if (step === 6) {
      await handleSaveProfile(false);
      return;
    }
    if (step === 7) { router.replace('/(tabs)/discover'); return; }
    setStep(step + 1);
  };

  // ─── Celebration screen (step 7) ─────────────────────────────────────────
  if (step === 7) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
        <View style={s.celebContainer}>
          <Text style={{ fontSize: 72, marginBottom: 24 }}>🎉</Text>
          <Text style={s.celebTitle}>Welcome to Africana!</Text>
          <Text style={s.celebSub}>
            Your profile is live. You can enrich it anytime from your Profile tab — a fuller profile attracts better matches.
          </Text>
        </View>
        <View style={s.celebFooter}>
          <Button title="Start Exploring →" onPress={() => router.replace('/(tabs)/discover')} fullWidth size="lg" />
        </View>
      </SafeAreaView>
    );
  }

  // ─── Data-collection steps 1–6 ───────────────────────────────────────────
  const cur = STEPS[step - 1];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

        {/* ── Header ── */}
        <View style={s.header}>
          {step > 1 ? (
            <TouchableOpacity onPress={() => setStep(step - 1)} style={s.backBtn}>
              <Ionicons name="arrow-back" size={20} color={COLORS.text} />
            </TouchableOpacity>
          ) : <View style={{ width: 36 }} />}
          <View style={{ flex: 1 }} />
          <Text style={s.counter}>{step} / {TOTAL_STEPS}</Text>
        </View>

        {/* ── Animated progress bar ── */}
        <View style={s.track}>
          <Animated.View
            style={[s.fill, {
              width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
            }]}
          />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 24, paddingTop: 16, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Step hero ── */}
          <View style={[s.stepHero, { backgroundColor: cur.bg }]}>
            <Text style={{ fontSize: 40 }}>{cur.emoji}</Text>
          </View>
          <Text style={s.stepTitle}>{cur.title}</Text>
          <Text style={s.stepSub}>{cur.subtitle}</Text>

          {/* ════ STEP 1 — Name ════ */}
          {step === 1 && (
            <>
              <Input
                value={fullName}
                onChangeText={(v) => { setFullName(v); if (!touched.fullName) setTouched((t) => ({ ...t, fullName: true })); }}
                onBlur={() => setTouched((t) => ({ ...t, fullName: true }))}
                placeholder="e.g. Amara"
                autoCapitalize="words"
                leftIcon="person-outline"
                validationState={getValidationState(Boolean(touched.fullName), firstNameValidation, Boolean(fullName.trim()))}
                error={touched.fullName ? firstNameValidation.message : undefined}
                autoFocus
              />

              {/* Legal consent — tappable row + inline links. We persist
                  `terms_accepted_at` on save as an audit trail. */}
              <Pressable
                onPress={() => setTermsAccepted((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: termsAccepted }}
                style={s.consentRow}
              >
                <Ionicons
                  name={termsAccepted ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={termsAccepted ? COLORS.primary : COLORS.textMuted}
                />
                <Text style={s.consentText}>
                  I am 18 or older and agree to Africana&apos;s{' '}
                  <Text
                    style={s.consentLink}
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push({ pathname: '/(auth)/legal', params: { tab: 'terms' } });
                    }}
                  >
                    Terms of Service
                  </Text>
                  {' '}and{' '}
                  <Text
                    style={s.consentLink}
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push({ pathname: '/(auth)/legal', params: { tab: 'privacy' } });
                    }}
                  >
                    Privacy Policy
                  </Text>
                  .
                </Text>
              </Pressable>
            </>
          )}

          {/* ════ STEP 2 — Photos ════ */}
          {step === 2 && (
            <View style={{ alignItems: 'center' }}>
              <View style={s.photoGrid}>
                {photoUris.map((uri, i) => (
                  <View key={uri} style={s.photoThumb}>
                    <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                    {i === 0 && (
                      <View style={s.mainBadge}>
                        <Text style={s.mainBadgeTxt}>MAIN</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={s.removePhotoBtn}
                      onPress={() => setPhotoUris((p) => p.filter((_, idx) => idx !== i))}
                    >
                      <Ionicons name="close-circle" size={22} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                ))}
                {photoUris.length < MAX_PROFILE_PHOTOS && (
                  <TouchableOpacity style={s.photoAddSlot} onPress={pickPhotos}>
                    <Ionicons name="add" size={30} color={COLORS.earth} />
                    <Text style={s.photoAddTxt}>Add</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={[s.hint, { marginTop: 12, textAlign: 'center' }]}>
                {photoUris.length > 0
                  ? `${photoUris.length} of ${MAX_PROFILE_PHOTOS} photos selected • tap ✕ to remove`
                  : `Select up to ${MAX_PROFILE_PHOTOS} photos at once`}
              </Text>
            </View>
          )}

          {/* ════ STEP 3 — Birthday · Gender · Interested In ════ */}
          {step === 3 && (
            <View>
              <DatePicker label="Date of Birth" value={birthdate} onChange={setBirthdate} placeholder="Tap to select" />

              <Text style={s.label}>I am a</Text>
              <View style={s.rowEqual}>
                {GENDER_ONBOARD.map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => setGender(opt.value)}
                    style={[s.bigChip, gender === opt.value && s.chipOn]}
                  >
                    <Text style={{ fontSize: 26, marginBottom: 6 }}>{opt.emoji}</Text>
                    <Text style={[s.chipTxt, gender === opt.value && s.chipTxtOn]}>{opt.label}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[s.label, { marginTop: 20 }]}>Interested in</Text>
              <View style={s.rowEqual}>
                {INTEREST_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => setInterestedIn(opt.value)}
                    style={[s.bigChip, interestedIn === opt.value && s.chipOn]}
                  >
                    <Text style={{ fontSize: 26, marginBottom: 6 }}>{opt.emoji}</Text>
                    <Text style={[s.chipTxt, interestedIn === opt.value && s.chipTxtOn]}>{opt.label}</Text>
                  </Pressable>
                ))}
              </View>
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
                      <Text style={[s.cardLabel, on && { color: COLORS.success }]}>{opt.label}</Text>
                      <Text style={s.cardDesc}>{opt.desc}</Text>
                    </View>
                    <View style={[s.checkCircle, on && s.checkCircleOn]}>
                      {on && <Ionicons name="checkmark" size={14} color="#FFF" />}
                    </View>
                  </Pressable>
                );
              })}
              <Text style={s.hint}>You can pick more than one — choose at least one to continue.</Text>
            </View>
          )}

          {/* ════ STEP 5 — Location ════ */}
          {step === 5 && (
            <View>
              <LocationPicker value={location} onChange={handleLivingLocationChange} />

              {needsOriginCountry && (
                <SelectPicker
                  label="Origin (optional)"
                  placeholder="Select origin country..."
                  options={originCountryOptions}
                  value={originLocation.countryCode ?? null}
                  onChange={(code) => {
                    const found = ALL_COUNTRIES.find((c) => c.code === code);
                    setOriginLocation(found
                      ? { country: found.name, countryCode: found.code, subdivision: '', city: '' }
                      : {}
                    );
                    setEthnicity('');
                    setLanguages([]);
                  }}
                  clearable
                />
              )}

              {originLocation.countryCode && AFRICAN_COUNTRY_CODES.has(originLocation.countryCode) && !originMatchesLiving && (
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
                <SelectPicker
                  label="Ethnicity"
                  placeholder="Select your ethnicity"
                  options={cultureEthnicityOptions.all.map((o) => ({ value: o, label: o }))}
                  value={ethnicity || null}
                  onChange={(v) => setEthnicity(v ?? '')}
                  clearable
                />
              ) : locationPathComplete && !cultureOptionsLoading ? (
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
                  <MultiChipSelect
                    label="Languages you speak"
                    options={suggestedLanguages}
                    values={languages}
                    onToggle={toggleLanguage}
                  />
                  <MultiChipSelect
                    label={`More languages in ${culturalLocation?.country ?? 'your region'}`}
                    options={allLanguages.filter((l) => !suggestedLanguages.includes(l))}
                    values={languages}
                    onToggle={toggleLanguage}
                  />
                </>
              ) : locationPathComplete && !cultureOptionsLoading ? (
                <Input
                  label="Languages spoken"
                  value={languages.join(', ')}
                  onChangeText={(v) => setLanguages(v.split(',').map((l) => l.trim()).filter(Boolean))}
                  placeholder="e.g. Amharic, English"
                  leftIcon="chatbubbles-outline"
                />
              ) : null}

              {!locationPathComplete && (
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
            {step === 2 && photoUris.length === 0 && (
              <Button title="Skip — add photos later" variant="ghost" onPress={() => setStep(step + 1)} fullWidth />
            )}
            {step === 6 && (
              <Button
                title="Skip for now"
                variant="ghost"
                onPress={() => void handleSaveProfile(true).catch((e) => console.error('handleSaveProfile skip', e))}
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
  header:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 },
  backBtn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.savanna, alignItems: 'center', justifyContent: 'center' },
  counter:  { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  track:    { height: 5, backgroundColor: COLORS.border, marginHorizontal: 20, borderRadius: 3, marginBottom: 8 },
  fill:     { height: 5, backgroundColor: COLORS.primary, borderRadius: 3 },

  stepHero:  { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 16, alignSelf: 'center' },
  stepTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text, textAlign: 'center', marginBottom: 6 },
  stepSub:   { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 28 },

  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 20,
    paddingHorizontal: 4,
  },
  consentText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.textSecondary,
  },
  consentLink: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  label:    { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  row:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  rowEqual: { flexDirection: 'row', flexWrap: 'nowrap', gap: 10 },
  chip:     { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: '#FFF' },
  bigChip:  {
    flex: 1,
    minWidth: 0,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: '#FFF',
    alignItems: 'center',
  },
  ctaPrimary: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 5,
  },
  chipOn:   { borderColor: COLORS.success, backgroundColor: COLORS.successSurface },
  chipTxt:  { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  chipTxtOn:{ color: COLORS.success, fontWeight: '700' },

  card:         { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: '#FFF', gap: 14 },
  cardOn:       { borderColor: COLORS.success, backgroundColor: COLORS.successSurface },
  cardLabel:    { fontSize: 16, fontWeight: '700', color: COLORS.text },
  cardDesc:     { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  checkCircle:  { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  checkCircleOn:{ borderColor: COLORS.success, backgroundColor: COLORS.success },

  // ── Photo grid (step 2) ───────────────────────────────────────────────────
  photoGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', width: '100%' },
  photoThumb:    { width: (width - 48 - 16) / 3, height: (width - 48 - 16) / 3 * 1.3, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  mainBadge:     { position: 'absolute', bottom: 6, left: 6, backgroundColor: COLORS.primary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  mainBadgeTxt:  { color: '#FFF', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  removePhotoBtn:{ position: 'absolute', top: 4, right: 4 },
  photoAddSlot:  { width: (width - 48 - 16) / 3, height: (width - 48 - 16) / 3 * 1.3, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: COLORS.earthLight, backgroundColor: COLORS.savanna, alignItems: 'center', justifyContent: 'center', gap: 4 },
  photoAddTxt:   { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  hint:          { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },

  celebContainer:  { flex: 1, padding: 28, justifyContent: 'center', alignItems: 'center' },
  celebTitle:      { fontSize: 32, fontWeight: '800', color: COLORS.text, marginBottom: 12, textAlign: 'center' },
  celebSub:        { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  celebFooter:     { paddingHorizontal: 28, paddingBottom: 32 },
});
