import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { signInWithGoogle } from '@/lib/google-auth';
import { useAuthStore } from '@/store/auth.store';
import { COLORS, FONT } from '@/constants';
import { isProfileCompleteForDiscover, onboardingHrefFromSession } from '@/lib/profile-completion';
import { appDialog } from '@/lib/app-dialog';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    icon: 'earth' as const,
    title: 'Where African\nHearts Connect',
    desc: 'Meet Africans and the diaspora worldwide.\nReal people. Genuine connections.',
  },
  {
    icon: 'heart' as const,
    title: 'Built for\nYour Culture',
    desc: 'Filter by country, language, and values.\nFind someone who truly gets you.',
  },
  {
    icon: 'shield-checkmark' as const,
    title: 'Safe &\nAuthentic',
    desc: 'Privacy controls, blocking, and a community\nthat respects your boundaries.',
  },
];

export default function WelcomeScreen() {
  const { fetchProfile, fetchSettings } = useAuthStore();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    startAutoPlay();
    return () => stopAutoPlay();
  }, []);

  const startAutoPlay = () => {
    stopAutoPlay();
    timerRef.current = setInterval(() => {
      setActiveSlide((prev) => {
        const next = (prev + 1) % SLIDES.length;
        flatListRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 3200);
  };

  const stopAutoPlay = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const onMomentumScrollEnd = (e: any) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    setActiveSlide(index);
    startAutoPlay();
  };

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
        appDialog({
          title: 'Google sign-in failed',
          message: e?.message ?? 'Please try again.',
          icon: 'logo-google',
        });
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.circle, { top: -120, right: -80, width: 280, height: 280, opacity: 0.12 }]} />
      <View style={[styles.circle, { top: height * 0.28, left: -60, width: 160, height: 160, opacity: 0.08 }]} />
      <View style={[styles.circle, { bottom: 110, right: -40, width: 200, height: 200, opacity: 0.08 }]} />

      <SafeAreaView style={styles.inner}>
        {/* App name */}
        <View style={styles.brandRow}>
          <Text style={styles.appName}>Africana</Text>
        </View>

        {/* Slides */}
        <View style={styles.slidesWrapper}>
          <FlatList
            ref={flatListRef}
            data={SLIDES}
            horizontal
            pagingEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onMomentumScrollEnd}
            onScrollBeginDrag={stopAutoPlay}
            keyExtractor={(_, i) => String(i)}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            renderItem={({ item }) => (
              <View style={[styles.slide, { width }]}>
                <View style={styles.iconWrap}>
                  <Ionicons name={item.icon} size={54} color="#FFF" />
                </View>
                <Text style={styles.slideTitle}>{item.title}</Text>
                <Text style={styles.slideDesc}>{item.desc}</Text>
              </View>
            )}
          />

          {/* Dot indicators */}
          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => {
                  flatListRef.current?.scrollToIndex({ index: i, animated: true });
                  setActiveSlide(i);
                  startAutoPlay();
                }}
                style={[styles.dot, activeSlide === i && styles.dotActive]}
              />
            ))}
          </View>
        </View>

        {/* Sign-in buttons */}
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
    paddingBottom: 16,
  },
  brandRow: {
    alignItems: 'center',
    paddingTop: 20,
  },
  appName: {
    fontSize: 42,
    fontFamily: FONT.displayFamily,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  slidesWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  iconWrap: {
    width: 114,
    height: 114,
    borderRadius: 57,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  slideTitle: {
    fontSize: 32,
    fontFamily: FONT.displayFamily,
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.2,
    lineHeight: 40,
    marginBottom: 14,
  },
  slideDesc: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.80)',
    textAlign: 'center',
    lineHeight: 22,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
    paddingTop: 28,
    paddingBottom: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#FFFFFF',
  },
  actionsSection: {
    gap: 12,
    paddingHorizontal: 28,
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
