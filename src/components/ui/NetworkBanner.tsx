import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export function NetworkBanner() {
  const insets = useSafeAreaInsets();
  const { isOnline } = useNetworkStatus();

  if (isOnline) return null;

  return (
    <View style={[styles.banner, { paddingTop: insets.top + 4 }]}>
      <Text style={styles.text}>No internet connection</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#DC2626',
    paddingBottom: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
    zIndex: 9999,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
