import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
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
import { COLORS, GENDER_OPTIONS } from '@/constants';
import { Gender, LookingFor } from '@/types';
import { validateFirstName, getValidationState } from '@/lib/validation';
import { saveOnboardingSkippedHints } from '@/lib/post-onboarding-nudges';
import { appDialog } from '@/lib/app-dialog';

const { width } = Dimensions.get('window');

// 5 data-collection steps; step 6 is the celebration screen (not counted in progress)
const TOTAL_STEPS = 5;

const STEPS = [
  { emoji: '👤', title: "What's your name?",          subtitle: "This is how you'll appear to others on Africana.", bg: '#FFF3E0' },
  { emoji: '📸', title: 'Add your photo',             subtitle: 'Profiles with a photo get 6× more matches.',       bg: '#FFF8E1' },
  { emoji: '🎂', title: 'A bit about you',            subtitle: 'A few basics to help us find the right people.',   bg: '#E8F5E9' },
  { emoji: '💞', title: 'What are you looking for?',  subtitle: "Be honest — the right match is out there.",        bg: '#FCE4EC' },
  { emoji: '📍', title: 'Where do you live?',         subtitle: 'Your location helps people near you find you.',    bg: '#E0F7FA' },
];

const INTEREST_OPTIONS = [
  { value: 'women',    label: 'Women',    emoji: '👩' },
  { value: 'men',      label: 'Men',      emoji: '👨' },
  { value: 'everyone', label: 'Everyone', emoji: '💫' },
];

const LOOKING_FOR_OPTS = [
  { value: 'relationship', emoji: '💑', label: 'Relationship', desc: 'A deep, meaningful connection' },
  { value: 'marriage',     emoji: '💍', label: 'Marriage',     desc: 'Serious, long-term commitment' },
  { value: 'friendship',   emoji: '🤝', label: 'Friendship',   desc: 'Friends first, see what happens' },
  { value: 'pen_pal',      emoji: '✉️', label: 'Pen Pal',      desc: 'Chat, share stories, connect' },
];

const PROFILE_NUDGE_ITEMS = [
  { icon: 'create-outline'  as const, label: 'Bio — let people know you' },
  { icon: 'book-outline'    as const, label: 'Education & occupation' },
  { icon: 'heart-outline'   as const, label: 'Religion & family values' },
  { icon: 'body-outline'    as const, label: 'Height & body type' },
  { icon: 'people-outline'  as const, label: 'Ethnicity & languages' },
  { icon: 'camera-outline'  as const, label: 'More photos' },
];

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

  // Step 2
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  // Step 3
  const [birthdate, setBirthdate]     = useState<Date | null>(null);
  const [gender, setGender]           = useState<Gender | null>(null);
  const [interestedIn, setInterestedIn] = useState<string | null>(null);

  // Step 4
  const [lookingFor, setLookingFor] = useState<LookingFor[]>([]);
  const toggleLookingFor = (val: LookingFor) =>
    setLookingFor((p) => p.includes(val) ? p.filter((v) => v !== val) : [...p, val]);

  // Step 5
  const [location, setLocation] = useState<Partial<LocationValue>>({});

  const [loading, setLoading] = useState(false);

  const firstNameValidation = validateFirstName(fullName);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  const handleSaveProfile = async () => {
    if (!params.userId || !params.email) {
      appDialog({ title: 'Session error', message: 'Please go back and try again.', icon: 'alert-circle-outline' });
      return;
    }
    if (!firstNameValidation.valid) { setStep(1); return; }
    if (!birthdate || !gender) {
      appDialog({ title: 'Incomplete', message: 'Please complete step 3.' });
      return;
    }
    if (!location.country) {
      appDialog({ title: 'Missing location', message: 'Please select your country.', icon: 'location-outline' });
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) await supabase.auth.refreshSession();

      let avatarUrl: string | null = null;
      if (photoUri) {
        const out = await uploadToAvatarsBucket(params.userId, photoUri);
        if ('error' in out) {
          appDialog({
            title: 'Photo upload failed',
            message: 'We could not upload your photo. You can add it later from your profile.',
            icon: 'cloud-offline-outline',
          });
        } else {
          avatarUrl = out.publicUrl;
        }
      }

      const { error } = await supabase.from('profiles').insert({
        id:             params.userId,
        email:          params.email,
        full_name:      fullName.trim(),
        username:       params.email,
        birthdate:      birthdate.toISOString().split('T')[0],
        gender,
        interested_in:  interestedIn ?? (gender === 'male' ? 'women' : 'men'),
        looking_for:    lookingFor,
        country:        location.country || '',
        state:          location.subdivision || null,
        city:           location.city || null,
        avatar_url:     avatarUrl,
        profile_photos: avatarUrl ? [avatarUrl] : [],
      });

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
        photo:       !avatarUrl,
        goals:       lookingFor.length === 0,
        work:        true,
        moreDetails: true,
      });

      await Promise.all([
        fetchProfile(params.userId),
        fetchSettings(params.userId),
      ]);

      setStep(6); // show celebration screen
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    if (step === 1) return firstNameValidation.valid;
    if (step === 2) return true;
    if (step === 3) return birthdate !== null && gender !== null && interestedIn !== null;
    if (step === 4) return true;
    if (step === 5) return !!location.country;
    return true;
  };

  const goNext = async () => {
    if (step === 5) { await handleSaveProfile(); return; }
    if (step === 6) { router.replace('/(tabs)/discover'); return; }
    setStep(step + 1);
  };

  // ─── Celebration screen (step 6) ─────────────────────────────────────────
  if (step === 6) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
        <View style={s.celebContainer}>
          <View style={s.celebCheck}>
            <Ionicons name="checkmark" size={52} color="#FFF" />
          </View>
          <Text style={s.celebTitle}>You're in!</Text>
          <Text style={s.celebSub}>
            Your profile is ready. Fill in more details{'\n'}from your Profile tab to get better matches.
          </Text>

          <View style={s.celebList}>
            <Text style={s.celebListTitle}>Add these later from Profile:</Text>
            {PROFILE_NUDGE_ITEMS.map((item) => (
              <View key={item.label} style={s.celebItem}>
                <Ionicons name={item.icon} size={16} color={COLORS.textSecondary} />
                <Text style={s.celebItemText}>{item.label}</Text>
              </View>
            ))}
          </View>
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

  // ─── Data-collection steps 1–5 ────────────────────────────────────────────
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

          {/* ════════════════════════════════════════
              STEP 1 — Name
          ════════════════════════════════════════ */}
          {step === 1 && (
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
          )}

          {/* ════════════════════════════════════════
              STEP 2 — Photo
          ════════════════════════════════════════ */}
          {step === 2 && (
            <View style={{ alignItems: 'center' }}>
              <TouchableOpacity onPress={pickPhoto} activeOpacity={0.9} style={s.photoBox}>
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                ) : (
                  <View style={{ alignItems: 'center', gap: 12 }}>
                    <View style={s.cameraIconWrap}>
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
                You can add more photos once you're in
              </Text>
            </View>
          )}

          {/* ════════════════════════════════════════
              STEP 3 — Birthday · Gender · Interested In
          ════════════════════════════════════════ */}
          {step === 3 && (
            <View>
              <DatePicker label="Date of Birth" value={birthdate} onChange={setBirthdate} placeholder="Tap to select" />

              <Text style={s.label}>I am a</Text>
              <View style={s.row}>
                {GENDER_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => setGender(opt.value as Gender)}
                    style={[s.chip, gender === opt.value && s.chipOn]}
                  >
                    <Text style={[s.chipTxt, gender === opt.value && s.chipTxtOn]}>{opt.label}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[s.label, { marginTop: 20 }]}>Interested in</Text>
              <View style={s.row}>
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

          {/* ════════════════════════════════════════
              STEP 4 — What are you looking for?
          ════════════════════════════════════════ */}
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
                      <Text style={[s.cardLabel, on && { color: COLORS.primary }]}>{opt.label}</Text>
                      <Text style={s.cardDesc}>{opt.desc}</Text>
                    </View>
                    <View style={[s.checkCircle, on && s.checkCircleOn]}>
                      {on && <Ionicons name="checkmark" size={14} color="#FFF" />}
                    </View>
                  </Pressable>
                );
              })}
              <Text style={s.hint}>You can pick more than one</Text>
            </View>
          )}

          {/* ════════════════════════════════════════
              STEP 5 — Location
          ════════════════════════════════════════ */}
          {step === 5 && (
            <LocationPicker value={location} onChange={setLocation} />
          )}

          {/* ── Buttons ── */}
          <View style={{ marginTop: 32, gap: 10 }}>
            <Button
              title={step === 5 ? 'Finish Setup 🎉' : 'Continue →'}
              onPress={goNext}
              fullWidth
              size="lg"
              loading={loading}
              disabled={!canProceed()}
            />
            {step === 2 && !photoUri && (
              <Button title="Skip — add a photo later" variant="ghost" onPress={() => setStep(step + 1)} fullWidth />
            )}
            {step === 4 && (
              <Button title="Skip for now" variant="ghost" onPress={() => setStep(step + 1)} fullWidth />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  // ── Header & progress ─────────────────────────────────────────────────────
  header:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 },
  backBtn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.savanna, alignItems: 'center', justifyContent: 'center' },
  counter:  { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  track:    { height: 5, backgroundColor: COLORS.border, marginHorizontal: 20, borderRadius: 3, marginBottom: 8 },
  fill:     { height: 5, backgroundColor: COLORS.primary, borderRadius: 3 },

  // ── Step hero ─────────────────────────────────────────────────────────────
  stepHero:  { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 16, alignSelf: 'center' },
  stepTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text, textAlign: 'center', marginBottom: 6 },
  stepSub:   { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 28 },

  // ── Form chips ────────────────────────────────────────────────────────────
  label:    { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  row:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip:     { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: '#FFF' },
  bigChip:  { flex: 1, paddingVertical: 16, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: '#FFF', alignItems: 'center' },
  chipOn:   { borderColor: COLORS.primary, backgroundColor: `${COLORS.primary}12` },
  chipTxt:  { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  chipTxtOn:{ color: COLORS.primary, fontWeight: '700' },

  // ── Looking for cards ─────────────────────────────────────────────────────
  card:         { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: '#FFF', gap: 14 },
  cardOn:       { borderColor: COLORS.primary, backgroundColor: `${COLORS.primary}08` },
  cardLabel:    { fontSize: 16, fontWeight: '700', color: COLORS.text },
  cardDesc:     { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  checkCircle:  { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  checkCircleOn:{ borderColor: COLORS.primary, backgroundColor: COLORS.primary },

  // ── Photo step ────────────────────────────────────────────────────────────
  photoBox:      { width: width * 0.6, height: width * 0.75, borderRadius: 28, backgroundColor: COLORS.savanna, borderWidth: 2, borderStyle: 'dashed', borderColor: COLORS.earthLight, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  cameraIconWrap:{ width: 72, height: 72, borderRadius: 36, backgroundColor: `${COLORS.primary}15`, alignItems: 'center', justifyContent: 'center' },
  hint:          { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },

  // ── Celebration screen ────────────────────────────────────────────────────
  celebContainer:  { flex: 1, padding: 28, justifyContent: 'center', alignItems: 'center' },
  celebCheck:      { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.success, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  celebTitle:      { fontSize: 32, fontWeight: '800', color: COLORS.text, marginBottom: 12 },
  celebSub:        { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  celebList:       { width: '100%', backgroundColor: COLORS.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.border },
  celebListTitle:  { fontSize: 12, fontWeight: '800', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 },
  celebItem:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  celebItemText:   { fontSize: 14, color: COLORS.textSecondary },
  celebFooter:     { paddingHorizontal: 28, paddingBottom: 32 },
});
