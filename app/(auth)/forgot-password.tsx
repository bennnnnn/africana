import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { COLORS } from '@/constants';
import { appDialog } from '@/lib/app-dialog';

export default function ForgotPasswordScreen() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);

  const handleSend = async () => {
    if (!email.trim()) {
      appDialog({
        title: 'Enter your email',
        message: 'Please enter the email address linked to your account.',
        icon: 'mail-outline',
      });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'africana://reset-password',
    });
    setLoading(false);
    if (error) {
      appDialog({ title: 'Something went wrong', message: error.message, icon: 'alert-circle-outline' });
    } else {
      setSent(true);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, padding: 24 }}>

        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 32 }}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>

        {sent ? (
          // ── Success state ──
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <View style={{
              width: 80, height: 80, borderRadius: 40,
              backgroundColor: `${COLORS.success}15`,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="mail-open-outline" size={38} color={COLORS.success} />
            </View>
            <Text style={{ fontSize: 24, fontWeight: '800', color: COLORS.text, textAlign: 'center' }}>
              Check your inbox
            </Text>
            <Text style={{ fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 }}>
              We sent a password reset link to{'\n'}
              <Text style={{ fontWeight: '700', color: COLORS.text }}>{email.trim()}</Text>
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
              <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // ── Form state ──
          <>
            <Text style={{ fontSize: 30, fontWeight: '800', color: COLORS.text, marginBottom: 8 }}>
              Forgot password?
            </Text>
            <Text style={{ fontSize: 15, color: COLORS.textSecondary, marginBottom: 32, lineHeight: 22 }}>
              Enter your email and we'll send you a link to reset your password.
            </Text>

            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              leftIcon="mail-outline"
              placeholder="your@email.com"
              autoFocus
            />

            <Button
              title="Send Reset Link"
              onPress={handleSend}
              loading={loading}
              fullWidth
              size="lg"
            />
          </>
        )}

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
