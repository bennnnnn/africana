import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { signInWithGoogle } from '@/lib/google-auth';
import { useAuthStore } from '@/store/auth.store';
import { COLORS } from '@/constants';
import { isProfileCompleteForDiscover, onboardingHrefFromSession } from '@/lib/profile-completion';

const { height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const { fetchProfile, fetchSettings } = useAuthStore();
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      const session = await signInWithGoogle();
      if (session?.user) {
        await fetchProfile(session.user.id);
        await fetchSettings(session.user.id);
        const { user } = useAuthStore.getState();
        if (isProfileCompleteForDiscover(user)) {
          router.replace('/(tabs)/discover');
        } else {
          router.replace(onboardingHrefFromSession(session));
        }
      }
    } catch (e: any) {
      if (e?.message !== 'User cancelled') {
        Alert.alert('Google Sign-In Failed', e?.message ?? 'Please try again.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.circle, { top: -120, right: -80, width: 280, height: 280, opacity: 0.15 }]} />
      <View style={[styles.circle, { top: height * 0.15, left: -60, width: 160, height: 160, opacity: 0.1 }]} />
      <View style={[styles.circle, { bottom: 80, right: -40, width: 200, height: 200, opacity: 0.1 }]} />

      <SafeAreaView style={styles.inner}>
        <View style={styles.brandSection}>
          <Text style={styles.appName}>Africana</Text>
          <Text style={styles.tagline}>Where African hearts connect</Text>
        </View>

        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={styles.googleBtn}
            onPress={handleGoogle}
            disabled={googleLoading}
            activeOpacity={0.9}
          >
            {googleLoading ? (
              <ActivityIndicator size="small" color="#4285F4" />
            ) : (
              <>
                <Text style={{ fontSize: 24, fontWeight: '900', color: '#4285F4' }}>G</Text>
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.emailBtn}
            onPress={() => router.push('/(auth)/register')}
            activeOpacity={0.9}
          >
            <Ionicons name="mail-outline" size={20} color="#FFF" style={{ marginRight: 10 }} />
            <Text style={styles.emailBtnText}>Continue with Email</Text>
          </TouchableOpacity>

          {/* Sign in */}
          <View style={styles.signinRow}>
            <Text style={styles.signinText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.signinLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  circle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  inner: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingBottom: 16,
  },
  brandSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  appName: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 8,
    fontWeight: '400',
  },
  actionsSection: {
    gap: 12,
    paddingBottom: 8,
  },
  googleBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#DADCE0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  gLogo: {},
  googleBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3C4043',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dividerText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '500',
  },
  emailBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  emailBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  signinRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 4,
  },
  signinText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
  },
  signinLink: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
