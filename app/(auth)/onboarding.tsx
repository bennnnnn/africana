import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
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
import { RangeSlider as AgeRangeSlider, SliderPicker } from '@/components/ui/SliderPicker';
import {
  COLORS,
  FONT,
  GENDER_OPTIONS,
  INTERESTED_IN_OPTIONS,
  RELIGION_OPTIONS,
  EDUCATION_OPTIONS,
  OCCUPATION_OPTIONS,
  PHYSICAL_CONDITION_OPTIONS,
  MARITAL_STATUS_OPTIONS,
} from '@/constants';
import { Gender, LookingFor, Religion, Education, MaritalStatus, WantChildren } from '@/types';
import { oppositeInterestedIn } from '@/lib/gender-match';
import { ALL_COUNTRIES, AFRICAN_COUNTRY_CODES } from '@/lib/country-data';
import {
  getValidationState,
  validateFirstName,
  validateOptionalHeight,
  validateOptionalText,
} from '@/lib/validation';
import { DEFAULT_MAX_AGE_PREFERENCE, DEFAULT_MIN_AGE_PREFERENCE } from '@/lib/utils';
import { saveOnboardingSkippedHints } from '@/lib/post-onboarding-nudges';
import { appDialog } from '@/lib/app-dialog';
import { CultureOptionSet, getEthnicityOptions, getLanguageOptions } from '@/lib/cultural-data';

const { width } = Dimensions.get('window');
const TOTAL_STEPS = 9;
const ACTIVE_COLOR = COLORS.success;

const STEPS = [
  { title: "Welcome — let's meet you",  subtitle: 'Let\'s get to know you better.', bg: '#FFF3E0' },
  { title: 'Birthday & identity',       subtitle: 'We use this to show you the right people and keep the community genuine.', bg: '#E8F5E9' },
  { title: 'What are you looking for?',   subtitle: 'Select what kind of relationship you are looking for.', bg: '#FCE4EC' },
  { title: 'What do you do?',              subtitle: 'School, job, or craft — it sparks great conversations.', bg: '#E3F2FD' },
  { title: 'Your preferences',          subtitle: 'Age range and relationship status help surface compatible people.', bg: '#F3E5F5' },
  { title: 'Faith & family',            subtitle: 'Religion and children — share what you’re comfortable with.', bg: '#EDE7F6' },
  { title: 'physical attributes',             subtitle: 'How tall you are, your build, and weight if you like — separate from faith & family.', bg: '#E8EAF6' },
  { title: 'Where do you live?',        subtitle: 'Tell us where you live so we can show you the right people.', bg: '#E0F7FA' },
  { title: 'Add your best photo',       subtitle: 'A clear face photo helps you stand out — you can add more later.', bg: '#FFF8E1' },
];

const LOOKING_FOR_OPTS = [
  { value: 'relationship', label: 'Relationship',  desc: 'A deep, meaningful connection' },
  { value: 'marriage',     label: 'Marriage',      desc: 'Serious, long-term commitment' },
  { value: 'friendship',   label: 'Friendship',    desc: 'Friends first, see what happens' },
  { value: 'pen_pal',      label: 'Pen Pal',       desc: 'Chat, share stories, connect' },
];

function ChipSelect({
  label, options, value, onSelect, stretch = false,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string | null;
  onSelect: (v: string | null) => void;
  stretch?: boolean;
}) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={s.label}>{label}</Text>
      <View style={s.row}>
        {options.map((opt) => {
          const on = value === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onSelect(on ? null : opt.value)}
              style={[stretch ? s.bigChip : s.chip, on && s.chipOn]}
            >
              <Text style={[s.chipTxt, on && s.chipTxtOn]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function MultiChipSelect({
  label,
  options,
  values,
  onToggle,
}: {
  label: string;
  options: string[];
  values: string[];
  onToggle: (value: string) => void;
}) {
  if (options.length === 0) return null;

  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={s.label}>{label}</Text>
      <View style={s.row}>
        {options.map((option) => {
          const on = values.includes(option);
          return (
            <Pressable
              key={option}
              onPress={() => onToggle(option)}
              style={[s.chip, on && s.chipOn]}
            >
              <Text style={[s.chipTxt, on && s.chipTxtOn]}>{option}</Text>
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

  // Animated progress bar
  const progressAnim = useRef(new Animated.Value((1 / TOTAL_STEPS) * 100)).current;
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (step / TOTAL_STEPS) * 100,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [step]);

  // Step 1
  const [fullName, setFullName] = useState('');
  const [bio, setBio]           = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Step 2
  const [birthdate, setBirthdate]       = useState<Date | null>(null);
  const [gender, setGender]             = useState<Gender | null>(null);

  // Step 3
  const [lookingFor, setLookingFor] = useState<LookingFor[]>([]);
  const [minAgePref, setMinAgePref] = useState(DEFAULT_MIN_AGE_PREFERENCE);
  const [maxAgePref, setMaxAgePref] = useState(DEFAULT_MAX_AGE_PREFERENCE);
  const toggleLookingFor = (val: LookingFor) =>
    setLookingFor((p) => p.includes(val) ? p.filter((v) => v !== val) : [...p, val]);

  // Step 4 — work & study
  const [education, setEducation]         = useState<Education | null>(null);
  const [occupation, setOccupation]       = useState('');

  // Step 5 — preferences
  const [maritalStatus, setMaritalStatus] = useState<MaritalStatus | null>(null);

  // Step 6 — faith & family
  const [religion, setReligion]           = useState<Religion | null>(null);
  const [ethnicity, setEthnicity]         = useState('');

  // Step 7 — height, body type, weight
  const [heightCm, setHeightCm]         = useState('');
  const [weightKg, setWeightKg]         = useState<number | null>(null);
  const [physicalCondition, setPhysicalCondition] = useState<string | null>(null);
  const [languages, setLanguages]       = useState<string[]>([]);
  const [hasChildren, setHasChildren]   = useState<boolean | null>(null);
  const [wantChildren, setWantChildren] = useState<WantChildren | null>(null);

  // Step 8
  const [location, setLocation] = useState<Partial<LocationValue>>({});
  const [originLocation, setOriginLocation] = useState<Partial<LocationValue>>({});

  // Step 9
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [skippedMoreAboutStep, setSkippedMoreAboutStep] = useState(false);
  const [cultureEthnicityOptions, setCultureEthnicityOptions] = useState<CultureOptionSet | null>(null);
  const [cultureLanguageOptions, setCultureLanguageOptions] = useState<CultureOptionSet | null>(null);
  const [cultureOptionsLoading, setCultureOptionsLoading] = useState(false);
  const firstNameValidation = validateFirstName(fullName);
  const heightValidation = validateOptionalHeight(heightCm);
  const ethnicityValidation = validateOptionalText(ethnicity, 'Ethnicity');
  const livesInAfrica = location.countryCode ? AFRICAN_COUNTRY_CODES.has(location.countryCode) : false;
  const needsOriginCountry = Boolean(location.countryCode) && !livesInAfrica;
  const originMatchesLivingCountry =
    Boolean(originLocation.countryCode) && originLocation.countryCode === location.countryCode;
  const culturalLocation = livesInAfrica
    ? location
    : needsOriginCountry && originLocation.countryCode && AFRICAN_COUNTRY_CODES.has(originLocation.countryCode) && !originMatchesLivingCountry
      ? originLocation
      : null;
  const suggestedLanguages = cultureLanguageOptions?.suggested ?? [];
  const allLanguages = cultureLanguageOptions?.all ?? [];
  const originCountryOptions: SelectOption[] = ALL_COUNTRIES.map((country) => ({
    value: country.code,
    label: country.name,
  }));
  const locationPathComplete = Boolean(culturalLocation?.country && culturalLocation?.subdivision && culturalLocation?.city);

  const markTouched = (field: string) =>
    setTouched((current) => ({ ...current, [field]: true }));

  const toggleLanguage = (value: string) => {
    setLanguages((current) =>
      current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value]
    );
  };

  // Auto-detect country via IP geolocation on first render
  useEffect(() => {
    // ipinfo.io: always HTTPS, free, works globally including African networks
    fetch('https://ipinfo.io/json')
      .then((res) => res.json())
      .then((data: { country?: string }) => {
        if (!data?.country) return;
        const found = ALL_COUNTRIES.find((c) => c.code === data.country);
        if (found) {
          setLocation((prev) =>
            prev.country
              ? prev
              : { country: found.name, countryCode: found.code, subdivision: '', city: '' }
          );
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCultureOptions() {
      if (!locationPathComplete || !culturalLocation?.countryCode) {
        setCultureEthnicityOptions(null);
        setCultureLanguageOptions(null);
        setCultureOptionsLoading(false);
        return;
      }

      setCultureOptionsLoading(true);
      const [ethnicityOptions, languageOptions] = await Promise.all([
        getEthnicityOptions(culturalLocation.countryCode, culturalLocation.subdivision, culturalLocation.city),
        getLanguageOptions(culturalLocation.countryCode, ethnicity || null, culturalLocation.subdivision, culturalLocation.city),
      ]);

      if (cancelled) return;
      setCultureEthnicityOptions(ethnicityOptions);
      setCultureLanguageOptions(languageOptions);
      setCultureOptionsLoading(false);
    }

    loadCultureOptions();

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

  const handleLivingLocationChange = (value: Partial<LocationValue>) => {
    setLocation((current) => {
      const next = { ...current, ...value };
      if (value.countryCode && value.countryCode !== current.countryCode) {
        setOriginLocation({});
        setEthnicity('');
        setLanguages([]);
      } else if (value.subdivision !== undefined || value.city !== undefined) {
        setEthnicity('');
        setLanguages([]);
      }
      return next;
    });
  };

  const handleOriginLocationChange = (value: Partial<LocationValue>) => {
    setOriginLocation((current) => {
      const next = { ...current, ...value };
      if (value.countryCode && value.countryCode !== current.countryCode) {
        setEthnicity('');
        setLanguages([]);
      } else if (value.subdivision !== undefined || value.city !== undefined) {
        setEthnicity('');
        setLanguages([]);
      }
      return next;
    });
  };

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  const uploadPhoto = async (uri: string): Promise<string | null> => {
    if (!params.userId) return null;
    const out = await uploadToAvatarsBucket(params.userId, uri);
    return 'error' in out ? null : out.publicUrl;
  };

  const handleFinish = async () => {
    if (!params.userId || !params.email) {
      appDialog({ title: 'Session error', message: 'Please go back and try again.', icon: 'alert-circle-outline' });
      return;
    }
    if (!firstNameValidation.valid) { setStep(1); markTouched('fullName'); return; }
    if (!birthdate || !gender) {
      appDialog({ title: 'Incomplete', message: 'Please complete step 2.' });
      return;
    }
    if (!location.country) {
      appDialog({ title: 'Missing location', message: 'Please select your country.', icon: 'location-outline' });
      return;
    }
    if (!heightValidation.valid || !ethnicityValidation.valid) {
      if (!heightValidation.valid) setStep(7);
      else setStep(8);
      markTouched('heightCm');
      markTouched('ethnicity');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) await supabase.auth.refreshSession();

      let avatarUrl: string | null = null;
      if (photoUri) {
        avatarUrl = await uploadPhoto(photoUri);
        if (!avatarUrl) {
          appDialog({
            title: 'Photo upload failed',
            message: 'We could not upload your photo. You can add it later in your profile.',
            icon: 'cloud-offline-outline',
          });
        }
      }

      const { error } = await supabase.from('profiles').insert({
        id: params.userId,
        email: params.email,
        full_name: fullName.trim(),
        username: params.email,
        bio: bio.trim() || null,
        birthdate: birthdate.toISOString().split('T')[0],
        gender,
        interested_in: oppositeInterestedIn(gender),
        looking_for: lookingFor,
        min_age_pref: minAgePref,
        max_age_pref: maxAgePref,
        country: location.country || '',
        state: location.subdivision || null,
        city: location.city || null,
        origin_country: originLocation.country?.trim() || null,
        origin_state: originLocation.subdivision?.trim() || null,
        origin_city: originLocation.city?.trim() || null,
        religion: religion ?? null,
        education: education ?? null,
        marital_status: maritalStatus ?? null,
        ethnicity: ethnicity.trim() || null,
        occupation: occupation.trim() || null,
        height_cm: heightCm ? parseInt(heightCm, 10) : null,
        weight_kg: weightKg,
        body_type: physicalCondition,
        languages,
        has_children: hasChildren,
        want_children: wantChildren ?? null,
        avatar_url: avatarUrl,
        profile_photos: avatarUrl ? [avatarUrl] : [],
      });

      if (error) {
        if (error.message.includes('security policy') || error.code === '42501') {
          appDialog({
            title: 'One more step',
            message:
              'Go to Supabase → Authentication → Email → turn OFF "Confirm email" → Save. Then try again.',
            icon: 'settings-outline',
          });
        } else {
          appDialog({ title: 'Something went wrong', message: error.message, icon: 'alert-circle-outline' });
        }
        return;
      }

      await saveOnboardingSkippedHints({
        bio: !bio.trim(),
        photo: !avatarUrl,
        goals: lookingFor.length === 0,
        work: !education && !occupation?.trim(),
        moreDetails: skippedMoreAboutStep,
      });

      // Load the new profile into the store before navigating
      await Promise.all([
        fetchProfile(params.userId),
        fetchSettings(params.userId),
      ]);
      router.replace('/(tabs)/discover');
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    if (step === 1) return firstNameValidation.valid;
    if (step === 2) return birthdate !== null && gender !== null;
    if (step === 3) return true;
    if (step === 4) return true;
    if (step === 5) return true;
    if (step === 6) return true;
    if (step === 7) return heightValidation.valid;
    if (step === 8) return !!location.country;
    return true;
  };

  const goNext = () => {
    if (step === 6) setSkippedMoreAboutStep(false);
    if (step < TOTAL_STEPS) setStep(step + 1);
    else handleFinish();
  };
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
          <Text style={s.counter}>{Math.round((step / TOTAL_STEPS) * 100)}%</Text>
        </View>

        {/* ── Progress bar ── */}
        <View style={s.track}>
          <Animated.View
            style={[s.fill, { width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]}
          />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 24, paddingTop: 16, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Step hero ── */}
          <Text style={s.stepTitle}>{cur.title}</Text>
          <Text style={s.stepSub}>{cur.subtitle}</Text>

          {/* ════════════════════════════════════════
              STEP 1 — Name
          ════════════════════════════════════════ */}
          {step === 1 && (
            <View>
              <Input
                value={fullName}
                onChangeText={(value) => {
                  setFullName(value);
                  if (!touched.fullName) markTouched('fullName');
                }}
                onBlur={() => markTouched('fullName')}
                placeholder="e.g. Amara"
                autoCapitalize="words"
                leftIcon="person-outline"
                validationState={getValidationState(Boolean(touched.fullName), firstNameValidation, Boolean(fullName.trim()))}
                error={touched.fullName ? firstNameValidation.message : undefined}
                autoFocus
              />
              
              <View style={{ marginBottom: 8 }}>
                <Text style={s.label}>Tell us about you</Text>
                <Text style={s.bioHelper}>
                    This helps us match you with the right people.
                </Text>
                <View style={s.bioFieldOuter}>
                  <Ionicons name="create-outline" size={20} color={COLORS.textSecondary} style={{ marginRight: 10, marginTop: 2 }} />
                  <TextInput
                    value={bio}
                    onChangeText={setBio}
                    placeholder="e.g. I love jazz, cooking, and honest conversation."
                    placeholderTextColor={COLORS.textMuted}
                    multiline
                    maxLength={300}
                    textAlignVertical="top"
                    style={s.bioInput}
                  />
                </View>
                <Text style={s.bioCounter}>{bio.length}/300</Text>
              </View>
            </View>
          )}

          {/* ════════════════════════════════════════
              STEP 2 — Birthday · Gender · Interested in
          ════════════════════════════════════════ */}
          {step === 2 && (
            <View>
              <DatePicker label="Date of Birth" value={birthdate} onChange={setBirthdate} placeholder="Tap to select" />

              <Text style={s.label}>I am a</Text>
              <View style={s.row}>
                {GENDER_OPTIONS.map((opt) => (
                  <Pressable key={opt.value} onPress={() => setGender(opt.value as Gender)} style={[s.bigChip, gender === opt.value && s.chipOn]}>
                    <Text style={[s.chipTxt, gender === opt.value && s.chipTxtOn]}>{opt.label}</Text>
                  </Pressable>
                ))}
              </View>

              {gender === 'male' || gender === 'female' ? (
                <View style={{ marginTop: 22 }}>
                  <Text style={s.label}> I want to meet</Text>
                  <View style={s.row}>
                    {INTERESTED_IN_OPTIONS.map((opt) => {
                      const selected = oppositeInterestedIn(gender) === opt.value;
                      return (
                        <View
                          key={opt.value}
                          style={[s.bigChip, selected && s.chipOn]}
                          accessibilityState={{ selected }}
                        >
                          <Text style={[s.chipTxt, selected && s.chipTxtOn]}>{opt.label}</Text>
                        </View>
                      );
                    })}
                  </View>
                  <Text style={{ marginTop: 12, fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 }}>
                   
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          {/* ════════════════════════════════════════
              STEP 3 — Looking for
          ════════════════════════════════════════ */}
          {step === 3 && (
            <View style={{ gap: 10 }}>
              {LOOKING_FOR_OPTS.map((opt) => {
                const on = lookingFor.includes(opt.value as LookingFor);
                return (
                  <Pressable key={opt.value} onPress={() => toggleLookingFor(opt.value as LookingFor)} style={[s.card, on && s.cardOn]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.cardLabel, on && { color: COLORS.primary }]}>{opt.label}</Text>
                      <Text style={s.cardDesc}>{opt.desc}</Text>
                    </View>
                    <View style={[s.checkCircle, on && s.checkCircleOn]}>
                      {on && <Ionicons name="checkmark" size={14} color="#FFF" />}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* ════════════════════════════════════════
              STEP 4 — Work & study
          ════════════════════════════════════════ */}
          {step === 4 && (
            <View>
              <SelectPicker
                label="Highest Education you have achieved"
                placeholder="Select education level..."
                options={EDUCATION_OPTIONS}
                value={education}
                onChange={(v) => setEducation(v as Education | null)}
              />
              <SelectPicker
                label="Occupation"
                placeholder="Select your occupation..."
                options={OCCUPATION_OPTIONS as unknown as SelectOption[]}
                value={occupation || null}
                onChange={(value) => setOccupation(value ?? '')}
              />
            </View>
          )}

          {/* ════════════════════════════════════════
              STEP 5 — Preferences
          ════════════════════════════════════════ */}
          {step === 5 && (
            <View>
              <AgeRangeSlider
                label="Age range preference"
                minValue={minAgePref}
                maxValue={maxAgePref}
                min={DEFAULT_MIN_AGE_PREFERENCE}
                max={DEFAULT_MAX_AGE_PREFERENCE}
                unit=""
                horizontalPadding={32}
                onChangeMin={setMinAgePref}
                onChangeMax={setMaxAgePref}
                onChangeRange={(min, max) => {
                  setMinAgePref(min);
                  setMaxAgePref(max);
                }}
              />
              <SelectPicker
                label="Your marital Status"
                placeholder="Select your marital status..."
                options={MARITAL_STATUS_OPTIONS}
                value={maritalStatus}
                onChange={(v) => setMaritalStatus(v as MaritalStatus | null)}
                clearable
              />
            </View>
          )}

          {/* ════════════════════════════════════════
              STEP 6 — Faith & family
          ════════════════════════════════════════ */}
          {step === 6 && (
            <View>
              <SelectPicker
                label="What is your religion?"
                placeholder="Select your religion..."
                options={RELIGION_OPTIONS}
                value={religion}
                onChange={(v) => setReligion(v as Religion | null)}
              />
              <ChipSelect
                label="Do you have children?"
                options={[
                  { value: 'true',  label: 'Yes' },
                  { value: 'false', label: 'No' },
                ]}
                value={hasChildren === null ? null : String(hasChildren)}
                onSelect={(v) => setHasChildren(v === null ? null : v === 'true')}
                stretch
              />
              <ChipSelect
                label="Do you want children?"
                options={[
                  { value: 'yes', label: 'Yes' },
                  { value: 'no',  label: 'No' },
                ]}
                value={wantChildren}
                onSelect={(v) => setWantChildren(v as WantChildren | null)}
                stretch
              />
            </View>
          )}

          {/* ════════════════════════════════════════
              STEP 7 — Height, body type, weight
          ════════════════════════════════════════ */}
          {step === 7 && (
            <View>
              <SliderPicker
                label="Height"
                value={heightCm ? Number(heightCm) : 170}
                min={120}
                max={220}
                unit=""
                formatValue={(v) => `${(v / 100).toFixed(2)} m`}
                onChange={(value) => {
                  setHeightCm(String(value));
                  if (!touched.heightCm) markTouched('heightCm');
                }}
              />
              {touched.heightCm && heightValidation.message ? (
                <Text style={{ fontSize: 12, color: COLORS.error, marginTop: -10, marginBottom: 14 }}>
                  {heightValidation.message}
                </Text>
              ) : null}
              <SelectPicker
                label="Body type"
                placeholder="Select body type..."
                options={PHYSICAL_CONDITION_OPTIONS as unknown as SelectOption[]}
                value={physicalCondition}
                onChange={setPhysicalCondition}
              />
              {weightKg === null ? (
                <TouchableOpacity
                  onPress={() => setWeightKg(70)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20, marginTop: -4 }}
                >
                  <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
                  <Text style={{ fontSize: 14, color: COLORS.primary, fontWeight: '600' }}>Add weight</Text>
                </TouchableOpacity>
              ) : (
                <View>
                  <SliderPicker
                    label="Weight"
                    value={weightKg}
                    min={35}
                    max={180}
                    unit="kg"
                    onChange={setWeightKg}
                  />
                  <TouchableOpacity
                    onPress={() => setWeightKg(null)}
                    style={{ marginTop: -14, marginBottom: 16, alignSelf: 'flex-end' }}
                  >
                    <Text style={{ fontSize: 12, color: COLORS.textMuted }}>Remove</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* ════════════════════════════════════════
              STEP 8 — Location
          ════════════════════════════════════════ */}
          {step === 8 && (
            <View>
              <LocationPicker value={location} onChange={handleLivingLocationChange} />


              {needsOriginCountry && (
                <>
                  <SelectPicker
                    label="Origin country (optional)"
                    placeholder="Select your origin country"
                    options={originCountryOptions}
                    value={originLocation.countryCode ?? null}
                    onChange={(countryCode) => {
                      const selected = ALL_COUNTRIES.find((country) => country.code === countryCode);
                      setOriginLocation(
                        selected
                          ? { country: selected.name, countryCode: selected.code, subdivision: '', city: '' }
                          : {}
                      );
                      setEthnicity('');
                      setLanguages([]);
                    }}
                    clearable
                  />

                  {originLocation.countryCode && AFRICAN_COUNTRY_CODES.has(originLocation.countryCode) && !originMatchesLivingCountry && (
                    <LocationPicker
                      value={originLocation}
                      onChange={handleOriginLocationChange}
                      showCountryField={false}
                    />
                  )}
                </>
              )}

              {locationPathComplete && culturalLocation?.country && cultureEthnicityOptions ? (
                <SelectPicker
                  label="Ethnicity"
                  placeholder={`Select your ethnicity in ${culturalLocation.country}`}
                  options={cultureEthnicityOptions.all.map((option) => ({ value: option, label: option }))}
                  value={ethnicity || null}
                  onChange={(value) => setEthnicity(value ?? '')}
                  clearable
                />
              ) : locationPathComplete && !cultureOptionsLoading ? (
                <Input
                  label="Ethnicity"
                  value={ethnicity}
                  onChangeText={(value) => {
                    setEthnicity(value);
                    if (!touched.ethnicity) markTouched('ethnicity');
                  }}
                  onBlur={() => markTouched('ethnicity')}
                  placeholder="Enter your ethnicity"
                  leftIcon="people-outline"
                  validationState={getValidationState(Boolean(touched.ethnicity), ethnicityValidation, Boolean(ethnicity.trim()))}
                  error={touched.ethnicity ? ethnicityValidation.message : undefined}
                />
              ) : null}

              {locationPathComplete && culturalLocation?.country && cultureLanguageOptions ? (
                <View style={{ marginBottom: 8 }}>
                  <MultiChipSelect
                    label="Which languages do you speak?"
                    options={suggestedLanguages}
                    values={languages}
                    onToggle={toggleLanguage}
                  />
                  <MultiChipSelect
                    label={`More languages in ${culturalLocation.country}`}
                    options={allLanguages.filter((language) => !suggestedLanguages.includes(language))}
                    values={languages}
                    onToggle={toggleLanguage}
                  />
                </View>
              ) : locationPathComplete && !cultureOptionsLoading ? (
                <Input
                  label="Languages spoken"
                  value={languages.join(', ')}
                  onChangeText={(value) => {
                    setLanguages(value.split(',').map((entry) => entry.trim()).filter(Boolean));
                  }}
                  placeholder="e.g. English, Amharic, French"
                  leftIcon="chatbubbles-outline"
                />
              ) : null}
            </View>
          )}

          {/* ════════════════════════════════════════
              STEP 9 — Photo
          ════════════════════════════════════════ */}
          {step === 9 && (
            <View style={{ alignItems: 'center' }}>
              <TouchableOpacity onPress={pickPhoto} activeOpacity={0.9} style={s.photoBox}>
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                ) : (
                  <View style={{ alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: `${COLORS.primary}15`, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="camera" size={34} color={COLORS.primary} />
                    </View>
                    <Text style={{ color: COLORS.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22 }}>
                      Tap to choose{'\n'}your best photo
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              {photoUri && (
                <TouchableOpacity onPress={pickPhoto} style={{ marginTop: 14 }}>
                  <Text style={{ color: COLORS.primary, fontWeight: '600' }}>Change photo</Text>
                </TouchableOpacity>
              )}
              <Text style={[s.hint, { marginTop: 20, textAlign: 'center' }]}>
                You can add more photos after signing up
              </Text>
            </View>
          )}

          {/* ── Buttons ── */}
          <View style={{ marginTop: 32, gap: 10 }}>
            <Button
              title={step < TOTAL_STEPS ? 'Continue →' : 'Finish Setup 🎉'}
              onPress={goNext}
              fullWidth
              size="lg"
              loading={loading}
              disabled={!canProceed()}
            />
            {step === 3 && (
              <Button title="Skip for now — I’ll add this later" variant="ghost" onPress={() => setStep(step + 1)} fullWidth />
            )}
            {step === 6 && (
              <Button
                title="Skip for now — I’ll add this later"
                variant="ghost"
                onPress={() => {
                  setSkippedMoreAboutStep(true);
                  setStep(step + 1);
                }}
                fullWidth
              />
            )}
            {step === TOTAL_STEPS && !photoUri && (
              <Button title="Skip photo — add one from my profile" variant="ghost" onPress={handleFinish} fullWidth loading={loading} />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 },
  backBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.savanna, alignItems: 'center', justifyContent: 'center' },
  counter:    { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  track:      { height: 5, backgroundColor: COLORS.border, marginHorizontal: 20, borderRadius: 3, marginBottom: 8 },
  fill:       { height: 5, backgroundColor: COLORS.primary, borderRadius: 3 },
  stepTitle:  { fontSize: 24, fontWeight: '800', color: COLORS.text, textAlign: 'center', marginBottom: 6 },
  stepSub:    { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  label:      { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  row:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip:       { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: '#FFF' },
  bigChip:    { flex: 1, paddingVertical: 16, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: '#FFF', alignItems: 'center' },
  chipOn:     { borderColor: ACTIVE_COLOR, backgroundColor: `${ACTIVE_COLOR}12` },
  chipTxt:    { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  chipTxtOn:  { color: ACTIVE_COLOR, fontWeight: '700' },
  card:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: '#FFF', gap: 12 },
  cardOn:     { borderColor: ACTIVE_COLOR, backgroundColor: `${ACTIVE_COLOR}10` },
  cardLabel:  { fontSize: 15, fontWeight: '700', color: COLORS.text },
  cardDesc:   { fontSize: 11, color: COLORS.textSecondary, marginTop: 2, lineHeight: 16 },
  checkCircle:  { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  checkCircleOn:{ borderColor: ACTIVE_COLOR, backgroundColor: ACTIVE_COLOR },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  divider:    { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },
  hint:       { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  photoBox:   { width: width * 0.6, height: width * 0.75, borderRadius: 28, backgroundColor: COLORS.savanna, borderWidth: 2, borderStyle: 'dashed', borderColor: COLORS.earthLight, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  bioHelper:  { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 12 },
  bioFieldOuter: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: COLORS.inputBg,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    minHeight: 148,
  },
  bioInput:   { flex: 1, fontSize: FONT.md, color: COLORS.text, minHeight: 120, lineHeight: 22 },
  bioCounter: { fontSize: 11, color: COLORS.textMuted, marginTop: 8, textAlign: 'right' },
});
