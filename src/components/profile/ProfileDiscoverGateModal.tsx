import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { router } from 'expo-router';
import { COLORS } from '@/constants';

type Props = {
  visible: boolean;
  onContinueSetup: () => void;
};

/**
 * Blocks viewing others until the signed-in user has completed discover-required profile fields.
 */
export function ProfileDiscoverGateModal({ visible, onContinueSetup }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => router.back()}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(17,17,17,0.5)',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#111111', lineHeight: 27 }}>
            Finish your profile
          </Text>
          <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 22, color: '#555555' }}>
            Add your basics (name, birthday, gender, and country) before browsing others. Who you
            see is based on your gender.
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.back()}
              style={{
                flex: 1,
                minHeight: 50,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#E7E1DC',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#FFFFFF',
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#111111' }}>Go back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onContinueSetup}
              style={{
                flex: 1,
                minHeight: 50,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: COLORS.emptyField,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>
                Continue setup
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
