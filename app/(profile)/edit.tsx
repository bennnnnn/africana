import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { COLORS, AFRICAN_COUNTRIES, GENDER_OPTIONS, LOOKING_FOR_OPTIONS } from '@/constants';
import { Gender, LookingFor } from '@/types';

export default function EditProfileScreen() {
  const { user, updateProfile } = useAuthStore();
  if (!user) return null;

  const [fullName, setFullName] = useState(user.full_name);
  const [username, setUsername] = useState(user.username);
  const [bio, setBio] = useState(user.bio ?? '');
  const [country, setCountry] = useState(user.country);
  const [state, setState] = useState(user.state ?? '');
  const [city, setCity] = useState(user.city ?? '');
  const [gender, setGender] = useState<Gender>(user.gender);
  const [lookingFor, setLookingFor] = useState<LookingFor[]>(user.looking_for);
  const [loading, setLoading] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  const toggleLookingFor = (val: LookingFor) => {
    setLookingFor((prev) => prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]);
  };

  const filteredCountries = AFRICAN_COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Error', 'Full name is required.');
      return;
    }

    setLoading(true);
    await updateProfile({
      full_name: fullName,
      username,
      bio: bio || null,
      country,
      state: state || null,
      city: city || null,
      gender,
      looking_for: lookingFor,
    });
    setLoading(false);
    Alert.alert('Saved', 'Your profile has been updated.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 14,
            backgroundColor: '#FFFFFF',
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

        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          <Input label="Full Name" value={fullName} onChangeText={setFullName} leftIcon="person-outline" />
          <Input
            label="Username"
            value={username}
            onChangeText={(t) => setUsername(t.toLowerCase().replace(/\s/g, ''))}
            leftIcon="at-outline"
            autoCapitalize="none"
          />

          <Input
            label="Bio"
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={4}
            style={{ height: 110, textAlignVertical: 'top', paddingTop: 12 }}
            placeholder="Tell people about yourself..."
            maxLength={500}
          />

          {/* Gender */}
          <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 10 }}>Gender</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {GENDER_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setGender(opt.value as Gender)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 10,
                  borderWidth: 1.5,
                  borderColor: gender === opt.value ? COLORS.primary : COLORS.border,
                  backgroundColor: gender === opt.value ? `${COLORS.primary}10` : '#FFF',
                }}
              >
                <Text style={{ fontSize: 13, color: gender === opt.value ? COLORS.primary : COLORS.textSecondary, fontWeight: gender === opt.value ? '700' : '400' }}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Looking For */}
          <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 10 }}>Looking For</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {LOOKING_FOR_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => toggleLookingFor(opt.value as LookingFor)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 10,
                  borderWidth: 1.5,
                  borderColor: lookingFor.includes(opt.value as LookingFor) ? COLORS.primary : COLORS.border,
                  backgroundColor: lookingFor.includes(opt.value as LookingFor) ? `${COLORS.primary}10` : '#FFF',
                }}
              >
                <Text style={{ fontSize: 13, color: lookingFor.includes(opt.value as LookingFor) ? COLORS.primary : COLORS.textSecondary, fontWeight: lookingFor.includes(opt.value as LookingFor) ? '700' : '400' }}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Location */}
          <Input
            label="Search Country"
            value={countrySearch}
            onChangeText={setCountrySearch}
            leftIcon="search-outline"
            placeholder="Search country..."
          />

          {countrySearch.length > 0 && (
            <View style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, marginTop: -12, marginBottom: 16, overflow: 'hidden' }}>
              {filteredCountries.slice(0, 6).map((c) => (
                <TouchableOpacity
                  key={c.code}
                  onPress={() => { setCountry(c.name); setCountrySearch(''); }}
                  style={{
                    padding: 13,
                    borderBottomWidth: 1,
                    borderBottomColor: COLORS.border,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    backgroundColor: country === c.name ? `${COLORS.primary}08` : '#FFF',
                  }}
                >
                  <Text style={{ fontSize: 14, color: COLORS.text }}>{c.name}</Text>
                  {country === c.name && <Ionicons name="checkmark" size={16} color={COLORS.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {country !== '' && (
            <View style={{ marginBottom: 16, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: `${COLORS.primary}10`, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="location" size={16} color={COLORS.primary} />
              <Text style={{ fontSize: 14, color: COLORS.primary, fontWeight: '600' }}>{country}</Text>
            </View>
          )}

          <Input label="State / Region" value={state} onChangeText={setState} leftIcon="map-outline" placeholder="Optional" />
          <Input label="City" value={city} onChangeText={setCity} leftIcon="business-outline" placeholder="Optional" />

          <View style={{ height: 20 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
