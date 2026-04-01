import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { COLORS, AFRICAN_COUNTRIES, GENDER_OPTIONS, LOOKING_FOR_OPTIONS } from '@/constants';
import { Gender, LookingFor } from '@/types';

const TOTAL_STEPS = 5;

export default function OnboardingScreen() {
  const params = useLocalSearchParams<{ userId: string; email: string; fullName: string; username: string }>();

  const [step, setStep] = useState(1);
  const [birthdate, setBirthdate] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [lookingFor, setLookingFor] = useState<LookingFor[]>([]);
  const [country, setCountry] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleLookingFor = (value: LookingFor) => {
    setLookingFor((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (uri: string): Promise<string | null> => {
    try {
      const fileName = `${params.userId}/${Date.now()}.jpg`;
      const response = await fetch(uri);
      const blob = await response.blob();

      const { error } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, { contentType: 'image/jpeg' });

      if (error) return null;

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      return data.publicUrl;
    } catch {
      return null;
    }
  };

  const handleFinish = async () => {
    if (!gender || !country || !birthdate) {
      Alert.alert('Error', 'Please complete all required fields.');
      return;
    }

    setLoading(true);
    try {
      let avatarUrl: string | null = null;
      if (photoUri) {
        avatarUrl = await uploadPhoto(photoUri);
      }

      const { error } = await supabase.from('profiles').insert({
        id: params.userId,
        email: params.email,
        full_name: params.fullName,
        username: params.username,
        birthdate,
        gender,
        looking_for: lookingFor,
        country,
        state: state || null,
        city: city || null,
        bio: bio || null,
        avatar_url: avatarUrl,
        profile_photos: avatarUrl ? [avatarUrl] : [],
      });

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      router.replace('/(tabs)/discover');
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    if (step === 1) return birthdate.length === 10 && gender !== null;
    if (step === 2) return lookingFor.length > 0;
    if (step === 3) return country !== '';
    return true;
  };

  const stepTitles = [
    'About you',
    'What are you looking for?',
    'Where are you located?',
    'Tell your story',
    'Add your photo',
  ];

  const stepSubtitles = [
    'Let\'s start with the basics',
    'Help others know your intentions',
    'Connect with people near you',
    'A good bio attracts better matches',
    'Profiles with photos get 6x more attention',
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={{ padding: 24, paddingBottom: 0 }}>
          {/* Progress */}
          <View style={{ flexDirection: 'row', gap: 5, marginBottom: 28 }}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: i < step ? COLORS.primary : COLORS.border,
                }}
              />
            ))}
          </View>

          <Text style={{ fontSize: 26, fontWeight: '800', color: COLORS.text, marginBottom: 6 }}>
            {stepTitles[step - 1]}
          </Text>
          <Text style={{ fontSize: 14, color: COLORS.textSecondary, marginBottom: 28 }}>
            {stepSubtitles[step - 1]}
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 0 }} keyboardShouldPersistTaps="handled">
          {step === 1 && (
            <>
              <Input
                label="Date of Birth"
                value={birthdate}
                onChangeText={(t) => {
                  const digits = t.replace(/\D/g, '').slice(0, 8);
                  let formatted = digits;
                  if (digits.length > 4) formatted = `${digits.slice(0, 4)}-${digits.slice(4)}`;
                  if (digits.length > 6) formatted = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
                  setBirthdate(formatted);
                }}
                placeholder="YYYY-MM-DD"
                keyboardType="numeric"
                leftIcon="calendar-outline"
                maxLength={10}
              />

              <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 12 }}>
                I am a...
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {GENDER_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => setGender(opt.value as Gender)}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 12,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      borderColor: gender === opt.value ? COLORS.primary : COLORS.border,
                      backgroundColor: gender === opt.value ? `${COLORS.primary}12` : '#FFFFFF',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: gender === opt.value ? '700' : '400',
                        color: gender === opt.value ? COLORS.primary : COLORS.textSecondary,
                      }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {step === 2 && (
            <View style={{ gap: 10 }}>
              {LOOKING_FOR_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => toggleLookingFor(opt.value as LookingFor)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 16,
                    borderRadius: 14,
                    borderWidth: 1.5,
                    borderColor: lookingFor.includes(opt.value as LookingFor) ? COLORS.primary : COLORS.border,
                    backgroundColor: lookingFor.includes(opt.value as LookingFor) ? `${COLORS.primary}10` : '#FFFFFF',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: lookingFor.includes(opt.value as LookingFor) ? '700' : '400',
                      color: lookingFor.includes(opt.value as LookingFor) ? COLORS.primary : COLORS.text,
                    }}
                  >
                    {opt.label}
                  </Text>
                  {lookingFor.includes(opt.value as LookingFor) && (
                    <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                  )}
                </Pressable>
              ))}
            </View>
          )}

          {step === 3 && (
            <>
              <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8, textTransform: 'uppercase' }}>
                Country *
              </Text>
              <ScrollView
                style={{ maxHeight: 240, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, marginBottom: 16 }}
                nestedScrollEnabled
              >
                {AFRICAN_COUNTRIES.map((c) => (
                  <TouchableOpacity
                    key={c.code}
                    onPress={() => setCountry(c.name)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 13,
                      borderBottomWidth: 1,
                      borderBottomColor: COLORS.border,
                      backgroundColor: country === c.name ? `${COLORS.primary}10` : '#FFFFFF',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text style={{ fontSize: 15, color: country === c.name ? COLORS.primary : COLORS.text, fontWeight: country === c.name ? '600' : '400' }}>
                      {c.name}
                    </Text>
                    {country === c.name && <Ionicons name="checkmark" size={18} color={COLORS.primary} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Input
                label="State / Region (optional)"
                value={state}
                onChangeText={setState}
                placeholder="e.g. Lagos, Nairobi, Addis Ababa"
                leftIcon="map-outline"
              />

              <Input
                label="City (optional)"
                value={city}
                onChangeText={setCity}
                placeholder="Your city"
                leftIcon="business-outline"
              />
            </>
          )}

          {step === 4 && (
            <Input
              label="Bio"
              value={bio}
              onChangeText={setBio}
              placeholder="Tell people a bit about yourself. What do you enjoy? What are you passionate about?"
              multiline
              numberOfLines={6}
              style={{ height: 140, textAlignVertical: 'top', paddingTop: 12 }}
              maxLength={500}
            />
          )}

          {step === 5 && (
            <View style={{ alignItems: 'center', gap: 20 }}>
              <TouchableOpacity onPress={pickPhoto}>
                <View
                  style={{
                    width: 200,
                    height: 240,
                    borderRadius: 24,
                    backgroundColor: COLORS.savanna,
                    borderWidth: 2,
                    borderColor: photoUri ? COLORS.primary : COLORS.border,
                    borderStyle: photoUri ? 'solid' : 'dashed',
                    overflow: 'hidden',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {photoUri ? (
                    <Image source={{ uri: photoUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  ) : (
                    <View style={{ alignItems: 'center', gap: 12 }}>
                      <Ionicons name="camera-outline" size={40} color={COLORS.earth} />
                      <Text style={{ fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' }}>
                        Tap to add{'\n'}your photo
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              {photoUri && (
                <TouchableOpacity onPress={pickPhoto}>
                  <Text style={{ color: COLORS.primary, fontWeight: '600', fontSize: 14 }}>Change photo</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={{ marginTop: 32, gap: 12 }}>
            <Button
              title={step < TOTAL_STEPS ? 'Continue' : 'Finish Setup'}
              onPress={step < TOTAL_STEPS ? () => setStep(step + 1) : handleFinish}
              fullWidth
              size="lg"
              loading={loading}
              disabled={!canProceed() && step <= 3}
            />
            {step < TOTAL_STEPS && (
              <Button
                title="Skip for now"
                variant="ghost"
                onPress={() => setStep(step + 1)}
                fullWidth
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
