import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { COLORS, MAX_PROFILE_PHOTOS } from '@/constants';

const { width } = Dimensions.get('window');

export function OnboardingPhotoGrid(props: {
  photoUris: string[];
  onAdd: () => void;
  onRemoveAt: (index: number) => void;
}) {
  const { photoUris, onAdd, onRemoveAt } = props;
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={s.photoGrid}>
        {photoUris.map((uri, i) => (
          <View key={uri} style={s.photoThumb}>
            <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            {i === 0 && (
              <View style={s.mainBadge}>
                <Text style={s.mainBadgeTxt}>MAIN</Text>
              </View>
            )}
            <TouchableOpacity style={s.removePhotoBtn} onPress={() => onRemoveAt(i)}>
              <Ionicons name="close-circle" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>
        ))}
        {photoUris.length < MAX_PROFILE_PHOTOS && (
          <TouchableOpacity style={s.photoAddSlot} onPress={onAdd}>
            <Text style={s.photoAddTxt}>Add photos</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={[s.hint, { marginTop: 12, textAlign: 'center' }]}>
        {photoUris.length > 0
          ? `${photoUris.length} of ${MAX_PROFILE_PHOTOS} photos selected`
          : `Select up to ${MAX_PROFILE_PHOTOS} photos at once`}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    width: '100%',
  },
  photoThumb: {
    width: (width - 48 - 16) / 3,
    height: ((width - 48 - 16) / 3) * 1.3,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  mainBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  mainBadgeTxt: { color: '#FFF', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  removePhotoBtn: { position: 'absolute', top: 4, right: 4 },
  photoAddSlot: {
    width: (width - 48 - 16) / 3,
    height: ((width - 48 - 16) / 3) * 1.3,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.earthLight,
    backgroundColor: COLORS.savanna,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  photoAddTxt: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '700',
    textAlign: 'center',
  },
  hint: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
});
