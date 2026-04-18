import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth.store';
import { uploadToAvatarsBucket } from '@/lib/storage-image-upload';
import { COLORS, MAX_PROFILE_PHOTOS } from '@/constants';
import { appDialog } from '@/lib/app-dialog';
import { validateFacesInPhotos, faceRejectionMessage } from '@/lib/face-detection';

const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - 56) / 3;

export default function PhotosScreen() {
  const { user, updateProfile } = useAuthStore();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  if (!user) return null;

  const photos = user.profile_photos ?? [];

  const addPhotos = async () => {
    const remaining = MAX_PROFILE_PHOTOS - photos.length;
    if (remaining <= 0) {
      appDialog({ title: 'Limit reached', message: `You can have at most ${MAX_PROFILE_PHOTOS} photos.` });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (result.canceled || result.assets.length === 0) return;

    const picked = result.assets.slice(0, remaining);
    setUploading(true);
    const uploaded: string[] = [];

    try {
      setUploadProgress('Checking photos…');
      const { approved, rejected } = await validateFacesInPhotos(picked.map((a) => a.uri));
      if (rejected.length > 0) {
        const { title, message } = faceRejectionMessage(rejected.length, approved.length);
        appDialog({ title, message, icon: 'happy-outline' });
      }
      const toUpload = picked.filter((a) => approved.includes(a.uri));
      if (toUpload.length === 0) return;

      for (let i = 0; i < toUpload.length; i++) {
        setUploadProgress(`Uploading ${i + 1} of ${toUpload.length}…`);
        const asset = toUpload[i];
        const out = await uploadToAvatarsBucket(user.id, asset.uri, asset.mimeType);
        if (!('error' in out)) uploaded.push(out.publicUrl);
      }

      if (uploaded.length === 0) {
        appDialog({ title: 'Upload failed', message: 'Could not upload photos.', icon: 'cloud-offline-outline' });
        return;
      }

      const updatedPhotos = [...photos, ...uploaded];
      await updateProfile({
        profile_photos: updatedPhotos,
        avatar_url: updatedPhotos[0],
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong.';
      appDialog({ title: 'Could not save photos', message: msg, icon: 'alert-circle-outline' });
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  const removePhoto = (photoUrl: string) => {
    appDialog({
      title: 'Remove photo',
      message: 'Remove this photo from your profile?',
      icon: 'trash-outline',
      actions: [
        { label: 'Cancel', style: 'cancel' },
        {
          label: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const updatedPhotos = photos.filter((p) => p !== photoUrl);
            try {
              await updateProfile({
                profile_photos: updatedPhotos,
                avatar_url: updatedPhotos[0] ?? null,
              });
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : 'Something went wrong.';
              appDialog({ title: 'Could not remove photo', message: msg, icon: 'alert-circle-outline' });
            }
          },
        },
      ],
    });
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
        {photos.length < MAX_PROFILE_PHOTOS ? (
          <TouchableOpacity onPress={addPhotos} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Ionicons name="add-circle" size={28} color={COLORS.primary} />
            )}
          </TouchableOpacity>
        ) : (
          <View style={{ width: 28, height: 28 }} />
        )}
      </View>

      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 16, textAlign: 'center' }}>
          {uploading
            ? uploadProgress
            : `${photos.length}/${MAX_PROFILE_PHOTOS} photos • First is your main picture • Long press to remove`}
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
              <Pressable
                style={{ flex: 1 }}
                onLongPress={() => removePhoto(photo)}
                delayLongPress={450}
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
              </Pressable>

              {i !== 0 && (
                <View style={{ position: 'absolute', top: 6, right: 6 }}>
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
                </View>
              )}
            </View>
          ))}

          {photos.length < MAX_PROFILE_PHOTOS && (
            <TouchableOpacity
              onPress={addPhotos}
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
