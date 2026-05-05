import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { User } from '@/types';
import { COLORS } from '@/constants';
import { setProfileSeed } from '@/lib/profile-seed-cache';
import { formatLastSeen } from '@/lib/utils';
import { chatScreenStyles as s } from '@/components/chat/chat-screen-styles';

type SelectionProps = {
  mode: 'selection';
  selectionCount: number;
  showDelete: boolean;
  onCloseSelection: () => void;
  onCopy: () => void;
  onDelete: () => void;
};

type PeerProps = {
  mode: 'peer';
  peer: User | null;
  avatar: string | null;
  peerTyping: boolean;
  onOpenMenu: () => void;
};

type Props = SelectionProps | PeerProps;

export function ChatScreenHeaderChrome(props: Props) {
  if (props.mode === 'selection') {
    const { selectionCount, showDelete, onCloseSelection, onCopy, onDelete } = props;
    return (
      <View style={s.header}>
        <TouchableOpacity
          onPress={onCloseSelection}
          style={s.backBtn}
          accessibilityLabel="Cancel selection"
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
        >
          <Ionicons name="close" size={24} color={COLORS.textStrong} />
        </TouchableOpacity>
        <Text style={[s.headerName, { flex: 1, marginLeft: 8 }]}>{selectionCount} selected</Text>
        <TouchableOpacity
          onPress={onCopy}
          style={s.iconBtn}
          accessibilityLabel="Copy message"
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
        >
          <Ionicons name="copy-outline" size={22} color={COLORS.textStrong} />
        </TouchableOpacity>
        {showDelete ? (
          <TouchableOpacity
            onPress={onDelete}
            style={s.iconBtn}
            accessibilityLabel="Delete message"
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          >
            <Ionicons name="trash-outline" size={22} color={COLORS.error} />
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  const { peer, avatar, peerTyping, onOpenMenu } = props;
  return (
    <View style={s.header}>
      <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
        <Ionicons name="arrow-back" size={22} color={COLORS.textStrong} />
      </TouchableOpacity>

      {peer ? (
        <TouchableOpacity
          onPress={() => {
            setProfileSeed(peer);
            router.push(`/(profile)/${peer.id}`);
          }}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          {avatar ? (
            <View>
              <Image key={peer.id} source={{ uri: avatar }} style={s.headerAvatar} contentFit="cover" />
              {peer.online_status === 'online' ? (
                <View style={[s.onlineDot, { backgroundColor: COLORS.online }]} />
              ) : null}
            </View>
          ) : null}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.headerName} numberOfLines={1}>
              {peer.full_name}
            </Text>
            <Text
              style={[
                s.headerStatus,
                {
                  color: peerTyping
                    ? COLORS.primary
                    : peer.online_status === 'online'
                      ? COLORS.online
                      : COLORS.textMuted,
                },
              ]}
            >
              {peerTyping
                ? 'Typing…'
                : peer.online_status === 'online'
                  ? 'Online'
                  : peer.online_visible === false
                    ? 'Offline'
                    : (formatLastSeen(peer.last_seen) ?? 'Offline')}
            </Text>
          </View>
        </TouchableOpacity>
      ) : (
        <View style={{ flex: 1 }} />
      )}

      {peer ? (
        <TouchableOpacity onPress={onOpenMenu} style={s.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
          <Ionicons name="ellipsis-vertical" size={22} color={COLORS.textStrong} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
