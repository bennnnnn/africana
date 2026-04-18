import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/store/auth.store';
import { uploadVerificationSelfie } from '@/lib/storage-image-upload';
import { useTheme } from '@/theme/ThemeProvider';
import { Button } from '@/components/ui/Button';
import { useDialog } from '@/components/ui/DialogProvider';
import { SettingsHeaderBar } from '@/components/settings/SettingsHeaderBar';
import { checkImageHasFace } from '@/lib/face-detection';
import { track, EVENTS } from '@/lib/analytics';

export default function VerifyScreen() {
  const { colors } = useTheme();
  const { user, updateProfile } = useAuthStore();
  const { showDialog } = useDialog();
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [selfieMime, setSelfieMime] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const status = user?.verification_status;

  const acceptAssetIfFace = async (a: ImagePicker.ImagePickerAsset) => {
    const faceCheck = await checkImageHasFace(a.uri);
    if (!faceCheck.ok && faceCheck.reason === 'no_face') {
      showDialog({
        title: "We couldn't find a face",
        message:
          'Your verification photo must clearly show your face. Please take a selfie in good lighting with your face centered.',
        icon: 'happy-outline',
      });
      return;
    }
    setSelfieUri(a.uri);
    setSelfieMime(a.mimeType ?? null);
  };

  const pickSelfie = () => {
    showDialog({
      title: 'Add a photo',
      message: 'Choose how to add your verification photo.',
      icon: 'camera-outline',
      actions: [
        {
          label: 'Take a selfie',
          style: 'primary',
          onPress: async () => {
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              allowsEditing: false,
              quality: 0.7,
            });
            if (!result.canceled && result.assets[0]) {
              await acceptAssetIfFace(result.assets[0]);
            }
          },
        },
        {
          label: 'Choose from library',
          style: 'secondary',
          onPress: async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: false,
              quality: 0.7,
            });
            if (!result.canceled && result.assets[0]) {
              await acceptAssetIfFace(result.assets[0]);
            }
          },
        },
        { label: 'Cancel', style: 'cancel' },
      ],
    });
  };

  const handleSubmit = async () => {
    if (!user || !selfieUri) return;
    setUploading(true);
    try {
      const out = await uploadVerificationSelfie(user.id, selfieUri, selfieMime);
      if ('error' in out) throw new Error(out.error);
      const publicUrl = out.publicUrl;

      await updateProfile({
        verification_status: 'pending',
        verification_photo: publicUrl,
      } as any);

      track(EVENTS.VERIFICATION_COMPLETE);

      showDialog({
        title: 'Submitted',
        message: 'Your verification selfie has been submitted. We will review it within 24 to 48 hours.',
        icon: 'checkmark-circle-outline',
        actions: [
          { label: 'OK', style: 'primary', onPress: () => router.back() },
        ],
      });
    } catch (e: any) {
      showDialog({
        title: 'Upload failed',
        message: e.message ?? 'Please try again.',
        icon: 'alert-circle-outline',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <SettingsHeaderBar title="Profile verification" titleAlign="leading" />

      <ScrollView contentContainerStyle={{ padding: 24 }}>
        {/* Status badge */}
        {status === 'pending' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: colors.border }}>
            <Ionicons name="time-outline" size={22} color="#111111" />
            <Text style={{ flex: 1, fontSize: 14, color: '#111111', fontWeight: '600' }}>
              Verification pending — we're reviewing your submission. This usually takes 24–48 hours.
            </Text>
          </View>
        )}
        {status === 'approved' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: colors.border }}>
            <Ionicons name="checkmark-circle" size={22} color="#111111" />
            <Text style={{ flex: 1, fontSize: 14, color: '#111111', fontWeight: '600' }}>
              Your profile is verified! A blue badge appears on your profile for all members to see.
            </Text>
          </View>
        )}
        {status === 'rejected' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: colors.border }}>
            <Ionicons name="close-circle" size={22} color="#111111" />
            <Text style={{ flex: 1, fontSize: 14, color: '#111111', fontWeight: '600' }}>
              Your previous submission was rejected. Please try again with a clear, well-lit photo of your face.
            </Text>
          </View>
        )}

        {/* Hero icon */}
        <View style={{ alignItems: 'center', marginBottom: 28 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Ionicons name="shield-checkmark-outline" size={38} color="#111111" />
          </View>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#111111', textAlign: 'center' }}>
            {status === 'approved' ? 'You\'re Verified' : 'Get Verified'}
          </Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 21, marginTop: 8, paddingHorizontal: 16 }}>
            A verified badge shows other members your profile is real, increasing your match rate significantly.
          </Text>
        </View>

        {/* Steps */}
        {[
          { icon: 'camera-outline', title: 'Take a selfie', desc: 'Use your front camera. Make sure your face is clearly visible.' },
          { icon: 'cloud-upload-outline', title: 'Submit for review', desc: 'Our team reviews selfies manually within 24–48 hours.' },
          { icon: 'checkmark-circle-outline', title: 'Get your badge', desc: 'A blue checkmark badge will appear on your profile.' },
        ].map((step, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 14, marginBottom: 20 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Ionicons name={step.icon as any} size={20} color="#111111" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#111111' }}>{step.title}</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2, lineHeight: 19 }}>{step.desc}</Text>
            </View>
          </View>
        ))}

        {status !== 'approved' && (
          <>
            {/* Selfie preview */}
            {selfieUri ? (
              <TouchableOpacity onPress={pickSelfie} style={{ alignItems: 'center', marginBottom: 20 }}>
                <Image
                  source={{ uri: selfieUri }}
                  style={{ width: 160, height: 160, borderRadius: 80, borderWidth: 2, borderColor: '#111111' }}
                  contentFit="cover"
                />
                <Text style={{ marginTop: 8, fontSize: 13, color: '#111111', fontWeight: '600' }}>Tap to retake</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={pickSelfie}
                style={{ alignItems: 'center', justifyContent: 'center', height: 160, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border, marginBottom: 20 }}
              >
                <Ionicons name="camera-outline" size={32} color="#111111" />
                <Text style={{ marginTop: 8, fontSize: 14, color: '#111111' }}>Take a selfie</Text>
              </TouchableOpacity>
            )}

            <Button
              title={uploading ? 'Uploading…' : (status === 'pending' ? 'Resubmit' : 'Submit for Verification')}
              onPress={handleSubmit}
              disabled={!selfieUri || uploading}
              fullWidth
              size="lg"
              style={{ backgroundColor: '#111111', borderWidth: 1, borderColor: '#111111' }}
              textStyle={{ color: '#FFFFFF' }}
            />
            {uploading && <ActivityIndicator style={{ marginTop: 12 }} color="#111111" />}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
