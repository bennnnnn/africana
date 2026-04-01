import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { COLORS, MAX_PROFILE_PHOTOS } from '@/constants';

const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - 56) / 3;

export default function PhotosScreen() {
  const { user, updateProfile } = useAuthStore();
  const [uploading, setUploading] = useState(false);

  if (!user) return null;

  const photos = user.profile_photos;

  const addPhoto = async () => {
    if (photos.length >= MAX_PROFILE_PHOTOS) {
      Alert.alert('Limit Reached', `You can have at most ${MAX_PROFILE_PHOTOS} photos.`);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    try {
      const uri = result.assets[0].uri;
      const fileName = `${user.id}/${Date.now()}.jpg`;
      const response = await fetch(uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, { contentType: 'image/jpeg' });

      if (uploadError) {
        Alert.alert('Upload Failed', uploadError.message);
        return;
      }

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);

      const updatedPhotos = [...photos, publicUrl];
      await updateProfile({
        profile_photos: updatedPhotos,
        avatar_url: updatedPhotos[0],
      });
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (photoUrl: string) => {
    Alert.alert('Remove Photo', 'Are you sure you want to remove this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const updatedPhotos = photos.filter((p) => p !== photoUrl);
          await updateProfile({
            profile_photos: updatedPhotos,
            avatar_url: updatedPhotos[0] ?? null,
          });
        },
      },
    ]);
  };

  const setMainPhoto = async (photoUrl: string) => {
    const reordered = [photoUrl, ...photos.filter((p) => p !== photoUrl)];
    await updateProfile({ profile_photos: reordered, avatar_url: photoUrl });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 14,
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
        }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: '700', color: COLORS.text }}>My Photos</Text>
        <TouchableOpacity
          onPress={addPhoto}
          disabled={uploading || photos.length >= MAX_PROFILE_PHOTOS}
          style={{ opacity: uploading || photos.length >= MAX_PROFILE_PHOTOS ? 0.4 : 1 }}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Ionicons name="add-circle" size={28} color={COLORS.primary} />
          )}
        </TouchableOpacity>
      </View>

      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 16, textAlign: 'center' }}>
          {photos.length}/{MAX_PROFILE_PHOTOS} photos • First photo is your main profile picture
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {photos.map((photo, i) => (
            <View
              key={photo}
              style={{
                width: PHOTO_SIZE,
                height: PHOTO_SIZE * 1.3,
                borderRadius: 12,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} contentFit="cover" />

              {i === 0 && (
                <View
                  style={{
                    position: 'absolute',
                    bottom: 6,
                    left: 6,
                    backgroundColor: COLORS.primary,
                    borderRadius: 6,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                  }}
                >
                  <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700' }}>MAIN</Text>
                </View>
              )}

              <View
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  gap: 4,
                }}
              >
                <TouchableOpacity
                  onPress={() => removePhoto(photo)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="trash-outline" size={14} color="#FFF" />
                </TouchableOpacity>
                {i !== 0 && (
                  <TouchableOpacity
                    onPress={() => setMainPhoto(photo)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="star-outline" size={14} color="#FFF" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}

          {photos.length < MAX_PROFILE_PHOTOS && (
            <TouchableOpacity
              onPress={addPhoto}
              style={{
                width: PHOTO_SIZE,
                height: PHOTO_SIZE * 1.3,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: COLORS.border,
                borderStyle: 'dashed',
                backgroundColor: COLORS.savanna,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Ionicons name="add" size={28} color={COLORS.earth} />
              <Text style={{ fontSize: 12, color: COLORS.textSecondary, textAlign: 'center' }}>Add photo</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
