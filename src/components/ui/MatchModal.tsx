import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS, RADIUS, FONT, SHADOWS, DEFAULT_AVATAR } from '@/constants';
import { User } from '@/types';
import { useChatStore } from '@/store/chat.store';
import { useAuthStore } from '@/store/auth.store';

const { width } = Dimensions.get('window');

interface MatchModalProps {
  visible: boolean;
  matchedUser: User | null;
  onClose: () => void;
}

export function MatchModal({ visible, matchedUser, onClose }: MatchModalProps) {
  const { user } = useAuthStore();
  const { getOrCreateConversation } = useChatStore();

  const scaleAnim   = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const heartAnim   = useRef(new Animated.Value(1)).current;

  const startHeartbeat = () => {
    Animated.loop(
      Animated.sequence([
        Animated.spring(heartAnim, { toValue: 1.3, useNativeDriver: true, speed: 30, bounciness: 10 }),
        Animated.spring(heartAnim, { toValue: 1,   useNativeDriver: true, speed: 20, bounciness: 4  }),
      ]),
      { iterations: 6 },
    ).start();
  };

  useEffect(() => {
    if (visible && matchedUser) {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      heartAnim.setValue(1);
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 55, friction: 7 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start(startHeartbeat);
    } else if (!visible) {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      heartAnim.setValue(1);
    }
  }, [visible, matchedUser?.id]);

  const handleMessage = async () => {
    if (!user || !matchedUser) return;
    onClose();
    const convId = await getOrCreateConversation(user.id, matchedUser.id);
    if (convId) {
      router.push({ pathname: '/(chat)/[id]', params: { id: convId, otherUserId: matchedUser.id } });
    }
  };

  if (!matchedUser) return null;

  const myAvatar    = user?.avatar_url || `${DEFAULT_AVATAR}${encodeURIComponent((user?.full_name ?? '?').charAt(0))}`;
  const theirAvatar = matchedUser.avatar_url || (matchedUser.profile_photos ?? [])[0]
    || `${DEFAULT_AVATAR}${encodeURIComponent(matchedUser.full_name.charAt(0))}`;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[s.overlay, { opacity: opacityAnim }]}>
        <Animated.View style={[s.card, { transform: [{ scale: scaleAnim }] }]}>
          {/* Warm gradient halo behind the avatars */}
          <LinearGradient
            colors={[COLORS.primarySurface, COLORS.white]}
            style={s.halo}
            pointerEvents="none"
          />

          <View style={s.kickerRow}>
            <View style={s.kickerLine} />
            <Text style={s.kicker}>YOU MATCHED</Text>
            <View style={s.kickerLine} />
          </View>

          <Text style={s.title}>It's a Match!</Text>
          <Text style={s.subtitle}>
            You and{' '}
            <Text style={s.subtitleStrong}>{matchedUser.full_name}</Text>
            {'\n'}liked each other
          </Text>

          <View style={s.avatars}>
            <View style={[s.avatarRing, { zIndex: 2, marginRight: -22 }]}>
              <Image source={{ uri: myAvatar }} style={s.avatar} contentFit="cover" />
            </View>
            <Animated.View style={[s.heartCenter, { transform: [{ scale: heartAnim }] }]}>
              <Ionicons name="heart" size={22} color={COLORS.white} />
            </Animated.View>
            <View style={[s.avatarRing, { zIndex: 2, marginLeft: -22 }]}>
              <Image source={{ uri: theirAvatar }} style={s.avatar} contentFit="cover" />
            </View>
          </View>

          <TouchableOpacity style={s.msgBtn} onPress={handleMessage} activeOpacity={0.85}>
            <Ionicons name="chatbubble-ellipses" size={18} color={COLORS.white} />
            <Text style={s.msgBtnText}>Send a message</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.laterBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={s.laterText}>Keep browsing</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const AVATAR_SIZE = width * 0.30;

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xxl,
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 24,
    alignItems: 'center',
    overflow: 'hidden',
    ...SHADOWS.xl,
  },
  halo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 220,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  kickerLine: {
    width: 24,
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.primaryBorder,
  },
  kicker: {
    fontSize: 11,
    fontWeight: FONT.extrabold,
    letterSpacing: 1.6,
    color: COLORS.primary,
  },
  title: {
    fontSize: 38,
    fontFamily: FONT.displayFamily,
    color: COLORS.primary,
    marginBottom: 8,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONT.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
  },
  subtitleStrong: { fontWeight: FONT.bold, color: COLORS.text },
  avatars: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  avatarRing: {
    width: AVATAR_SIZE + 8,
    height: AVATAR_SIZE + 8,
    borderRadius: (AVATAR_SIZE + 8) / 2,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.md,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  heartCenter: {
    zIndex: 3,
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.white,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  msgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.primary,
    paddingVertical: 15,
    paddingHorizontal: 36,
    borderRadius: RADIUS.full,
    width: '100%',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 10,
    elevation: 6,
  },
  msgBtnText: { fontSize: FONT.md + 1, fontWeight: FONT.bold, color: COLORS.white, letterSpacing: 0.2 },
  laterBtn: { paddingVertical: 12 },
  laterText: { fontSize: FONT.sm, color: COLORS.textSecondary, fontWeight: FONT.semibold },
});
