import React from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth.store';
import { Badge } from '@/components/ui/Badge';
import { COLORS, DEFAULT_AVATAR } from '@/constants';

const { width } = Dimensions.get('window');

export default function MyProfileScreen() {
  const { user } = useAuthStore();

  if (!user) return null;

  const avatar = user.avatar_url || user.profile_photos[0] || `${DEFAULT_AVATAR}${encodeURIComponent(user.full_name.charAt(0))}`;
  const location = [user.city, user.state, user.country].filter(Boolean).join(', ');
  const today = new Date();
  const age = today.getFullYear() - new Date(user.birthdate).getFullYear();
  const photoCount = user.profile_photos.length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
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
          <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.text }}>My Profile</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity onPress={() => router.push('/(profile)/edit')}>
              <Ionicons name="create-outline" size={24} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(settings)/main')}>
              <Ionicons name="settings-outline" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Hero */}
        <View style={{ backgroundColor: '#FFFFFF', marginBottom: 8 }}>
          <View style={{ position: 'relative' }}>
            <Image
              source={{ uri: avatar }}
              style={{ width, height: width * 0.6 }}
              contentFit="cover"
            />
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '50%',
                backgroundColor: 'transparent',
              }}
            />
          </View>

          <View style={{ padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontSize: 26, fontWeight: '800', color: COLORS.text }}>
                  {user.full_name}, {age}
                </Text>
                <Text style={{ fontSize: 14, color: COLORS.textSecondary, marginTop: 2 }}>
                  @{user.username}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                  backgroundColor: user.online_status === 'online' ? `${COLORS.online}20` : `${COLORS.offline}20`,
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: user.online_status === 'online' ? COLORS.online : COLORS.offline,
                  }}
                />
                <Text style={{ fontSize: 12, fontWeight: '600', color: user.online_status === 'online' ? COLORS.online : COLORS.textSecondary }}>
                  {user.online_status === 'online' ? 'Online' : 'Offline'}
                </Text>
              </View>
            </View>

            {location ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 }}>
                <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
                <Text style={{ fontSize: 14, color: COLORS.textSecondary }}>{location}</Text>
              </View>
            ) : null}

            {user.bio ? (
              <Text style={{ fontSize: 15, color: COLORS.text, marginTop: 12, lineHeight: 22 }}>
                {user.bio}
              </Text>
            ) : (
              <TouchableOpacity
                onPress={() => router.push('/(profile)/edit')}
                style={{
                  marginTop: 12,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  borderStyle: 'dashed',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: COLORS.textSecondary, fontSize: 14 }}>
                  + Add a bio to attract more matches
                </Text>
              </TouchableOpacity>
            )}

            {user.looking_for.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                {user.looking_for.map((lf) => (
                  <Badge key={lf} label={lf} variant="secondary" />
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Stats */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: '#FFFFFF',
            marginBottom: 8,
            borderRadius: 0,
          }}
        >
          {[
            { label: 'Photos', value: photoCount, icon: 'images-outline' as const },
            { label: 'Likes', value: '—', icon: 'heart-outline' as const },
            { label: 'Views', value: '—', icon: 'eye-outline' as const },
          ].map((stat, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 18,
                borderRightWidth: i < 2 ? 1 : 0,
                borderRightColor: COLORS.border,
              }}
            >
              <Ionicons name={stat.icon} size={20} color={COLORS.primary} />
              <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text, marginTop: 4 }}>
                {stat.value}
              </Text>
              <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Photos Grid Preview */}
        {user.profile_photos.length > 0 && (
          <View style={{ backgroundColor: '#FFFFFF', padding: 16, marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>Photos</Text>
              <TouchableOpacity onPress={() => router.push('/(profile)/edit')}>
                <Text style={{ fontSize: 14, color: COLORS.primary, fontWeight: '600' }}>Edit</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {user.profile_photos.slice(0, 6).map((photo, i) => (
                <Image
                  key={i}
                  source={{ uri: photo }}
                  style={{ width: (width - 48) / 3, height: (width - 48) / 3, borderRadius: 8 }}
                  contentFit="cover"
                />
              ))}
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={{ backgroundColor: '#FFFFFF', marginBottom: 8 }}>
          {[
            { icon: 'create-outline', label: 'Edit Profile', route: '/(profile)/edit' as const },
            { icon: 'images-outline', label: 'Manage Photos', route: '/(profile)/photos' as const },
            { icon: 'settings-outline', label: 'Settings', route: '/(settings)/main' as const },
          ].map((item, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => router.push(item.route)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                borderBottomWidth: i < 2 ? 1 : 0,
                borderBottomColor: COLORS.border,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: `${COLORS.primary}15`,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={18} color={COLORS.primary} />
              </View>
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '500', color: COLORS.text }}>
                {item.label}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
