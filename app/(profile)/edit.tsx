import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth.store';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { LocationPicker, LocationValue } from '@/components/ui/LocationPicker';
import { SelectPicker } from '@/components/ui/SelectPicker';
import {
  COLORS,
  GENDER_OPTIONS,
  LOOKING_FOR_OPTIONS,
  RELIGION_OPTIONS,
  EDUCATION_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  WANT_CHILDREN_OPTIONS,
} from '@/constants';
import { Gender, InterestedIn, LookingFor, Religion, Education, MaritalStatus } from '@/types';

export default function EditProfileScreen() {
  const { user, updateProfile } = useAuthStore();
  if (!user) return null;

  const [fullName, setFullName]         = useState(user.full_name);
  const [bio, setBio]                   = useState(user.bio ?? '');
  const [gender, setGender]             = useState<Gender>(user.gender);
  const [interestedIn, setInterestedIn] = useState<InterestedIn>(user.interested_in);
  const [lookingFor, setLookingFor]     = useState<LookingFor[]>(user.looking_for);
  const [religion, setReligion]         = useState<Religion | null>(user.religion ?? null);
  const [education, setEducation]       = useState<Education | null>(user.education ?? null);
  const [maritalStatus, setMaritalStatus] = useState<MaritalStatus | null>(user.marital_status ?? null);
  const [heightCm, setHeightCm]         = useState<string>(user.height_cm ? String(user.height_cm) : '');
  const [ethnicity, setEthnicity]       = useState<string>(user.ethnicity ?? '');
  const [occupation, setOccupation]     = useState<string>(user.occupation ?? '');
  const [languages, setLanguages]       = useState<string>((user.languages ?? []).join(', '));
  const [hasChildren, setHasChildren]   = useState<boolean | null>(user.has_children ?? null);
  const [wantChildren, setWantChildren] = useState<string | null>(user.want_children ?? null);
  const [location, setLocation]         = useState<Partial<LocationValue>>({
    country: user.country || undefined,
    subdivision: user.state || undefined,
    city: user.city || undefined,
  });
  const [loading, setLoading]           = useState(false);

  const toggleLookingFor = (val: LookingFor) =>
    setLookingFor((prev) => prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]);

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Error', 'Full name is required.');
      return;
    }
    setLoading(true);
    const langArray = languages.trim()
      ? languages.split(',').map((l) => l.trim()).filter(Boolean)
      : [];

    try {
      await updateProfile({
        full_name: fullName.trim(),
        bio: bio.trim() || null,
        gender,
        interested_in: interestedIn,
        looking_for: lookingFor,
        religion: religion ?? null,
        education: education ?? null,
        marital_status: maritalStatus ?? null,
        height_cm: heightCm ? parseInt(heightCm, 10) : null,
        ethnicity: ethnicity.trim() || null,
        occupation: occupation.trim() || null,
        languages: langArray,
        has_children: hasChildren,
        want_children: wantChildren as import('@/types').WantChildren | null ?? null,
        country: location.country ?? user.country,
        state: location.subdivision ?? null,
        city: location.city ?? null,
      });
      Alert.alert('Saved ✓', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 14,
            backgroundColor: '#FFF',
            borderBottomWidth: 1,
            borderBottomColor: COLORS.border,
          }}
        >
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '700', color: COLORS.text }}>Edit Profile</Text>
          <Button title="Save" onPress={handleSave} loading={loading} size="sm" />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">

          {/* Name */}
          <Input label="Full Name" value={fullName} onChangeText={setFullName} leftIcon="person-outline" />

          {/* Bio */}
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text }}>Bio</Text>
              <Text style={{ fontSize: 12, color: bio.length > 450 ? COLORS.error : COLORS.textMuted }}>
                {bio.length}/500
              </Text>
            </View>
            <Input
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={4}
              style={{ height: 110, textAlignVertical: 'top', paddingTop: 12 }}
              placeholder="Tell people about yourself..."
              maxLength={500}
            />
          </View>

          {/* Gender */}
          <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 10 }}>I am a</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
            {GENDER_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setGender(opt.value as Gender)}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  alignItems: 'center',
                  borderColor: gender === opt.value ? COLORS.primary : COLORS.border,
                  backgroundColor: gender === opt.value ? `${COLORS.primary}10` : '#FFF',
                }}
              >
                <Text style={{
                  fontSize: 15,
                  fontWeight: gender === opt.value ? '700' : '500',
                  color: gender === opt.value ? COLORS.primary : COLORS.textSecondary,
                }}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Interested In */}
          <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 10, marginTop: 4 }}>Interested in</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
            {([
              { value: 'women',    label: 'Women',    emoji: '👩' },
              { value: 'men',      label: 'Men',      emoji: '👨' },
              { value: 'everyone', label: 'Everyone', emoji: '💫' },
            ] as { value: InterestedIn; label: string; emoji: string }[]).map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setInterestedIn(opt.value)}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  alignItems: 'center',
                  borderColor: interestedIn === opt.value ? COLORS.primary : COLORS.border,
                  backgroundColor: interestedIn === opt.value ? `${COLORS.primary}10` : '#FFF',
                }}
              >
                <Text style={{ fontSize: 18, marginBottom: 2 }}>{opt.emoji}</Text>
                <Text style={{
                  fontSize: 13,
                  fontWeight: interestedIn === opt.value ? '700' : '500',
                  color: interestedIn === opt.value ? COLORS.primary : COLORS.textSecondary,
                }}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Looking For */}
          <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 10 }}>Looking For</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {LOOKING_FOR_OPTIONS.map((opt) => {
              const on = lookingFor.includes(opt.value as LookingFor);
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => toggleLookingFor(opt.value as LookingFor)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 10,
                    borderWidth: 1.5,
                    borderColor: on ? COLORS.primary : COLORS.border,
                    backgroundColor: on ? `${COLORS.primary}10` : '#FFF',
                  }}
                >
                  <Text style={{ fontSize: 13, color: on ? COLORS.primary : COLORS.textSecondary, fontWeight: on ? '700' : '400' }}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Religion */}
          <SelectPicker
            label="Religion"
            placeholder="Select your religion..."
            options={RELIGION_OPTIONS}
            value={religion}
            onChange={(v) => setReligion(v as Religion | null)}
          />

          {/* Education */}
          <SelectPicker
            label="Highest Education"
            placeholder="Select education level..."
            options={EDUCATION_OPTIONS}
            value={education}
            onChange={(v) => setEducation(v as Education | null)}
          />

          {/* Marital Status */}
          <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 10 }}>Marital Status</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {MARITAL_STATUS_OPTIONS.map((opt) => {
              const on = maritalStatus === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setMaritalStatus(on ? null : opt.value as MaritalStatus)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 10,
                    borderWidth: 1.5,
                    borderColor: on ? COLORS.primary : COLORS.border,
                    backgroundColor: on ? `${COLORS.primary}10` : '#FFF',
                  }}
                >
                  <Text style={{ fontSize: 13, color: on ? COLORS.primary : COLORS.textSecondary, fontWeight: on ? '700' : '400' }}>
                    {opt.emoji} {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Height */}
          <Input
            label="Height (cm)"
            value={heightCm}
            onChangeText={(t) => setHeightCm(t.replace(/\D/g, ''))}
            keyboardType="numeric"
            leftIcon="resize-outline"
            placeholder="e.g. 170"
          />

          {/* Ethnicity */}
          <Input
            label="Ethnicity"
            value={ethnicity}
            onChangeText={setEthnicity}
            leftIcon="globe-outline"
            placeholder="e.g. Yoruba, Habesha, Zulu..."
          />

          {/* Occupation */}
          <Input
            label="Occupation"
            value={occupation}
            onChangeText={setOccupation}
            leftIcon="briefcase-outline"
            placeholder="e.g. Software Engineer"
          />

          {/* Languages */}
          <Input
            label="Languages spoken (comma-separated)"
            value={languages}
            onChangeText={setLanguages}
            leftIcon="language-outline"
            placeholder="e.g. Amharic, English, French"
          />

          {/* Has Children */}
          <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 10 }}>Do you have children?</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Yes', value: true },
              { label: 'No', value: false },
            ].map((opt) => (
              <Pressable
                key={String(opt.value)}
                onPress={() => setHasChildren(hasChildren === opt.value ? null : opt.value)}
                style={{
                  flex: 1,
                  paddingVertical: 13,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  alignItems: 'center',
                  borderColor: hasChildren === opt.value ? COLORS.primary : COLORS.border,
                  backgroundColor: hasChildren === opt.value ? `${COLORS.primary}10` : '#FFF',
                }}
              >
                <Text style={{
                  fontSize: 14,
                  fontWeight: hasChildren === opt.value ? '700' : '500',
                  color: hasChildren === opt.value ? COLORS.primary : COLORS.textSecondary,
                }}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Want Children */}
          <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 10 }}>Want children?</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {WANT_CHILDREN_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setWantChildren(wantChildren === opt.value ? null : opt.value)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 10,
                  borderWidth: 1.5,
                  borderColor: wantChildren === opt.value ? COLORS.primary : COLORS.border,
                  backgroundColor: wantChildren === opt.value ? `${COLORS.primary}10` : '#FFF',
                }}
              >
                <Text style={{
                  fontSize: 13,
                  fontWeight: wantChildren === opt.value ? '700' : '400',
                  color: wantChildren === opt.value ? COLORS.primary : COLORS.textSecondary,
                }}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Location */}
          <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 10 }}>Location</Text>
          <LocationPicker value={location} onChange={setLocation} />

          <View style={{ height: 20 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
