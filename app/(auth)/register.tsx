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
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { COLORS } from '@/constants';

export default function RegisterScreen() {
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleNext = () => {
    if (step === 1) {
      if (!fullName.trim() || !username.trim()) {
        Alert.alert('Error', 'Please fill in your name and username.');
        return;
      }
      setStep(2);
    }
  };

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (error) {
      Alert.alert('Registration Failed', error.message);
      return;
    }

    if (data.user) {
      router.replace({
        pathname: '/(auth)/onboarding',
        params: {
          userId: data.user.id,
          email,
          fullName,
          username,
        },
      });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={{ padding: 24 }}>
            <TouchableOpacity
              onPress={() => (step > 1 ? setStep(step - 1) : router.back())}
              style={{ marginBottom: 24 }}
            >
              <Ionicons name="arrow-back" size={24} color={COLORS.text} />
            </TouchableOpacity>

            {/* Progress */}
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 28 }}>
              {[1, 2].map((s) => (
                <View
                  key={s}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: s <= step ? COLORS.primary : COLORS.border,
                  }}
                />
              ))}
            </View>

            {step === 1 ? (
              <>
                <Text style={{ fontSize: 30, fontWeight: '800', color: COLORS.text, marginBottom: 8 }}>
                  Create account 🌍
                </Text>
                <Text style={{ fontSize: 15, color: COLORS.textSecondary, marginBottom: 36, lineHeight: 22 }}>
                  Join thousands of Africans finding love
                </Text>

                <Input
                  label="Full Name"
                  value={fullName}
                  onChangeText={setFullName}
                  leftIcon="person-outline"
                  placeholder="Your full name"
                  autoCapitalize="words"
                />

                <Input
                  label="Username"
                  value={username}
                  onChangeText={(t) => setUsername(t.toLowerCase().replace(/\s/g, ''))}
                  leftIcon="at-outline"
                  placeholder="yourname123"
                  autoCapitalize="none"
                />

                <Button title="Continue" onPress={handleNext} fullWidth size="lg" />
              </>
            ) : (
              <>
                <Text style={{ fontSize: 30, fontWeight: '800', color: COLORS.text, marginBottom: 8 }}>
                  Almost there! ✨
                </Text>
                <Text style={{ fontSize: 15, color: COLORS.textSecondary, marginBottom: 36, lineHeight: 22 }}>
                  Set up your login credentials
                </Text>

                <Input
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  leftIcon="mail-outline"
                  placeholder="your@email.com"
                />

                <Input
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  isPassword
                  leftIcon="lock-closed-outline"
                  placeholder="Min. 8 characters"
                />

                <Input
                  label="Confirm Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  isPassword
                  leftIcon="lock-closed-outline"
                  placeholder="Repeat your password"
                />

                <Button
                  title="Create Account"
                  onPress={handleRegister}
                  loading={loading}
                  fullWidth
                  size="lg"
                />
              </>
            )}

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24, gap: 4 }}>
              <Text style={{ color: COLORS.textSecondary, fontSize: 14 }}>Already have an account?</Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 14 }}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
