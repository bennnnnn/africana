import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { COLORS } from '@/constants';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ url?: string }>();
  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [loading, setLoading]       = useState(false);
  const [done, setDone]             = useState(false);

  const handleReset = async () => {
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      // If we arrived via deep link, the session is already set by Supabase.
      // updateUser updates the password for the currently authenticated user.
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        setDone(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, padding: 24 }}>

        <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={{ marginBottom: 32 }}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>

        {done ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <View style={{
              width: 80, height: 80, borderRadius: 40,
              backgroundColor: `${COLORS.success}15`,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="checkmark-circle-outline" size={40} color={COLORS.success} />
            </View>
            <Text style={{ fontSize: 24, fontWeight: '800', color: COLORS.text, textAlign: 'center' }}>
              Password updated!
            </Text>
            <Text style={{ fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 }}>
              Your password has been changed successfully.
            </Text>
            <TouchableOpacity
              onPress={() => router.replace('/(auth)/login')}
              style={{
                marginTop: 16,
                backgroundColor: COLORS.primary,
                paddingHorizontal: 32, paddingVertical: 14,
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
            <Text style={{ fontSize: 15, color: COLORS.textSecondary, marginBottom: 32, lineHeight: 22 }}>
              Choose a strong password for your account.
            </Text>

            <Input
              label="New Password"
              value={password}
              onChangeText={setPassword}
              isPassword
              leftIcon="lock-closed-outline"
              placeholder="Min. 6 characters"
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
