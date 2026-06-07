import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { signInWithGoogle } from '@/lib/google-auth';
import { signInWithApple } from '@/lib/apple-auth';
import { useAuthStore } from '@/store/auth.store';
import { redirectAfterAuth } from '@/lib/profile-completion';
import { appDialog } from '@/lib/app-dialog';
import { COLORS } from '@/constants';

const { width } = Dimensions.get('window');

export default function WelcomeScreen() {
  const hydrateUserFromServer = useAuthStore((s) => s.hydrateUserFromServer);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

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
          title: 'Sign in failed',
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
          title: 'Sign in failed',
          message: e?.message ?? 'Please try again.',
          icon: 'logo-apple',
        });
      }
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <View style={s.root}>
      {/* background circles */}
      <View style={[s.circle, { top: -100, right: -60, width: 260, height: 260, opacity: 0.1 }]} />
      <View style={[s.circle, { bottom: '32%', left: -80, width: 180, height: 180, opacity: 0.06 }]} />

      <SafeAreaView style={s.inner}>
        {/* brand */}
        <View style={s.brandSection}>
          <View style={s.brandMark}>
            <Ionicons name="globe-outline" size={28} color={COLORS.green} />
          </View>
          <Text style={s.brandName}>Africana</Text>
        </View>

        {/* hero */}
        <View style={s.heroSection}>
          <View style={s.heroVisual}>
            {/* decorative african-inspired geometric motif */}
            <View style={s.motifOuter}>
              <View style={s.motifRing}>
                <Ionicons name="heart" size={32} color="#FFFFFF" />
              </View>
            </View>
            <View style={[s.motifDot, { top: 8, left: '44%' }]} />
            <View style={[s.motifDot, { bottom: 8, right: '38%' }]} />
            <View style={[s.motifDot, { bottom: 18, left: '36%' }]} />
            <View style={[s.motifDot, { top: 18, right: '36%' }]} />
          </View>

          <Text style={s.tagline}>Where African{'\n'}Hearts Connect</Text>
          <Text style={s.subtitle}>
            Meet Africans and the diaspora worldwide.{'\n'}Real people. Genuine connections.
          </Text>
        </View>

        {/* actions */}
        <View style={s.actionsSection}>
          {/* google */}
          <TouchableOpacity
            style={s.googleBtn}
            onPress={handleGoogle}
            disabled={googleLoading || appleLoading}
            activeOpacity={0.85}
          >
            {googleLoading ? (
              <ActivityIndicator color="#3C4043" size="small" />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#3C4043" />
                <Text style={s.googleBtnText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* apple */}
          <TouchableOpacity
            style={s.appleBtn}
            onPress={handleApple}
            disabled={googleLoading || appleLoading}
            activeOpacity={0.85}
          >
            {appleLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="logo-apple" size={22} color="#FFFFFF" />
                <Text style={s.appleBtnText}>Continue with Apple</Text>
              </>
            )}
          </TouchableOpacity>

          {/* email */}
          <TouchableOpacity
            style={s.emailBtn}
            onPress={() => router.push('/(auth)/register')}
            activeOpacity={0.7}
          >
            <Text style={s.emailBtnText}>Sign up with email</Text>
          </TouchableOpacity>
        </View>

        {/* sign in */}
        <View style={s.signinRow}>
          <Text style={s.signinText}>Already a member? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text style={s.signinLink}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.green,
  },
  circle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
    paddingBottom: 12,
  },

  // brand
  brandSection: {
    alignItems: 'center',
    paddingTop: 16,
    gap: 8,
  },
  brandMark: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  brandName: {
    fontSize: 36,
    fontFamily: 'DMSerifDisplay_400Regular',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // hero
  heroSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  heroVisual: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  motifOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  motifRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  motifDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  tagline: {
    fontSize: 34,
    fontFamily: 'DMSerifDisplay_400Regular',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 44,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.78)',
    textAlign: 'center',
    lineHeight: 22,
  },

  // actions
  actionsSection: {
    gap: 10,
    paddingBottom: 4,
  },
  googleBtn: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  googleBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3C4043',
  },
  appleBtn: {
    flexDirection: 'row',
    backgroundColor: '#000000',
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  appleBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emailBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  emailBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },

  // sign in
  signinRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: 4,
  },
  signinText: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 14,
  },
  signinLink: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
