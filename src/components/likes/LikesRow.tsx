import React, { memo, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
  locked = false,
  onPress,
  onMessagePress,
}: {
  user: User;
  isMutual: boolean;
  isNew?: boolean;
  showMessageButton: boolean;
  /** Blur identity — used for free-tier Views tab teaser rows. */
  locked?: boolean;
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
      accessibilityRole="button"
      accessibilityLabel={
        locked
          ? 'Someone viewed your profile. Upgrade to Pro to see who.'
          : `${u.full_name ?? 'Profile'}${age ? `, ${age}` : ''}`
      }
    >
      <View style={[s.avatarWrap, locked ? lockedStyles.avatarClip : null]}>
        {locked ? (
          <View style={[s.avatar, lockedStyles.placeholderAvatar]}>
            <Ionicons name="person" size={22} color={COLORS.textMuted} />
            <View style={lockedStyles.lockBadge}>
              <Ionicons name="lock-closed" size={14} color={COLORS.white} />
            </View>
          </View>
        ) : (
          <>
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
          </>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[s.rowName, isNew ? s.rowNameNew : null]} numberOfLines={1}>
            {locked ? 'Someone' : u.full_name}
            {!locked && age ? `, ${age}` : ''}
          </Text>
          {!locked && isMutual ? <Text style={{ fontSize: 12 }}>💕</Text> : null}
        </View>
        {locked ? (
          <Text style={[s.rowLoc, isNew ? s.rowLocNew : null, { marginTop: 2 }]} numberOfLines={1}>
            Tap to unlock with Pro
          </Text>
        ) : location ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
            <Ionicons name="location-outline" size={11} color={COLORS.textSecondary} />
            <Text style={[s.rowLoc, isNew ? s.rowLocNew : null]} numberOfLines={1}>
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
        ) : locked ? (
          <Ionicons name="lock-closed" size={16} color={COLORS.textMuted} />
        ) : !isNew ? (
          <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
        ) : null}
      </View>
    </TouchableOpacity>
  );
});

const lockedStyles = StyleSheet.create({
  avatarClip: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  placeholderAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.savanna,
  },
  lockBadge: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 24,
  },
});
