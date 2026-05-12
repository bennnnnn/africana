import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT } from '@/constants';

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
  const [activeSlide, setActiveSlide] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAutoPlay = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

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

  useEffect(() => {
    startAutoPlay();
    return () => stopAutoPlay();
  }, []);

  const onMomentumScrollEnd = (e: any) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    setActiveSlide(index);
    startAutoPlay();
  };

  return (
    <View style={styles.container}>
      <View
        style={[styles.circle, { top: -120, right: -80, width: 280, height: 280, opacity: 0.12 }]}
      />
      <View
        style={[
          styles.circle,
          { top: height * 0.28, left: -60, width: 160, height: 160, opacity: 0.08 },
        ]}
      />
      <View
        style={[styles.circle, { bottom: 110, right: -40, width: 200, height: 200, opacity: 0.08 }]}
      />

      <SafeAreaView style={styles.inner}>
        <View style={styles.brandRow}>
          <Text style={styles.appName}>Africana</Text>
        </View>

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

        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={styles.joinBtn}
            onPress={() => router.push('/(auth)/register')}
            activeOpacity={0.9}
          >
            <Text style={styles.joinBtnText}>Join Africana</Text>
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
    backgroundColor: COLORS.green,
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
  joinBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  joinBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.green,
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
