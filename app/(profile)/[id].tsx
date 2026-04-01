import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Dimensions,
  Share,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import { useDiscoverStore } from '@/store/discover.store';
import { User } from '@/types';
import { COLORS, DEFAULT_AVATAR } from '@/constants';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';

const { width } = Dimensions.get('window');

export default function ProfileViewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: currentUser } = useAuthStore();
  const { getOrCreateConversation } = useChatStore();
  const { likedUserIds, toggleLike } = useDiscoverStore();

  const [profile, setProfile] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) {
          const today = new Date();
          const age = today.getFullYear() - new Date(data.birthdate).getFullYear();
          setProfile({ ...data, age });
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

  const photos = profile.profile_photos.length > 0
    ? profile.profile_photos
    : [profile.avatar_url || `${DEFAULT_AVATAR}${encodeURIComponent(profile.full_name.charAt(0))}`];

  const location = [profile.city, profile.state, profile.country].filter(Boolean).join(', ');
  const isLiked = likedUserIds.has(profile.id);
  const isOwnProfile = currentUser?.id === profile.id;

  const handleLike = () => {
    if (!currentUser) return;
    toggleLike(currentUser.id, profile.id);
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
    Alert.alert('Report User', `Report ${profile.full_name} for inappropriate behavior?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report',
        style: 'destructive',
        onPress: () => Alert.alert('Reported', 'Thank you. Our team will review this report.'),
      },
    ]);
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

          {/* Back button */}
          <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16 }}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(0,0,0,0.4)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="arrow-back" size={22} color="#FFF" />
              </TouchableOpacity>

              {!isOwnProfile && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={handleReport}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: 'rgba(0,0,0,0.4)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="flag-outline" size={20} color="#FFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleBlock}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: 'rgba(0,0,0,0.4)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="ban-outline" size={20} color="#FFF" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </SafeAreaView>

          {/* Online status overlay */}
          <View
            style={{
              position: 'absolute',
              top: 60,
              right: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              backgroundColor: 'rgba(0,0,0,0.5)',
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 12,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor:
                  profile.online_status === 'online' ? COLORS.online :
                  profile.online_status === 'away' ? COLORS.away : COLORS.offline,
              }}
            />
            <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '600', textTransform: 'capitalize' }}>
              {profile.online_status}
            </Text>
          </View>
        </View>

        {/* Profile Info */}
        <View style={{ padding: 20, backgroundColor: '#FFFFFF', marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 28, fontWeight: '800', color: COLORS.text }}>
                {profile.full_name}{profile.age ? `, ${profile.age}` : ''}
              </Text>
              <Text style={{ fontSize: 14, color: COLORS.textSecondary, marginTop: 2 }}>
                @{profile.username}
              </Text>
            </View>
          </View>

          {location ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 }}>
              <Ionicons name="location-outline" size={15} color={COLORS.primary} />
              <Text style={{ fontSize: 14, color: COLORS.textSecondary }}>{location}</Text>
            </View>
          ) : null}

          {profile.looking_for.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
              {profile.looking_for.map((lf) => (
                <Badge key={lf} label={lf} variant="secondary" />
              ))}
            </View>
          )}

          {profile.bio && (
            <View style={{ marginTop: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                About
              </Text>
              <Text style={{ fontSize: 15, color: COLORS.text, lineHeight: 23 }}>{profile.bio}</Text>
            </View>
          )}
        </View>

        {/* Details */}
        <View style={{ backgroundColor: '#FFFFFF', padding: 20, marginBottom: 100 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Details
          </Text>
          {[
            { icon: 'person-outline', label: 'Gender', value: profile.gender.replace('_', ' ') },
            { icon: 'calendar-outline', label: 'Age', value: `${profile.age} years old` },
            { icon: 'location-outline', label: 'Location', value: location || 'Not specified' },
          ].map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: `${COLORS.primary}12`,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={17} color={COLORS.primary} />
              </View>
              <View>
                <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>{item.label}</Text>
                <Text style={{ fontSize: 14, color: COLORS.text, fontWeight: '600', textTransform: 'capitalize' }}>
                  {item.value}
                </Text>
              </View>
            </View>
          ))}
        </View>
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
            paddingBottom: 32,
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
    </View>
  );
}
