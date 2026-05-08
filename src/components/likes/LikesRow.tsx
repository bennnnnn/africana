import React, { memo, useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { User } from '@/types';
import { COLORS, DEFAULT_AVATAR } from '@/constants';
import { getEffectivePresence } from '@/lib/utils';
import { profileImageUrlForList } from '@/lib/storage-image-url';
import { usePresenceStore } from '@/store/presence.store';
import { likesScreenStyles as s } from '@/components/likes/likes-screen-styles';

export const LikesRow = memo(function LikesRow({
  user: u,
  isMutual,
  isNew,
  showMessageButton,
  onPress,
  onMessagePress,
}: {
  user: User;
  isMutual: boolean;
  isNew?: boolean;
  showMessageButton: boolean;
  onPress: (u: User) => void;
  onMessagePress: (id: string) => void;
}) {
  const avatarRaw =
    u.avatar_url ||
    (u.profile_photos ?? [])[0] ||
    `${DEFAULT_AVATAR}${encodeURIComponent((u.full_name ?? '?').charAt(0))}`;
  const avatar = profileImageUrlForList(avatarRaw) ?? avatarRaw;

  const age = useMemo(() => {
    if (!u.birthdate) return null;
    const today = new Date();
    const bday = new Date(u.birthdate);
    let years = today.getFullYear() - bday.getFullYear();
    const monthDiff = today.getMonth() - bday.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < bday.getDate())) {
      years--;
    }
    return years;
  }, [u.birthdate]);

  const location = useMemo(
    () => [u.city, u.country].filter(Boolean).join(', '),
    [u.city, u.country],
  );

  const peerOnlineIds = usePresenceStore((s) => s.peerOnlineIds);
  const isOnline =
    getEffectivePresence(
      {
        id: u.id,
        online_visible: u.online_visible,
        online_status: u.online_status,
        last_seen: u.last_seen,
      },
      peerOnlineIds,
    ) === 'online';

  return (
    <TouchableOpacity
      onPress={() => onPress(u)}
      style={[s.row, isNew ? s.rowNew : null]}
      activeOpacity={0.82}
    >
      <View style={s.avatarWrap}>
        <Image
          source={{ uri: avatar }}
          style={s.avatar}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={0}
          recyclingKey={u.id}
        />
        <View
          style={[s.onlineDot, { backgroundColor: isOnline ? COLORS.online : COLORS.offline }]}
        />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={s.rowName} numberOfLines={1}>
            {u.full_name}
            {age ? `, ${age}` : ''}
          </Text>
          {isMutual ? <Text style={{ fontSize: 12 }}>💕</Text> : null}
        </View>
        {location ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
            <Ionicons name="location-outline" size={11} color={COLORS.textSecondary} />
            <Text style={s.rowLoc} numberOfLines={1}>
              {location}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {isNew ? (
          <View style={s.newPill}>
            <Text style={s.newPillText}>NEW</Text>
          </View>
        ) : null}
        {showMessageButton ? (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onMessagePress(u.id);
            }}
            style={s.msgBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chatbubble-ellipses" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        ) : !isNew ? (
          <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
        ) : null}
      </View>
    </TouchableOpacity>
  );
});
