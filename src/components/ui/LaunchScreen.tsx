import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export function LaunchScreen() {
  return (
    <LinearGradient
      colors={['#22110E', '#6A3428', '#C97852']}
      start={{ x: 0.05, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />
      <View style={styles.glowCenter} />

      <View style={styles.center}>
        <View style={styles.markWrap}>
          <Text style={styles.mark}>A</Text>
        </View>
        <Text style={styles.title}>Africana</Text>
        <Text style={styles.subtitle}>Dating for Africans and the diaspora</Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.pulseTrack}>
          <View style={styles.pulseFill} />
        </View>
        <Text style={styles.footerText}>Loading your space</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 96,
    paddingBottom: 56,
    overflow: 'hidden',
  },
  glowTop: {
    position: 'absolute',
    top: -110,
    left: -60,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255, 224, 204, 0.10)',
  },
  glowBottom: {
    position: 'absolute',
    right: -40,
    bottom: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(255, 241, 229, 0.18)',
  },
  glowCenter: {
    position: 'absolute',
    top: '34%',
    alignSelf: 'center',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(255, 214, 189, 0.10)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.34)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginBottom: 24,
  },
  mark: {
    color: '#FFF8F3',
    fontSize: 44,
    lineHeight: 48,
    fontWeight: '300',
  },
  title: {
    color: '#FFF8F3',
    fontSize: 38,
    lineHeight: 42,
    fontWeight: '800',
    letterSpacing: -1,
  },
  subtitle: {
    marginTop: 12,
    color: 'rgba(255,248,243,0.82)',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 260,
  },
  footer: {
    alignItems: 'center',
  },
  pulseTrack: {
    width: 120,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  pulseFill: {
    width: 64,
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#FFF3EB',
  },
  footerText: {
    marginTop: 12,
    color: 'rgba(255,248,243,0.75)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
});
