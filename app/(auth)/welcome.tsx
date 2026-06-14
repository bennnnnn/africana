import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SHADOWS, COLORS, FONT } from '@/constants';

const SLIDES = [
  {
    title: 'Where African\nHearts Connect',
    desc: 'Meet Africans and the diaspora worldwide.\nReal people. Genuine connections.',
  },
  {
    title: 'Built for\nYour Culture',
    desc: 'Filter by country, language, and values.\nFind someone who truly gets you.',
  },
  {
    title: 'Safe &\nAuthentic',
    desc: 'Privacy controls, blocking, and a community\nthat respects your boundaries.',
  },
] as const;

const AUTOPLAY_MS = 4500;

export default function WelcomeScreen() {
  const { width, height } = useWindowDimensions();
  const [activeSlide, setActiveSlide] = useState(0);
  const flatListRef = useRef<FlatList<(typeof SLIDES)[number]>>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAutoPlay = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startAutoPlay = useCallback(() => {
    stopAutoPlay();
    timerRef.current = setInterval(() => {
      setActiveSlide((prev) => {
        const next = (prev + 1) % SLIDES.length;
        flatListRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, AUTOPLAY_MS);
  }, [stopAutoPlay]);

  useEffect(() => {
    startAutoPlay();
    return () => stopAutoPlay();
  }, [startAutoPlay, stopAutoPlay]);

  const goToSlide = useCallback(
    (index: number) => {
      flatListRef.current?.scrollToIndex({ index, animated: true });
      setActiveSlide(index);
      startAutoPlay();
    },
    [startAutoPlay],
  );

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(e.nativeEvent.contentOffset.x / width);
      setActiveSlide(index);
      startAutoPlay();
    },
    [width, startAutoPlay],
  );

  return (
    <View style={s.root}>
      <View
        style={[s.circle, { top: -100, right: -70, width: 240, height: 240, opacity: 0.1 }]}
      />
      <View
        style={[
          s.circle,
          { bottom: height * 0.22, left: -90, width: 180, height: 180, opacity: 0.06 },
        ]}
      />

      <SafeAreaView style={s.inner}>
        <Text style={s.brandName}>Africana</Text>

        <View style={s.mainColumn}>
          <View style={s.topSpacer} />

          <View style={s.contentGroup}>
            <View style={s.slidesWrapper}>
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
                  <View style={[s.slide, { width }]}>
                    <Text style={s.slideTitle}>{item.title}</Text>
                    <Text style={s.slideDesc}>{item.desc}</Text>
                  </View>
                )}
              />

              <View style={s.dots}>
                {SLIDES.map((_, i) => (
                  <TouchableOpacity
                    key={i}
                    accessibilityRole="button"
                    accessibilityLabel={`Go to slide ${i + 1}`}
                    accessibilityState={{ selected: activeSlide === i }}
                    onPress={() => goToSlide(i)}
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                    style={[s.dot, activeSlide === i && s.dotActive]}
                  />
                ))}
              </View>
            </View>

            <View style={s.actionsSection}>
              <TouchableOpacity
                style={s.primaryBtn}
                onPress={() => router.push('/(auth)/register')}
                activeOpacity={0.9}
              >
                <Text style={s.primaryBtnText}>Get Started</Text>
              </TouchableOpacity>

              <View style={s.signinRow}>
                <Text style={s.signinText}>Already have an account? </Text>
                <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                  <Text style={s.signinLink}>Sign In</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={s.bottomSpacer} />
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
    backgroundColor: COLORS.surface,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
  },
  brandName: {
    fontSize: 40,
    fontFamily: FONT.displayFamily,
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.4,
    paddingTop: 12,
    paddingBottom: 8,
  },
  mainColumn: {
    flex: 1,
  },
  topSpacer: {
    flex: 0.5,
  },
  bottomSpacer: {
    flex: 0.5,
  },
  contentGroup: {
    alignItems: 'stretch',
  },
  slidesWrapper: {
    alignItems: 'center',
  },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  slideTitle: {
    fontSize: 30,
    fontFamily: FONT.displayFamily,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 14,
  },
  slideDesc: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingTop: 20,
    paddingBottom: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    width: 22,
    backgroundColor: COLORS.surface,
  },
  actionsSection: {
    gap: 12,
    marginTop: 36,
  },
  primaryBtn: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: FONT.bold,
    color: COLORS.green,
  },
  signinRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signinText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
  },
  signinLink: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: FONT.bold,
  },
});
