import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { signInWithGoogle } from '@/lib/google-auth';
import { useAuthStore } from '@/store/auth.store';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { COLORS } from '@/constants';
import { getValidationState, validateEmail } from '@/lib/validation';
import { isProfileCompleteForDiscover, onboardingHrefFromSession } from '@/lib/profile-completion';
import { appDialog } from '@/lib/app-dialog';

export default function LoginScreen() {
  const { fetchProfile, fetchSettings } = useAuthStore();
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [touched, setTouched] = useState<{ email: boolean; password: boolean }>({
    email: false,
    password: false,
  });
  const [loading, setLoading]   = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const emailValidation = validateEmail(email);
  const passwordValidation = password
    ? { valid: true as const }
    : { valid: false as const, message: 'Password is required.' };
  const normalizedEmail = email.trim().toLowerCase();
  const showEmailState = touched.email || attemptedSubmit;
  const showPasswordState = touched.password || attemptedSubmit;
  const handleLogin = async () => {
    setAttemptedSubmit(true);
    setTouched({ email: true, password: true });
    if (!emailValidation.valid || !passwordValidation.valid) {
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    setLoading(false);
    if (error) {
      appDialog({ title: 'Sign in failed', message: error.message, icon: 'alert-circle-outline' });
      return;
    }
    const session = data.session;
    if (!session?.user) {
      appDialog({
        title: 'Check your email',
        message: 'Confirm your email address, then sign in again.',
        icon: 'mail-outline',
      });
      return;
    }
    await fetchProfile(session.user.id);
    await fetchSettings(session.user.id);
    const { user } = useAuthStore.getState();
    if (isProfileCompleteForDiscover(user)) {
      router.replace('/(tabs)/discover');
    } else {
      router.replace(onboardingHrefFromSession(session));
    }
  };

  const handleForgotPassword = () => {
    router.push('/(auth)/forgot-password');
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      const session = await signInWithGoogle();
      if (session?.user) {
        await fetchProfile(session.user.id);
        await fetchSettings(session.user.id);
        const { user } = useAuthStore.getState();
        if (isProfileCompleteForDiscover(user)) {
          router.replace('/(tabs)/discover');
        } else {
          router.replace(onboardingHrefFromSession(session));
        }
      }
    } catch (e: any) {
      if (e?.message !== 'User cancelled') {
        appDialog({
          title: 'Google sign-in failed',
          message: e?.message ?? 'Please try again.',
          icon: 'logo-google',
        });
      }
    } finally {
      setGoogleLoading(false);
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
            <Text style={s.title}>Welcome back</Text>
            <Text style={s.subtitle}>Sign in to continue where you left off.</Text>
          </View>

          <TouchableOpacity style={s.googleBtn} onPress={handleGoogle} disabled={googleLoading} activeOpacity={0.85}>
            {googleLoading ? (
              <ActivityIndicator size="small" color="#4285F4" />
            ) : (
              <>
                <Text style={{ fontSize: 22, fontWeight: '900', color: '#4285F4' }}>G</Text>
                <Text style={s.googleBtnText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>or</Text>
            <View style={s.dividerLine} />
          </View>

          {!showEmailForm ? (
            <TouchableOpacity style={s.emailBtn} onPress={() => setShowEmailForm(true)} activeOpacity={0.85}>
              <Ionicons name="mail-outline" size={20} color="#FFF" />
              <Text style={s.emailBtnText}>Continue with Email</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.emailForm}>
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
                validationState={getValidationState(showEmailState, emailValidation, Boolean(normalizedEmail))}
                error={showEmailState ? emailValidation.message : undefined}
                autoFocus
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
                placeholder="Your password"
                validationState={getValidationState(showPasswordState, passwordValidation, Boolean(password))}
                error={showPasswordState ? passwordValidation.message : undefined}
              />
              <TouchableOpacity
                style={{ alignSelf: 'flex-end', marginTop: -8, marginBottom: 20 }}
                onPress={handleForgotPassword}
              >
                <Text style={{ color: COLORS.primary, fontWeight: '600', fontSize: 14 }}>
                  Forgot password?
                </Text>
              </TouchableOpacity>
              <Button title="Sign In" onPress={handleLogin} loading={loading} fullWidth size="lg" />
            </View>
          )}

          <View style={s.signupRow}>
            <Text style={{ color: COLORS.textSecondary, fontSize: 14 }}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 14 }}>Sign Up</Text>
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
  hero:     { marginBottom: 24 },
  title:    { fontSize: 32, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  subtitle: { fontSize: 15, color: COLORS.textSecondary, lineHeight: 22 },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    height: 56,
    borderWidth: 1,
    borderColor: '#DADCE0',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  googleBtnText: { fontSize: 16, fontWeight: '600', color: '#3C4043' },
  emailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    height: 56,
    marginBottom: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  emailBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  emailForm: { marginTop: 4 },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
});
