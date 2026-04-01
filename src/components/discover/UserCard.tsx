import React from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { User } from '@/types';
import { COLORS, DEFAULT_AVATAR } from '@/constants';
import { Badge } from '@/components/ui/Badge';

interface UserCardProps {
  user: User;
  isLiked: boolean;
  onLike: (userId: string) => void;
  onMessage: (userId: string) => void;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

export function UserCard({ user, isLiked, onLike, onMessage }: UserCardProps) {
  const avatar = user.avatar_url || user.profile_photos[0] || `${DEFAULT_AVATAR}${encodeURIComponent(user.full_name.charAt(0))}`;
  const location = [user.city, user.state, user.country].filter(Boolean).join(', ');

  const statusColor =
    user.online_status === 'online' ? COLORS.online :
    user.online_status === 'away' ? COLORS.away :
    COLORS.offline;

  return (
    <TouchableOpacity
      onPress={() => router.push(`/profile/${user.id}`)}
      activeOpacity={0.95}
      style={{
        width: CARD_WIDTH,
        borderRadius: 16,
        backgroundColor: COLORS.card,
        marginBottom: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      <View style={{ position: 'relative' }}>
        <Image
          source={{ uri: avatar }}
          style={{ width: CARD_WIDTH, height: CARD_WIDTH * 1.2 }}
          contentFit="cover"
          transition={300}
        />
        {/* Online status dot */}
        <View
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: statusColor,
            borderWidth: 2,
            borderColor: '#FFFFFF',
          }}
        />
        {/* Photo count */}
        {user.profile_photos.length > 1 && (
          <View
            style={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              backgroundColor: 'rgba(0,0,0,0.5)',
              borderRadius: 10,
              paddingHorizontal: 8,
              paddingVertical: 2,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Ionicons name="images-outline" size={12} color="#FFF" />
            <Text style={{ color: '#FFF', fontSize: 11 }}>{user.profile_photos.length}</Text>
          </View>
        )}
      </View>

      <View style={{ padding: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text, flex: 1 }} numberOfLines={1}>
            {user.full_name}
          </Text>
          {user.age && (
            <Text style={{ fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' }}>
              {user.age}
            </Text>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }}>
          <Ionicons name="location-outline" size={12} color={COLORS.textSecondary} />
          <Text style={{ fontSize: 11, color: COLORS.textSecondary, flex: 1 }} numberOfLines={1}>
            {location}
          </Text>
        </View>

        {user.looking_for.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
            {user.looking_for.slice(0, 2).map((lf) => (
              <Badge key={lf} label={lf} variant="outline" size="sm" />
            ))}
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <TouchableOpacity
            onPress={() => onLike(user.id)}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: isLiked ? `${COLORS.primary}15` : COLORS.savanna,
            }}
          >
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={20}
              color={isLiked ? COLORS.primary : COLORS.earthLight}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onMessage(user.id)}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: COLORS.savanna,
            }}
          >
            <Ionicons name="chatbubble-outline" size={20} color={COLORS.earth} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}
