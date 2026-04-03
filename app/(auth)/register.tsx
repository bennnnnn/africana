import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { COLORS } from '@/constants';

export default function RegisterScreen() {
  const { fetchProfile, fetchSettings } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { emailRedirectTo: 'africana://auth/callback' },
    });
    setLoading(false);

    if (error) {
      if (error.message.includes('rate') || error.message.includes('limit')) {
        Alert.alert(
          'Too many attempts',
          'You\'ve reached the email limit. Please wait 1 hour, or sign in with Google instead — it\'s instant! ⚡',
          [
            { text: 'Sign In with Google', onPress: () => router.replace('/(auth)/login') },
            { text: 'OK', style: 'cancel' },
          ]
        );
      } else if (error.message.includes('already')) {
        Alert.alert(
          'Account exists',
          'An account with this email already exists. Try signing in instead.',
          [
            { text: 'Sign In', onPress: () => router.replace('/(auth)/login') },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      } else {
        Alert.alert('Registration Failed', error.message);
      }
      return;
    }

    if (data.user) {
      router.replace({
        pathname: '/(auth)/onboarding',
        params: { userId: data.user.id, email: email.trim().toLowerCase() },
      });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 28 }}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>

          <Text style={{ fontSize: 32, fontWeight: '800', color: COLORS.text, marginBottom: 6 }}>
            Create account 🌍
          </Text>
          <Text style={{ fontSize: 15, color: COLORS.textSecondary, marginBottom: 32 }}>
            Join thousands of Africans finding love
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
            placeholder="Min. 6 characters"
          />

          <Button
            title="Create Account"
            onPress={handleRegister}
            loading={loading}
            fullWidth
            size="lg"
          />

          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 20, gap: 4 }}>
            <Text style={{ color: COLORS.textSecondary, fontSize: 14 }}>Already have an account?</Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 14 }}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

