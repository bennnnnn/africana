import React from 'react';
import {
  View,
  Text,
  SafeAreaView,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { COLORS } from '@/constants';

const { height } = Dimensions.get('window');

export default function WelcomeScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#1A0A00' }}>
      {/* Background */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#C84B31' }]} />

      {/* Decorative circles */}
      <View
        style={{
          position: 'absolute',
          top: -100,
          right: -80,
          width: 300,
          height: 300,
          borderRadius: 150,
          backgroundColor: 'rgba(212, 175, 55, 0.2)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: height * 0.1,
          left: -60,
          width: 200,
          height: 200,
          borderRadius: 100,
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
        }}
      />

      <SafeAreaView style={{ flex: 1, justifyContent: 'space-between', padding: 24 }}>
        {/* Logo / Brand */}
        <View style={{ alignItems: 'center', marginTop: 40 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: 'rgba(255,255,255,0.15)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              borderWidth: 2,
              borderColor: 'rgba(255,255,255,0.3)',
            }}
          >
            <Text style={{ fontSize: 36 }}>🌍</Text>
          </View>
          <Text
            style={{
              fontSize: 42,
              fontWeight: '800',
              color: '#FFFFFF',
              letterSpacing: -1,
            }}
          >
            Africana
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: 'rgba(255,255,255,0.8)',
              textAlign: 'center',
              marginTop: 8,
              fontWeight: '400',
              lineHeight: 22,
            }}
          >
            Love knows no borders.{'\n'}Connect with Africans worldwide.
          </Text>
        </View>

        {/* Feature highlights */}
        <View style={{ gap: 16 }}>
          {[
            { emoji: '💫', text: 'Browse authentic African profiles' },
            { emoji: '📍', text: 'Find people from your hometown or anywhere in Africa' },
            { emoji: '💬', text: 'Real conversations, real connections' },
            { emoji: '🔒', text: 'Safe, private & secure' },
          ].map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 20 }}>{item.emoji}</Text>
              </View>
              <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.9)', flex: 1, fontWeight: '400' }}>
                {item.text}
              </Text>
            </View>
          ))}
        </View>

        {/* Action buttons */}
        <View style={{ gap: 12, paddingBottom: 8 }}>
          <Button
            title="Create Account"
            onPress={() => router.push('/(auth)/register')}
            size="lg"
            fullWidth
            style={{ backgroundColor: '#FFFFFF' }}
            textStyle={{ color: COLORS.primary }}
          />
          <Button
            title="Sign In"
            onPress={() => router.push('/(auth)/login')}
            variant="outline"
            size="lg"
            fullWidth
            style={{ borderColor: 'rgba(255,255,255,0.5)' }}
            textStyle={{ color: '#FFFFFF' }}
          />
          <Text
            style={{
              textAlign: 'center',
              color: 'rgba(255,255,255,0.6)',
              fontSize: 12,
              marginTop: 4,
            }}
          >
            By continuing, you agree to our Terms & Privacy Policy
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}
