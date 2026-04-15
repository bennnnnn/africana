import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { COLORS } from '@/constants';
import { getValidationState, validateEmail, validatePassword } from '@/lib/validation';
import { appDialog } from '@/lib/app-dialog';

export default function RegisterScreen() {
  const { fetchProfile, fetchSettings } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [touched, setTouched] = useState<{ email: boolean; password: boolean }>({
    email: false,
    password: false,
  });
  const [loading, setLoading] = useState(false);
  const trimmedEmail = email.trim().toLowerCase();
  const emailValidation = validateEmail(email);
  const passwordValidation = validatePassword(password);
  const showEmailState = touched.email || attemptedSubmit;
  const showPasswordState = touched.password || attemptedSubmit;

  const handleRegister = async () => {
    setAttemptedSubmit(true);
    setTouched({ email: true, password: true });

    if (!emailValidation.valid || !passwordValidation.valid) {
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: { emailRedirectTo: 'africana://auth/callback' },
    });
    setLoading(false);

    if (error) {
      if (error.message.includes('rate') || error.message.includes('limit')) {
        appDialog({
          title: 'Too many attempts',
          message:
            "You've reached the email limit. Please wait 1 hour, or sign in with Google instead — it's instant.",
          icon: 'time-outline',
          actions: [
            { label: 'Sign in with Google', style: 'primary', onPress: () => router.replace('/(auth)/login') },
            { label: 'OK', style: 'cancel' },
          ],
        });
      } else if (error.message.includes('already')) {
        appDialog({
          title: 'Account exists',
          message: 'An account with this email already exists. Try signing in instead.',
          icon: 'person-outline',
          actions: [
            { label: 'Sign in', style: 'primary', onPress: () => router.replace('/(auth)/login') },
            { label: 'Cancel', style: 'cancel' },
          ],
        });
      } else {
        appDialog({ title: 'Registration failed', message: error.message, icon: 'alert-circle-outline' });
      }
      return;
    }

    if (data.user) {
      router.replace({
        pathname: '/(auth)/onboarding',
        params: { userId: data.user.id, email: trimmedEmail },
      });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, paddingBottom: 36 }} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
          </TouchableOpacity>

          <View style={s.hero}>
            <Text style={s.title}>Create account</Text>
            <Text style={s.subtitle}>Set up your account and continue into onboarding.</Text>
          </View>

          <Input
            label="Email"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              if (!touched.email) setTouched((current) => ({ ...current, email: true }));
            }}
            onBlur={() => setTouched((current) => ({ ...current, email: true }))}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon="mail-outline"
            placeholder="your@email.com"
            validationState={getValidationState(showEmailState, emailValidation, Boolean(trimmedEmail))}
            error={showEmailState ? emailValidation.message : undefined}
          />
          <Input
            label="Password"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              if (!touched.password) setTouched((current) => ({ ...current, password: true }));
            }}
            onBlur={() => setTouched((current) => ({ ...current, password: true }))}
            isPassword
            leftIcon="lock-closed-outline"
            placeholder="Min. 6 characters"
            validationState={getValidationState(showPasswordState, passwordValidation, Boolean(password))}
            error={showPasswordState ? passwordValidation.message : undefined}
          />

          <Button
            title="Create Account"
            onPress={handleRegister}
            loading={loading}
            fullWidth
            size="lg"
          />

          <View style={s.signinRow}>
            <Text style={{ color: COLORS.textSecondary, fontSize: 14 }}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 14 }}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  hero: { marginBottom: 20 },
  title: { fontSize: 32, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  subtitle: { fontSize: 15, color: COLORS.textSecondary, lineHeight: 22, marginBottom: 24 },
  signinRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
});
