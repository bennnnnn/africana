import React from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { REACTIONS, type ReactionEmoji, type ReactionsMap } from '@/constants/chat-reactions';
import { chatScreenStyles as s } from '@/components/chat/ChatScreenStyles';

type Props = {
  messageId: string;
  userId: string | undefined;
  reactions: ReactionsMap;
  reactionAnim: Animated.Value;
  onBackdropPress: () => void;
  onPick: (messageId: string, emoji: ReactionEmoji) => void;
};

export function ChatReactionPickerOverlay({
  messageId,
  userId,
  reactions,
  reactionAnim,
  onBackdropPress,
  onPick,
}: Props) {
  return (
    <>
      <TouchableOpacity style={s.ctxBackdrop} activeOpacity={1} onPress={onBackdropPress} />
      <Animated.View
        style={[
          s.reactionCard,
          {
            opacity: reactionAnim,
            transform: [
              {
                scale: reactionAnim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }),
              },
            ],
          },
        ]}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-around',
            paddingHorizontal: 12,
            paddingVertical: 16,
          }}
        >
          {REACTIONS.map((emoji) => {
            const active = userId ? reactions[messageId]?.[userId] === emoji : false;
            return (
              <TouchableOpacity
                key={emoji}
                onPress={() => onPick(messageId, emoji)}
                style={[s.reactionBtn, active && s.reactionBtnActive]}
              >
                <Text style={{ fontSize: 28 }}>{emoji}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>
    </>
  );
}
