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
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS, RADIUS, FONT, SHADOWS, DEFAULT_AVATAR } from '@/constants';
import { User } from '@/types';
import { useChatStore } from '@/store/chat.store';
import { useAuthStore } from '@/store/auth.store';
import { sendLocalNotification } from '@/lib/notifications';

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
      sendLocalNotification(
        '🔥 It\'s a Match!',
        `You and ${matchedUser.full_name} liked each other.`,
        'match',
        { userId: matchedUser.id },
      );
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
    if (convId) router.push(`/(chat)/${convId}`);
  };

  if (!matchedUser) return null;

  const myAvatar    = user?.avatar_url || `${DEFAULT_AVATAR}${encodeURIComponent((user?.full_name ?? '?').charAt(0))}`;
  const theirAvatar = matchedUser.avatar_url || (matchedUser.profile_photos ?? [])[0]
    || `${DEFAULT_AVATAR}${encodeURIComponent(matchedUser.full_name.charAt(0))}`;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[s.overlay, { opacity: opacityAnim }]}>
        <Animated.View style={[s.card, { transform: [{ scale: scaleAnim }] }]}>

          <Animated.Text style={[s.flame, { transform: [{ scale: heartAnim }] }]}>🔥</Animated.Text>

          <Text style={s.title}>It's a Match!</Text>
          <Text style={s.subtitle}>
            You and{' '}
            <Text style={{ fontWeight: FONT.bold, color: COLORS.text }}>{matchedUser.full_name}</Text>
            {'\n'}liked each other
          </Text>

          <View style={s.avatars}>
            <View style={[s.avatarWrap, { zIndex: 2, marginRight: -18 }]}>
              <Image source={{ uri: myAvatar }} style={s.avatar} contentFit="cover" />
            </View>
            <Animated.View style={[s.heartCenter, { transform: [{ scale: heartAnim }] }]}>
              <Ionicons name="heart" size={22} color={COLORS.white} />
            </Animated.View>
            <View style={[s.avatarWrap, { zIndex: 2, marginLeft: -18 }]}>
              <Image source={{ uri: theirAvatar }} style={s.avatar} contentFit="cover" />
            </View>
          </View>

          <TouchableOpacity style={s.msgBtn} onPress={handleMessage} activeOpacity={0.85}>
            <Ionicons name="chatbubble-outline" size={18} color={COLORS.white} />
            <Text style={s.msgBtnText}>Send a Message</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.laterBtn} onPress={onClose}>
            <Text style={s.laterText}>Keep Browsing</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

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
    padding: 32,
    alignItems: 'center',
    ...SHADOWS.xl,
  },
  flame:    { fontSize: 52, marginBottom: 8 },
  title:    { fontSize: FONT.xxxl, fontWeight: FONT.black, color: COLORS.primary, marginBottom: 6 },
  subtitle: { fontSize: FONT.md, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 28, lineHeight: 22 },
  avatars:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  avatarWrap: { ...SHADOWS.md },
  avatar: {
    width: width * 0.28,
    height: width * 0.28,
    borderRadius: width * 0.14,
    borderWidth: 4,
    borderColor: COLORS.white,
  },
  heartCenter: {
    zIndex: 3,
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.white,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  msgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 36,
    borderRadius: RADIUS.lg,
    width: '100%',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  msgBtnText: { fontSize: FONT.lg, fontWeight: FONT.bold, color: COLORS.white },
  laterBtn:   { paddingVertical: 12 },
  laterText:  { fontSize: FONT.sm, color: COLORS.textSecondary, fontWeight: FONT.semibold },
});
