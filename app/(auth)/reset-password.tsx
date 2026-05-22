import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { createSessionFromUrl } from '@/lib/google-auth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { COLORS } from '@/constants';
import { appDialog } from '@/lib/app-dialog';
import { MIN_PASSWORD_LENGTH, validatePassword } from '@/lib/validation';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ url?: string }>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [restoringSession, setRestoringSession] = useState(Boolean(params.url));

  useEffect(() => {
    let active = true;

    if (!params.url) {
      const t = setTimeout(() => setRestoringSession(false), 0);
      return () => {
        clearTimeout(t);
        active = false;
      };
    }

    createSessionFromUrl(params.url)
      .catch(() => {
        if (!active) return;
        appDialog({
          title: 'Reset link expired',
          message: 'Request a new password reset link and try again.',
          icon: 'alert-circle-outline',
        });
      })
      .finally(() => {
        if (active) setRestoringSession(false);
      });

    return () => {
      active = false;
    };
  }, [params.url]);

  const handleReset = async () => {
    if (restoringSession) return;
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      appDialog({
        title: 'Weak password',
        message: passwordCheck.message ?? 'Password is too weak.',
        icon: 'key-outline',
      });
      return;
    }
    if (password !== confirm) {
      appDialog({ title: 'Mismatch', message: 'Passwords do not match.', icon: 'key-outline' });
      return;
    }

    setLoading(true);
    try {
      // If we arrived via deep link, the session is already set by Supabase.
      // updateUser updates the password for the currently authenticated user.
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        appDialog({
          title: 'Something went wrong',
          message: error.message,
          icon: 'alert-circle-outline',
        });
      } else {
        setDone(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, padding: 24 }}
      >
        <TouchableOpacity
          onPress={() => router.replace('/(auth)/login')}
          style={{ marginBottom: 32 }}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>

        {done ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: COLORS.successSurface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="checkmark-circle-outline" size={40} color={COLORS.success} />
            </View>
            <Text
              style={{ fontSize: 24, fontWeight: '800', color: COLORS.text, textAlign: 'center' }}
            >
              Password updated!
            </Text>
            <Text
              style={{
                fontSize: 15,
                color: COLORS.textSecondary,
                textAlign: 'center',
                lineHeight: 22,
              }}
            >
              Your password has been changed successfully.
            </Text>
            <TouchableOpacity
              onPress={() => router.replace('/(auth)/login')}
              style={{
                marginTop: 16,
                backgroundColor: COLORS.primary,
                paddingHorizontal: 32,
                paddingVertical: 14,
                borderRadius: 14,
              }}
            >
              <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Sign In</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={{ fontSize: 30, fontWeight: '800', color: COLORS.text, marginBottom: 8 }}>
              Set new password
            </Text>
            <Text
              style={{
                fontSize: 15,
                color: COLORS.textSecondary,
                marginBottom: 32,
                lineHeight: 22,
              }}
            >
              Choose a strong password for your account.
            </Text>
            {restoringSession ? (
              <Text style={{ fontSize: 14, color: COLORS.textSecondary, marginBottom: 16 }}>
                Preparing your secure reset link...
              </Text>
            ) : null}

            <Input
              label="New Password"
              value={password}
              onChangeText={setPassword}
              isPassword
              leftIcon="lock-closed-outline"
              placeholder={`Min. ${MIN_PASSWORD_LENGTH} characters`}
              autoFocus
            />
            <Input
              label="Confirm Password"
              value={confirm}
              onChangeText={setConfirm}
              isPassword
              leftIcon="lock-closed-outline"
              placeholder="Repeat your password"
            />

            <Button
              title="Update Password"
              onPress={handleReset}
              loading={loading || restoringSession}
              fullWidth
              size="lg"
            />
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
