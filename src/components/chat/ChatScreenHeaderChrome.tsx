import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { User } from '@/types';
import { COLORS } from '@/constants';
import { setProfileSeed } from '@/lib/profile-seed-cache';
import { formatLastSeen, getEffectivePresence } from '@/lib/utils';
import { usePresenceStore } from '@/store/presence.store';
import { storagePublicObjectUrlFromRender } from '@/lib/storage-image-url';
import { chatScreenStyles as s } from '@/components/chat/ChatScreenStyles';

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
  /** Display URL (e.g. list-sized transform). */
  avatar: string | null;
  /** Pre-transform storage or CDN URL for `Image` onError fallback. */
  avatarFallback?: string | null;
  peerTyping: boolean;
  onOpenMenu: () => void;
};

type Props = SelectionProps | PeerProps;

function ChatScreenHeaderSelectionChrome({
  selectionCount,
  showDelete,
  onCloseSelection,
  onCopy,
  onDelete,
}: Omit<SelectionProps, 'mode'>) {
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

function ChatScreenHeaderPeerChrome({
  peer,
  avatar,
  avatarFallback,
  peerTyping,
  onOpenMenu,
}: Omit<PeerProps, 'mode'>) {
  const peerOnlineIds = usePresenceStore((s) => s.peerOnlineIds);
  const displayOnline =
    peer &&
    getEffectivePresence(
      {
        id: peer.id,
        online_visible: peer.online_visible,
        online_status: peer.online_status,
        last_seen: peer.last_seen ?? '',
      },
      peerOnlineIds,
    ) === 'online';
  const [headerImageUri, setHeaderImageUri] = useState<string | null>(avatar);
  useEffect(() => {
    setHeaderImageUri(avatar);
  }, [avatar, peer?.id]);

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
          {headerImageUri ? (
            <View>
              <Image
                key={`${peer.id}:${headerImageUri}`}
                source={{ uri: headerImageUri }}
                style={s.headerAvatar}
                contentFit="cover"
                transition={0}
                cachePolicy="memory-disk"
                recyclingKey={`${peer.id}:${headerImageUri}`}
                onError={() => {
                  const fb = avatarFallback?.trim();
                  if (fb && headerImageUri !== fb) {
                    setHeaderImageUri(fb);
                    return;
                  }
                  const stripped = storagePublicObjectUrlFromRender(headerImageUri);
                  if (stripped && stripped !== headerImageUri) setHeaderImageUri(stripped);
                }}
              />
              {displayOnline ? (
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
                    : displayOnline
                      ? COLORS.online
                      : COLORS.textMuted,
                },
              ]}
            >
              {peerTyping
                ? 'Typing…'
                : displayOnline
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
        <TouchableOpacity
          onPress={onOpenMenu}
          style={s.iconBtn}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
        >
          <Ionicons name="ellipsis-vertical" size={22} color={COLORS.textStrong} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function ChatScreenHeaderChrome(props: Props) {
  if (props.mode === 'selection') {
    const { selectionCount, showDelete, onCloseSelection, onCopy, onDelete } = props;
    return (
      <ChatScreenHeaderSelectionChrome
        selectionCount={selectionCount}
        showDelete={showDelete}
        onCloseSelection={onCloseSelection}
        onCopy={onCopy}
        onDelete={onDelete}
      />
    );
  }
  const { peer, avatar, avatarFallback, peerTyping, onOpenMenu } = props;
  return (
    <ChatScreenHeaderPeerChrome
      peer={peer}
      avatar={avatar}
      avatarFallback={avatarFallback}
      peerTyping={peerTyping}
      onOpenMenu={onOpenMenu}
    />
  );
}
