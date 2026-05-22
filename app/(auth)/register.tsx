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
import { signInWithApple } from '@/lib/apple-auth';
import { useAuthStore } from '@/store/auth.store';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AuthLegalConsentRow } from '@/components/auth/AuthLegalConsentRow';
import { COLORS } from '@/constants';
import {
  getValidationState,
  MIN_PASSWORD_LENGTH,
  validateEmail,
  validatePassword,
} from '@/lib/validation';
import { redirectAfterAuth } from '@/lib/profile-completion';
import { appDialog } from '@/lib/app-dialog';

export default function RegisterScreen() {
  const hydrateUserFromServer = useAuthStore((s) => s.hydrateUserFromServer);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [touched, setTouched] = useState<{ email: boolean; password: boolean }>({
    email: false,
    password: false,
  });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const trimmedEmail = email.trim().toLowerCase();
  const emailValidation = validateEmail(email);
  const passwordValidation = validatePassword(password);
  const showEmailState = touched.email || attemptedSubmit;
  const showPasswordState = touched.password || attemptedSubmit;

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      const session = await signInWithGoogle();
      if (session?.user) {
        await hydrateUserFromServer(session.user.id);
        const { user } = useAuthStore.getState();
        redirectAfterAuth(router, user, session);
      }
    } catch (e: any) {
      if (e?.message !== 'User cancelled') {
        appDialog({
          title: 'Google sign-up failed',
          message: e?.message ?? 'Please try again.',
          icon: 'logo-google',
        });
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleApple = async () => {
    setAppleLoading(true);
    try {
      const session = await signInWithApple();
      if (session?.user) {
        await hydrateUserFromServer(session.user.id);
        const { user } = useAuthStore.getState();
        redirectAfterAuth(router, user, session);
      }
    } catch (e: any) {
      if (e?.message !== 'User cancelled') {
        appDialog({
          title: 'Apple sign-up failed',
          message: e?.message ?? 'Please try again.',
          icon: 'logo-apple',
        });
      }
    } finally {
      setAppleLoading(false);
    }
  };

  const handleRegister = async () => {
    setAttemptedSubmit(true);
    setTouched({ email: true, password: true });

    if (!emailValidation.valid || !passwordValidation.valid) {
      return;
    }
    if (!termsAccepted) {
      appDialog({
        title: 'Please accept the Terms',
        message:
          'You need to agree to the Terms of Service and Privacy Policy to create an account.',
        icon: 'document-text-outline',
      });
      return;
    }

    setLoading(true);
    const acceptedAt = new Date().toISOString();
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        emailRedirectTo: 'africana://auth/callback',
        data: { terms_accepted_at: acceptedAt },
      },
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
            {
              label: 'Sign in with Google',
              style: 'primary',
              onPress: () => router.replace('/(auth)/login'),
            },
            { label: 'OK', style: 'cancel' },
          ],
        });
      } else if (error.message.includes('already')) {
        appDialog({
          title: 'Couldn’t create account',
          message:
            'This email may already be in use. Try signing in, or use Forgot password on the sign-in screen.',
          icon: 'person-outline',
          actions: [
            {
              label: 'Go to sign in',
              style: 'primary',
              onPress: () => router.replace('/(auth)/login'),
            },
            { label: 'Close', style: 'cancel' },
          ],
        });
      } else {
        appDialog({
          title: 'Registration failed',
          message: error.message,
          icon: 'alert-circle-outline',
        });
      }
      return;
    }

    // Email confirmation required: user created but no session yet.
    if (data.user && !data.session) {
      appDialog({
        title: 'Check your inbox',
        message: `We sent a confirmation link to ${trimmedEmail}. Open it to activate your account, then sign in.`,
        icon: 'mail-open-outline',
        actions: [
          {
            label: 'Go to sign in',
            style: 'primary',
            onPress: () => router.replace('/(auth)/login'),
          },
          { label: 'OK', style: 'cancel' },
        ],
      });
      return;
    }

    if (!data.user || !data.session?.user) {
      appDialog({
        title: 'Email sign-up unavailable',
        message:
          'We could not start your account session. Please try again or continue with Google.',
        icon: 'alert-circle-outline',
      });
      return;
    }

    router.replace({
      pathname: '/(auth)/onboarding',
      params: { userId: data.session.user.id, email: trimmedEmail, termsAccepted: '1' },
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: 24, paddingBottom: 36 }}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
          </TouchableOpacity>

          <View style={s.hero}>
            <Text style={s.title}>Create account</Text>
          </View>

          <TouchableOpacity
            style={s.googleBtn}
            onPress={handleGoogle}
            disabled={googleLoading}
            activeOpacity={0.85}
          >
            {googleLoading ? (
              <ActivityIndicator size="small" color="#4285F4" />
            ) : (
              <>
                <Text style={{ fontSize: 22, fontWeight: '900', color: '#4285F4' }}>G</Text>
                <Text style={s.googleBtnText}>Sign up with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={s.appleBtn}
              onPress={handleApple}
              disabled={appleLoading}
              activeOpacity={0.85}
            >
              {appleLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="logo-apple" size={22} color="#FFFFFF" />
                  <Text style={s.appleBtnText}>Sign up with Apple</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>OR</Text>
            <View style={s.dividerLine} />
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
            validationState={getValidationState(
              showEmailState,
              emailValidation,
              Boolean(trimmedEmail),
            )}
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
            placeholder={`${MIN_PASSWORD_LENGTH}+ characters`}
            validationState={getValidationState(
              showPasswordState,
              passwordValidation,
              Boolean(password),
            )}
            error={showPasswordState ? passwordValidation.message : undefined}
          />

          <AuthLegalConsentRow
            checked={termsAccepted}
            onToggle={() => setTermsAccepted((v) => !v)}
            style={{ marginTop: 4, marginBottom: 8 }}
          />

          <Button
            title="Create Account"
            onPress={handleRegister}
            loading={loading}
            disabled={!termsAccepted}
            fullWidth
            size="lg"
          />

          <View style={s.signinRow}>
            <Text style={{ color: COLORS.textSecondary, fontSize: 14 }}>
              Already have an account?{' '}
            </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 14 }}>
                Sign In
              </Text>
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
  appleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#000000',
    borderRadius: 14,
    height: 56,
    marginBottom: 12,
  },
  appleBtnText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
  signinRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
});
