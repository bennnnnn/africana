import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Alert,
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
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { LocationPicker, LocationValue } from '@/components/ui/LocationPicker';
import { SelectPicker } from '@/components/ui/SelectPicker';
import {
  COLORS,
  GENDER_OPTIONS,
  RELIGION_OPTIONS,
  EDUCATION_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  WANT_CHILDREN_OPTIONS,
} from '@/constants';
import { Gender, InterestedIn, LookingFor, Religion, Education, MaritalStatus, WantChildren } from '@/types';

const { width } = Dimensions.get('window');
const TOTAL_STEPS = 7;

const STEPS = [
  { emoji: '👤', title: "What's your name?",         subtitle: 'This is how others will know you',                    bg: '#FFF3E0' },
  { emoji: '🎂', title: 'Tell us about yourself',    subtitle: 'Help others understand who you are',                  bg: '#E8F5E9' },
  { emoji: '💞', title: 'What are you looking for?', subtitle: 'Be honest — the right match is out there',            bg: '#FCE4EC' },
  { emoji: '🌿', title: 'Your background',           subtitle: 'Helps us find truly compatible matches',              bg: '#E3F2FD' },
  { emoji: '👨‍👩‍👧', title: 'Family & lifestyle',      subtitle: 'A little about your life outside work',             bg: '#F3E5F5' },
  { emoji: '📍', title: 'Where do you live?',        subtitle: 'Your location helps people near you find you',        bg: '#E0F7FA' },
  { emoji: '📸', title: 'Add your best photo',       subtitle: 'Profiles with a photo get 6× more attention',         bg: '#FFF8E1' },
];

const INTEREST_OPTIONS: { value: InterestedIn; label: string; emoji: string }[] = [
  { value: 'women',    label: 'Women',    emoji: '👩' },
  { value: 'men',      label: 'Men',      emoji: '👨' },
  { value: 'everyone', label: 'Everyone', emoji: '💫' },
];

const LOOKING_FOR_OPTS = [
  { value: 'relationship', emoji: '💑', label: 'Relationship',  desc: 'A deep, meaningful connection' },
  { value: 'marriage',     emoji: '💍', label: 'Marriage',      desc: 'Serious, long-term commitment' },
  { value: 'friendship',   emoji: '🤝', label: 'Friendship',    desc: 'Friends first, see what happens' },
  { value: 'pen_pal',      emoji: '✉️', label: 'Pen Pal',       desc: 'Chat, share stories, connect' },
];

function ChipSelect({
  label, options, value, onSelect,
}: {
  label: string;
  options: { value: string; label: string; emoji?: string }[];
  value: string | null;
  onSelect: (v: string | null) => void;
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
              style={[s.chip, on && s.chipOn]}
            >
              <Text style={[s.chipTxt, on && s.chipTxtOn]}>
                {opt.emoji ? `${opt.emoji} ` : ''}{opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
  const params = useLocalSearchParams<{ userId: string; email: string }>();

  const [step, setStep] = useState(1);

  // Step 1
  const [fullName, setFullName] = useState('');

  // Step 2
  const [birthdate, setBirthdate]       = useState<Date | null>(null);
  const [gender, setGender]             = useState<Gender | null>(null);
  const [interestedIn, setInterestedIn] = useState<InterestedIn | null>(null);

  // Step 3
  const [lookingFor, setLookingFor] = useState<LookingFor[]>([]);
  const toggleLookingFor = (val: LookingFor) =>
    setLookingFor((p) => p.includes(val) ? p.filter((v) => v !== val) : [...p, val]);

  // Step 4 — background
  const [religion, setReligion]           = useState<Religion | null>(null);
  const [education, setEducation]         = useState<Education | null>(null);
  const [maritalStatus, setMaritalStatus] = useState<MaritalStatus | null>(null);
  const [ethnicity, setEthnicity]         = useState('');
  const [occupation, setOccupation]       = useState('');

  // Step 5 — lifestyle
  const [heightCm, setHeightCm]         = useState('');
  const [languages, setLanguages]       = useState('');
  const [hasChildren, setHasChildren]   = useState<boolean | null>(null);
  const [wantChildren, setWantChildren] = useState<WantChildren | null>(null);

  // Step 6
  const [location, setLocation] = useState<Partial<LocationValue>>({});

  // Step 7
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

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
    try {
      const fileName = `${params.userId}/${Date.now()}.jpg`;
      const res  = await fetch(uri);
      const blob = await res.blob();
      const { error } = await supabase.storage.from('avatars').upload(fileName, blob, { contentType: 'image/jpeg' });
      if (error) return null;
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      return data.publicUrl;
    } catch { return null; }
  };

  const handleFinish = async () => {
    if (!params.userId || !params.email) {
      Alert.alert('Session error', 'Please go back and try again.');
      return;
    }
    if (!fullName.trim()) { Alert.alert('Missing name', 'Please enter your full name.'); return; }
    if (!birthdate || !gender || !interestedIn) { Alert.alert('Incomplete', 'Please complete step 2.'); return; }
    if (!location.country) { Alert.alert('Missing location', 'Please select your country.'); return; }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) await supabase.auth.refreshSession();

      let avatarUrl: string | null = null;
      if (photoUri) {
        avatarUrl = await uploadPhoto(photoUri);
        if (!avatarUrl) {
          Alert.alert('Photo upload failed', 'We could not upload your photo. You can add it later in your profile.');
        }
      }

      const base = params.email.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase();
      const username = `${base}${Math.floor(Math.random() * 9000) + 1000}`;

      const { error } = await supabase.from('profiles').insert({
        id: params.userId,
        email: params.email,
        full_name: fullName.trim(),
        username,
        birthdate: birthdate.toISOString().split('T')[0],
        gender,
        interested_in: interestedIn,
        looking_for: lookingFor,
        country: location.country || '',
        state: location.subdivision || null,
        city: location.city || null,
        religion: religion ?? null,
        education: education ?? null,
        marital_status: maritalStatus ?? null,
        ethnicity: ethnicity.trim() || null,
        occupation: occupation.trim() || null,
        height_cm: heightCm ? parseInt(heightCm, 10) : null,
        languages: languages ? languages.split(',').map((l) => l.trim()).filter(Boolean) : [],
        has_children: hasChildren,
        want_children: wantChildren ?? null,
        avatar_url: avatarUrl,
        profile_photos: avatarUrl ? [avatarUrl] : [],
      });

      if (error) {
        if (error.message.includes('security policy') || error.code === '42501') {
          Alert.alert('One more step', 'Go to Supabase → Authentication → Email → turn OFF "Confirm email" → Save. Then try again.');
        } else {
          Alert.alert('Error', error.message);
        }
        return;
      }
      router.replace('/(tabs)/discover');
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    if (step === 1) return fullName.trim().length >= 2;
    if (step === 2) return birthdate !== null && gender !== null && interestedIn !== null;
    if (step === 3) return lookingFor.length > 0;
    if (step === 4) return true;
    if (step === 5) return true;
    if (step === 6) return !!location.country;
    return true;
  };

  const goNext = () => step < TOTAL_STEPS ? setStep(step + 1) : handleFinish();
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

        {/* ── Progress bar ── */}
        <View style={s.track}>
          <View style={[s.fill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
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
              onChangeText={setFullName}
              placeholder="e.g. Amara Osei"
              autoCapitalize="words"
              leftIcon="person-outline"
              autoFocus
            />
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
                  <Pressable key={opt.value} onPress={() => setGender(opt.value as Gender)} style={[s.chip, gender === opt.value && s.chipOn]}>
                    <Text style={[s.chipTxt, gender === opt.value && s.chipTxtOn]}>{opt.label}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[s.label, { marginTop: 20 }]}>Interested in</Text>
              <View style={s.row}>
                {INTEREST_OPTIONS.map((opt) => (
                  <Pressable key={opt.value} onPress={() => setInterestedIn(opt.value)} style={[s.bigChip, interestedIn === opt.value && s.chipOn]}>
                    <Text style={{ fontSize: 26, marginBottom: 6 }}>{opt.emoji}</Text>
                    <Text style={[s.chipTxt, interestedIn === opt.value && s.chipTxtOn]}>{opt.label}</Text>
                  </Pressable>
                ))}
              </View>
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
              STEP 4 — Background (optional)
          ════════════════════════════════════════ */}
          {step === 4 && (
            <View>
              <SelectPicker
                label="Religion"
                placeholder="Select your religion..."
                options={RELIGION_OPTIONS}
                value={religion}
                onChange={(v) => setReligion(v as Religion | null)}
              />
              <SelectPicker
                label="Education"
                placeholder="Highest level of education..."
                options={EDUCATION_OPTIONS}
                value={education}
                onChange={(v) => setEducation(v as Education | null)}
              />
              <ChipSelect
                label="Marital Status"
                options={MARITAL_STATUS_OPTIONS}
                value={maritalStatus}
                onSelect={(v) => setMaritalStatus(v as MaritalStatus | null)}
              />
              <Input
                label="Ethnicity"
                value={ethnicity}
                onChangeText={setEthnicity}
                placeholder="e.g. Yoruba, Amhara, Zulu..."
                leftIcon="people-outline"
              />
              <Input
                label="Occupation"
                value={occupation}
                onChangeText={setOccupation}
                placeholder="e.g. Engineer, Teacher, Doctor..."
                leftIcon="briefcase-outline"
              />
              <Text style={[s.hint, { marginTop: 4 }]}>All fields on this step are optional</Text>
            </View>
          )}

          {/* ════════════════════════════════════════
              STEP 5 — Lifestyle (optional)
          ════════════════════════════════════════ */}
          {step === 5 && (
            <View>
              <Input
                label="Height (cm)"
                value={heightCm}
                onChangeText={setHeightCm}
                placeholder="e.g. 175"
                keyboardType="numeric"
                leftIcon="resize-outline"
              />
              <Input
                label="Languages spoken"
                value={languages}
                onChangeText={setLanguages}
                placeholder="e.g. English, Amharic, French"
                leftIcon="chatbubbles-outline"
              />
              <Text style={s.hint}>Separate with commas</Text>

              <ChipSelect
                label="Do you have children?"
                options={[
                  { value: 'true',  label: 'Yes', emoji: '👧' },
                  { value: 'false', label: 'No',  emoji: '🚫' },
                ]}
                value={hasChildren === null ? null : String(hasChildren)}
                onSelect={(v) => setHasChildren(v === null ? null : v === 'true')}
              />

              <ChipSelect
                label="Do you want children?"
                options={WANT_CHILDREN_OPTIONS}
                value={wantChildren}
                onSelect={(v) => setWantChildren(v as WantChildren | null)}
              />

              <Text style={[s.hint, { marginTop: 4 }]}>All fields on this step are optional</Text>
            </View>
          )}

          {/* ════════════════════════════════════════
              STEP 6 — Location
          ════════════════════════════════════════ */}
          {step === 6 && (
            <LocationPicker value={location} onChange={setLocation} />
          )}

          {/* ════════════════════════════════════════
              STEP 7 — Photo
          ════════════════════════════════════════ */}
          {step === 7 && (
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
            {(step === 4 || step === 5) && (
              <Button title="Skip for now" variant="ghost" onPress={() => setStep(step + 1)} fullWidth />
            )}
            {step === TOTAL_STEPS && !photoUri && (
              <Button title="Skip photo for now" variant="ghost" onPress={handleFinish} fullWidth loading={loading} />
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
  stepHero:   { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 16, alignSelf: 'center' },
  stepTitle:  { fontSize: 24, fontWeight: '800', color: COLORS.text, textAlign: 'center', marginBottom: 6 },
  stepSub:    { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  label:      { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  row:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip:       { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: '#FFF' },
  bigChip:    { flex: 1, paddingVertical: 16, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: '#FFF', alignItems: 'center' },
  chipOn:     { borderColor: COLORS.primary, backgroundColor: `${COLORS.primary}12` },
  chipTxt:    { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  chipTxtOn:  { color: COLORS.primary, fontWeight: '700' },
  card:       { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: '#FFF', gap: 14 },
  cardOn:     { borderColor: COLORS.primary, backgroundColor: `${COLORS.primary}08` },
  cardLabel:  { fontSize: 16, fontWeight: '700', color: COLORS.text },
  cardDesc:   { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  checkCircle:  { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  checkCircleOn:{ borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  hint:       { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  photoBox:   { width: width * 0.6, height: width * 0.75, borderRadius: 28, backgroundColor: COLORS.savanna, borderWidth: 2, borderStyle: 'dashed', borderColor: COLORS.earthLight, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
