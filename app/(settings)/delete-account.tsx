import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { COLORS, FONT } from '@/constants';
import { SettingsHeaderBar } from '@/components/settings/SettingsHeaderBar';
import { appDialog } from '@/lib/app-dialog';

/** Email/password sign-in adds an `email` identity; pure OAuth (e.g. Google, Apple) does not. */
function hasEmailPasswordIdentity(identities: { provider?: string }[] | undefined): boolean {
  return !!identities?.some((i) => i.provider === 'email');
}

export default function DeleteAccountScreen() {
  const { user, session } = useAuthStore();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const needsPasswordConfirmation = useMemo(
    () => hasEmailPasswordIdentity(session?.user?.identities),
    [session?.user?.identities],
  );

  const doDelete = async () => {
    if (!user) return;
    setLoading(true);

    if (needsPasswordConfirmation && user.email) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });
      if (signInError) {
        setLoading(false);
        appDialog({
          title: 'Incorrect password',
          message: 'The password you entered is incorrect.',
          icon: 'lock-closed-outline',
        });
        return;
      }
    }

    const { error } = await supabase.rpc('delete_user');
    if (error) {
      setLoading(false);
      appDialog({
        title: 'Something went wrong',
        message: 'Failed to delete account. Please contact support.',
        icon: 'alert-circle-outline',
      });
      return;
    }

    await supabase.auth.signOut();
    setLoading(false);
    appDialog({
      title: 'Account deleted',
      message: 'Your account has been permanently deleted.',
      icon: 'checkmark-circle-outline',
      actions: [{ label: 'OK', style: 'primary', onPress: () => router.replace('/(auth)/welcome') }],
    });
  };

  const handleDelete = async () => {
    if (needsPasswordConfirmation && !password) {
      appDialog({ title: 'Password required', message: 'Please enter your password to confirm.' });
      return;
    }
    if (!user) return;

    appDialog({
      title: 'Final confirmation',
      message:
        'This will permanently delete all your data including messages, likes, and your profile. This cannot be undone.',
      icon: 'warning-outline',
      actions: [
        { label: 'Cancel', style: 'cancel' },
        { label: 'Delete forever', style: 'destructive', onPress: doDelete },
      ],
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <SettingsHeaderBar title="Delete account" titleAlign="leading" />

      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: '#FEE2E2',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
          }}
        >
          <Ionicons name="warning-outline" size={32} color={COLORS.error} />
        </View>

        <Text style={{ fontSize: FONT.xxl, fontWeight: FONT.extrabold, color: COLORS.text, marginBottom: 12 }}>
          Delete your account?
        </Text>

        <Text style={{ fontSize: FONT.md, color: COLORS.textSecondary, lineHeight: 22, marginBottom: 24 }}>
          This action is permanent and cannot be undone. Once deleted, all of your data will be erased, including:
        </Text>

        {[
          'Your profile and photos',
          'All conversations and messages',
          'Your likes and connections',
          'Account settings and preferences',
        ].map((item, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Ionicons name="close-circle" size={18} color={COLORS.error} />
            <Text style={{ fontSize: FONT.sm, color: COLORS.text }}>{item}</Text>
          </View>
        ))}

        <View
          style={{
            backgroundColor: '#FEF2F2',
            borderRadius: 12,
            padding: 16,
            marginTop: 8,
            marginBottom: 28,
            borderWidth: 1,
            borderColor: '#FECACA',
          }}
        >
          <Text style={{ fontSize: FONT.sm, color: '#B91C1C', lineHeight: 18 }}>
            {needsPasswordConfirmation
              ? '⚠️ Enter your password below to confirm account deletion.'
              : '⚠️ Tap “Delete My Account Forever” below to permanently delete your account.'}
          </Text>
        </View>

        {needsPasswordConfirmation && (
          <Input
            label="Confirm Password"
            value={password}
            onChangeText={setPassword}
            isPassword
            leftIcon="lock-closed-outline"
            placeholder="Enter your password"
          />
        )}

        <Button
          title="Delete My Account Forever"
          onPress={handleDelete}
          loading={loading}
          variant="danger"
          fullWidth
          size="lg"
          style={{ marginTop: 8 }}
        />

        <Button
          title="Keep My Account"
          onPress={() => router.back()}
          variant="ghost"
          fullWidth
          style={{ marginTop: 12 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
