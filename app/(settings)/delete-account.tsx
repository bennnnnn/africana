import React, { useState } from 'react';
import {
  View,
  Text,

  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { COLORS } from '@/constants';

export default function DeleteAccountScreen() {
  const { user, signOut } = useAuthStore();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Detect OAuth-only users (Google) — they have no password to verify
  const isOAuthUser = !user?.email || user.email.includes('@googlemail') ||
    (user as any).app_metadata?.provider === 'google';

  const doDelete = async () => {
    if (!user) return;
    setLoading(true);

    // For email users: re-authenticate to verify identity
    if (!isOAuthUser) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });
      if (signInError) {
        setLoading(false);
        Alert.alert('Incorrect Password', 'The password you entered is incorrect.');
        return;
      }
    }

    // Call delete_user() — a SECURITY DEFINER function that removes the
    // caller's auth.users row, cascading to profiles and all related data.
    const { error } = await supabase.rpc('delete_user');
    if (error) {
      setLoading(false);
      Alert.alert('Error', 'Failed to delete account. Please contact support.');
      return;
    }

    await supabase.auth.signOut();
    setLoading(false);
    Alert.alert('Account Deleted', 'Your account has been permanently deleted.', [
      { text: 'OK', onPress: () => router.replace('/(auth)/welcome') },
    ]);
  };

  const handleDelete = async () => {
    if (!isOAuthUser && !password) {
      Alert.alert('Error', 'Please enter your password to confirm.');
      return;
    }
    if (!user) return;

    Alert.alert(
      'Final Confirmation',
      'This will permanently delete all your data including messages, likes, and your profile. This CANNOT be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Forever', style: 'destructive', onPress: doDelete },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 14,
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
          gap: 12,
        }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: '700', color: COLORS.text }}>Delete Account</Text>
      </View>

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

        <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 12 }}>
          Delete your account?
        </Text>

        <Text style={{ fontSize: 15, color: COLORS.textSecondary, lineHeight: 22, marginBottom: 24 }}>
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
            <Text style={{ fontSize: 14, color: COLORS.text }}>{item}</Text>
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
          <Text style={{ fontSize: 13, color: '#B91C1C', lineHeight: 18 }}>
            {isOAuthUser
              ? '⚠️ Tap "Delete Forever" below to permanently delete your account.'
              : '⚠️ Enter your password below to confirm account deletion.'}
          </Text>
        </View>

        {!isOAuthUser && (
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
