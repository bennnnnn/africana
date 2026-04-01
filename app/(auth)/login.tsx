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

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      Alert.alert('Sign In Failed', error.message);
      return;
    }

    router.replace('/(tabs)/discover');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={{ padding: 24 }}>
            <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 24 }}>
              <Ionicons name="arrow-back" size={24} color={COLORS.text} />
            </TouchableOpacity>

            <Text style={{ fontSize: 32, fontWeight: '800', color: COLORS.text, marginBottom: 8 }}>
              Welcome back 👋
            </Text>
            <Text style={{ fontSize: 15, color: COLORS.textSecondary, marginBottom: 36, lineHeight: 22 }}>
              Sign in to continue your journey
            </Text>

            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              leftIcon="mail-outline"
              placeholder="your@email.com"
            />

            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              isPassword
              leftIcon="lock-closed-outline"
              placeholder="Your password"
            />

            <TouchableOpacity style={{ alignSelf: 'flex-end', marginTop: -8, marginBottom: 24 }}>
              <Text style={{ color: COLORS.primary, fontWeight: '600', fontSize: 14 }}>
                Forgot password?
              </Text>
            </TouchableOpacity>

            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={loading}
              fullWidth
              size="lg"
            />

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24, gap: 4 }}>
              <Text style={{ color: COLORS.textSecondary, fontSize: 14 }}>Don't have an account?</Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
                <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 14 }}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
