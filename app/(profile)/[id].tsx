import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,

  Alert,
  ActivityIndicator,
  Dimensions,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { notifyUser } from '@/lib/notifications';
import { useAuthStore } from '@/store/auth.store';
import { MOCK_USERS } from '@/lib/mock-data';
import { useChatStore } from '@/store/chat.store';
import { useDiscoverStore } from '@/store/discover.store';
import { User } from '@/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, DEFAULT_AVATAR, RELIGION_OPTIONS, EDUCATION_OPTIONS, MARITAL_STATUS_OPTIONS, LOOKING_FOR_OPTIONS, WANT_CHILDREN_OPTIONS } from '@/constants';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { MatchModal } from '@/components/ui/MatchModal';

const { width } = Dimensions.get('window');

export default function ProfileViewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: currentUser } = useAuthStore();
  const { getOrCreateConversation } = useChatStore();
  const { likedUserIds, toggleLike } = useDiscoverStore();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [matchUser, setMatchUser] = useState<User | null>(null);

  useEffect(() => {
    if (!id) return;

    // Serve mock data instantly for mock user IDs (no DB round-trip needed)
    if (String(id).startsWith('mock-')) {
      const today = new Date();
      const mock = MOCK_USERS.find((u) => u.id === id);
      if (mock) {
        const bday = mock.birthdate ? new Date(mock.birthdate) : null;
        const age = bday
          ? today.getFullYear() - bday.getFullYear()
            - (today < new Date(today.getFullYear(), bday.getMonth(), bday.getDate()) ? 1 : 0)
          : undefined;
        setProfile({ ...mock, age, profile_photos: mock.profile_photos ?? [], languages: mock.languages ?? [] });
      }
      setIsLoading(false);
      return;
    }

    supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) {
          const today = new Date();
          const bday = data.birthdate ? new Date(data.birthdate) : null;
          const age = bday
            ? today.getFullYear() - bday.getFullYear()
              - (today < new Date(today.getFullYear(), bday.getMonth(), bday.getDate()) ? 1 : 0)
            : undefined;
          setProfile({ ...data, age, profile_photos: data.profile_photos ?? [], languages: data.languages ?? [] });

          // Record profile view (upsert so we don't spam rows)
          if (currentUser && currentUser.id !== id) {
            supabase.from('profile_views').upsert(
              { viewer_id: currentUser.id, viewed_id: id, viewed_at: new Date().toISOString() },
              { onConflict: 'viewer_id,viewed_id' },
            );
            // Notify the viewed user (respects their notify_views preference)
            notifyUser({
              type: 'view',
              recipientId: id as string,
              senderId: currentUser.id,
              senderName: currentUser.full_name ?? 'Someone',
              extra: { userId: currentUser.id },
            });
          }
        }
        setIsLoading(false);
      });
  }, [id]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Profile not found</Text>
        <Button title="Go Back" onPress={() => router.back()} style={{ marginTop: 16 }} />
      </SafeAreaView>
    );
  }

  const religionLabel = profile.religion
    ? RELIGION_OPTIONS.find(r => r.value === profile.religion)?.label ?? profile.religion
    : null;
  const educationLabel = profile.education
    ? EDUCATION_OPTIONS.find(e => e.value === profile.education)?.label ?? profile.education
    : null;
  const maritalLabel = profile.marital_status
    ? MARITAL_STATUS_OPTIONS.find(m => m.value === profile.marital_status)?.label ?? profile.marital_status
    : null;

  const safePhotos = profile.profile_photos ?? [];
  const photos = safePhotos.length > 0
    ? safePhotos
    : [profile.avatar_url || `${DEFAULT_AVATAR}${encodeURIComponent(profile.full_name.charAt(0))}`];

  const location = [profile.city, profile.state, profile.country].filter(Boolean).join(', ');
  const isLiked = likedUserIds.has(profile.id);
  const isOwnProfile = currentUser?.id === profile.id;

  const handleLike = async () => {
    if (!currentUser) return;
    const wasLiked = likedUserIds.has(profile.id);
    const isMatch = await toggleLike(currentUser.id, profile.id);
    if (isMatch && !wasLiked) {
      setMatchUser(profile);
    }
  };

  const handleMessage = async () => {
    if (!currentUser) return;
    const convId = await getOrCreateConversation(currentUser.id, profile.id);
    if (convId) router.push(`/(chat)/${convId}`);
  };

  const handleBlock = () => {
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${profile.full_name}? They won't be able to see your profile or contact you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            if (!currentUser) return;
            await supabase.from('blocks').insert({
              blocker_id: currentUser.id,
              blocked_id: profile.id,
            });
            Alert.alert('Blocked', `${profile.full_name} has been blocked.`);
            router.back();
          },
        },
      ]
    );
  };

  const handleReport = () => {
    const reasons = [
      'Fake profile / impersonation',
      'Inappropriate photos',
      'Harassment or abuse',
      'Spam or scam',
      'Underage user',
      'Other',
    ];
    Alert.alert(
      `Report ${profile.full_name}`,
      'Select a reason for reporting:',
      [
        ...reasons.map((reason) => ({
          text: reason,
          onPress: async () => {
            if (!currentUser) return;
            await supabase.from('reports').insert({
              reporter_id: currentUser.id,
              reported_id: profile.id,
              reason,
            });
            Alert.alert('Report Submitted', 'Thank you. Our team will review this within 24 hours.');
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Photo Carousel */}
        <View style={{ position: 'relative', backgroundColor: '#000' }}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / width));
            }}
          >
            {photos.map((photo, i) => (
              <Image
                key={i}
                source={{ uri: photo }}
                style={{ width, height: width * 1.1 }}
                contentFit="cover"
              />
            ))}
          </ScrollView>

          {/* Photo dots */}
          {photos.length > 1 && (
            <View
              style={{
                position: 'absolute',
                bottom: 16,
                left: 0,
                right: 0,
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              {photos.map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: i === photoIndex ? 20 : 7,
                    height: 7,
                    borderRadius: 3.5,
                    backgroundColor: i === photoIndex ? '#FFF' : 'rgba(255,255,255,0.5)',
                  }}
                />
              ))}
            </View>
          )}

          {/* Back button + report/block — row at top of photo */}
          <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16 }}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={{
                  width: 40, height: 40, borderRadius: 20,
                  backgroundColor: 'rgba(0,0,0,0.4)',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="arrow-back" size={22} color="#FFF" />
              </TouchableOpacity>

              {!isOwnProfile && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={handleReport}
                    style={{
                      width: 40, height: 40, borderRadius: 20,
                      backgroundColor: 'rgba(0,0,0,0.4)',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="flag-outline" size={20} color="#FFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleBlock}
                    style={{
                      width: 40, height: 40, borderRadius: 20,
                      backgroundColor: 'rgba(0,0,0,0.4)',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="ban-outline" size={20} color="#FFF" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </SafeAreaView>
        </View>

        {/* Profile Info */}
        <View style={{ padding: 20, backgroundColor: '#FFFFFF', marginBottom: 8 }}>
          {/* Name + status inline */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 26, fontWeight: '800', color: COLORS.text }}>
              {profile.full_name}{profile.age ? `, ${profile.age}` : ''}
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              backgroundColor:
                profile.online_status === 'online' ? `${COLORS.online}20` : `${COLORS.offline}18`,
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
            }}>
              <View style={{
                width: 7, height: 7, borderRadius: 4,
                backgroundColor:
                  profile.online_status === 'online' ? COLORS.online : COLORS.offline,
              }} />
              <Text style={{
                fontSize: 11, fontWeight: '600', textTransform: 'capitalize',
                color: profile.online_status === 'online' ? COLORS.online : COLORS.textSecondary,
              }}>
                {profile.online_status === 'online'
                  ? 'Online'
                  : `Last seen ${formatLastSeen(profile.last_seen)}`}
              </Text>
            </View>
          </View>

          {location ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
              <Ionicons name="location-outline" size={14} color={COLORS.primary} />
              <Text style={{ fontSize: 14, color: COLORS.textSecondary }}>{location}</Text>
            </View>
          ) : null}

          {profile.looking_for.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
              {profile.looking_for.map((lf) => {
                const label = LOOKING_FOR_OPTIONS.find((o) => o.value === lf)?.label ?? lf.replace('_', ' ');
                return <Badge key={lf} label={label} variant="secondary" />;
              })}
            </View>
          )}

          {profile.bio && (
            <View style={{ marginTop: 16 }}>
              <Text style={detailSectionLabel}>About</Text>
              <Text style={{ fontSize: 15, color: COLORS.text, lineHeight: 23 }}>{profile.bio}</Text>
            </View>
          )}
        </View>

        {/* Details grid */}
        <View style={{ backgroundColor: '#FFFFFF', padding: 20, marginBottom: 8 }}>
          <Text style={detailSectionLabel}>Profile Details</Text>
          <View style={{ gap: 2 }}>
            {buildDetailRows(profile, religionLabel, educationLabel, maritalLabel).map((item, i) => (
              <View key={i} style={detailRow}>
                <View style={detailIconBox}>
                  <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={16} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={detailLabel}>{item.label}</Text>
                  <Text style={detailValue}>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Languages */}
        {profile.languages && profile.languages.length > 0 && (
          <View style={{ backgroundColor: '#FFFFFF', padding: 20, marginBottom: 8 }}>
            <Text style={detailSectionLabel}>Languages</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {profile.languages.map((lang) => (
                <View key={lang} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: COLORS.savanna }}>
                  <Text style={{ fontSize: 13, color: COLORS.earth, fontWeight: '600' }}>{lang}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Fixed Action Bar */}
      {!isOwnProfile && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: COLORS.border,
            flexDirection: 'row',
            padding: 16,
            gap: 12,
            paddingBottom: Math.max(insets.bottom + 8, 20),
          }}
        >
          <TouchableOpacity
            onPress={handleLike}
            style={{
              width: 54,
              height: 54,
              borderRadius: 27,
              borderWidth: 1.5,
              borderColor: isLiked ? COLORS.primary : COLORS.border,
              backgroundColor: isLiked ? `${COLORS.primary}12` : '#FFF',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={24} color={isLiked ? COLORS.primary : COLORS.textSecondary} />
          </TouchableOpacity>
          <Button
            title="Send Message"
            onPress={handleMessage}
            style={{ flex: 1, height: 54, borderRadius: 27 }}
            size="lg"
          />
        </View>
      )}

      <MatchModal
        visible={!!matchUser}
        matchedUser={matchUser}
        onClose={() => setMatchUser(null)}
      />
    </View>
  );
}

// ── Helpers ─────────────────────────────────────────────────

function formatLastSeen(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  < 7)   return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const GENDER_LABEL: Record<string, string> = { male: 'Man', female: 'Woman' };
const INTERESTED_IN_LABEL: Record<string, string> = { men: 'Men', women: 'Women', everyone: 'Everyone' };

function buildDetailRows(
  p: User,
  religionLabel: string | null,
  educationLabel: string | null,
  maritalLabel: string | null,
) {
  const rows: { icon: string; label: string; value: string }[] = [];
  rows.push({ icon: 'person-outline',    label: 'Gender',       value: GENDER_LABEL[p.gender] ?? p.gender });
  if (p.age)          rows.push({ icon: 'calendar-outline',  label: 'Age',          value: `${p.age} years old` });
  if (maritalLabel)   rows.push({ icon: 'heart-outline',     label: 'Status',       value: maritalLabel });
  if (p.height_cm)    rows.push({ icon: 'resize-outline',    label: 'Height',       value: `${p.height_cm} cm` });
  if (religionLabel)  rows.push({ icon: 'sunny-outline',     label: 'Religion',     value: religionLabel });
  if (educationLabel) rows.push({ icon: 'school-outline',    label: 'Education',    value: educationLabel });
  if (p.occupation)   rows.push({ icon: 'briefcase-outline', label: 'Work',         value: p.occupation });
  if (p.ethnicity)    rows.push({ icon: 'globe-outline',     label: 'Ethnicity',    value: p.ethnicity });
  if (p.has_children != null)
    rows.push({ icon: 'people-outline',  label: 'Children',    value: p.has_children ? 'Has children' : 'No children' });
  if (p.want_children) {
    const wantLabel = WANT_CHILDREN_OPTIONS.find((o) => o.value === p.want_children)?.label ?? p.want_children;
    rows.push({ icon: 'happy-outline',   label: 'Wants children', value: wantLabel });
  }
  if (p.interested_in)
    rows.push({ icon: 'search-outline',  label: 'Interested in', value: INTERESTED_IN_LABEL[p.interested_in] ?? p.interested_in });
  return rows;
}

const detailSectionLabel: import('react-native').TextStyle = {
  fontSize: 12, fontWeight: '700', color: COLORS.textSecondary,
  textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14,
};
const detailRow: import('react-native').ViewStyle = {
  flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8,
  borderBottomWidth: 1, borderBottomColor: COLORS.border,
};
const detailIconBox: import('react-native').ViewStyle = {
  width: 34, height: 34, borderRadius: 10,
  backgroundColor: `${COLORS.primary}12`,
  alignItems: 'center', justifyContent: 'center',
};
const detailLabel: import('react-native').TextStyle = {
  fontSize: 11, color: COLORS.textMuted, textTransform: 'capitalize',
};
const detailValue: import('react-native').TextStyle = {
  fontSize: 14, color: COLORS.text, fontWeight: '600', textTransform: 'capitalize', marginTop: 1,
};
