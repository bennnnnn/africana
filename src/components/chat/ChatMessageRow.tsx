import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { Message } from '@/types';
import { COLORS, FONT } from '@/constants';

const msgS = StyleSheet.create({
  bubble: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleOwn: { backgroundColor: COLORS.primary, borderBottomRightRadius: 6 },
  bubbleOther: { backgroundColor: COLORS.savanna, borderBottomLeftRadius: 6 },
  bubbleSelectedOwn: { backgroundColor: COLORS.primaryDark },
  bubbleSelectedOther: { backgroundColor: COLORS.savannaDark },
  bubbleMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    marginLeft: 8,
  },
  bubbleMetaText: { fontSize: 10, fontWeight: '500', letterSpacing: 0.2 },
  bubbleMetaCheck: { fontSize: 10, fontWeight: '700' },
  tailOwn: {
    position: 'absolute',
    right: -4,
    bottom: 0,
    width: 0,
    height: 0,
    borderTopWidth: 10,
    borderLeftWidth: 10,
    borderTopColor: COLORS.primary,
    borderLeftColor: 'transparent',
  },
  tailOther: {
    position: 'absolute',
    left: -4,
    bottom: 0,
    width: 0,
    height: 0,
    borderTopWidth: 10,
    borderRightWidth: 10,
    borderTopColor: COLORS.savanna,
    borderRightColor: 'transparent',
  },
  bubbleText: { fontSize: FONT.md, lineHeight: 22 },
  reactionBubble: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
});

export const ChatMessageRow = memo(function ChatMessageRow({
  item,
  userId,
  msgReactions,
  onLongPress,
  onPress,
  isSelected,
  isGroupStart,
  isGroupEnd,
}: {
  item: Message;
  userId: string | undefined;
  msgReactions: string[];
  onLongPress: (messageId: string, isOwn: boolean, content: string) => void;
  onPress?: (messageId: string, isOwn: boolean, content: string) => void;
  isSelected: boolean;
  isGroupStart: boolean;
  isGroupEnd: boolean;
}) {
  const { width } = useWindowDimensions();
  const isOwn = item.sender_id === userId;
  const isTemp = item.id.startsWith('temp-');
  const bubbleBg = isSelected
    ? isOwn
      ? COLORS.primaryDark
      : COLORS.savannaDark
    : isOwn
      ? COLORS.primary
      : COLORS.savanna;
  const tailCornerOverride = isGroupEnd
    ? null
    : isOwn
      ? { borderBottomRightRadius: 18 }
      : { borderBottomLeftRadius: 18 };
  const metaColor = isOwn ? 'rgba(255,255,255,0.78)' : COLORS.textMuted;
  const readColor = item.read_at
    ? COLORS.gold
    : isOwn
      ? 'rgba(255,255,255,0.65)'
      : COLORS.textMuted;

  return (
    <View style={{ marginBottom: isGroupEnd ? 10 : 2, marginTop: isGroupStart ? 4 : 0 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: isOwn ? 'flex-end' : 'flex-start',
          alignItems: 'center',
        }}
      >
        {!isOwn && isSelected && (
          <View style={{ marginRight: 8, marginLeft: 12 }}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
          </View>
        )}
        <Pressable
          onPress={() => onPress?.(item.id, isOwn, item.content)}
          onLongPress={() => onLongPress(item.id, isOwn, item.content)}
          delayLongPress={350}
          android_ripple={null}
          style={{ opacity: 1 }}
        >
          <View style={{ maxWidth: width * 0.72, position: 'relative' }}>
            <View
              style={[
                msgS.bubble,
                isOwn ? msgS.bubbleOwn : msgS.bubbleOther,
                { backgroundColor: bubbleBg },
                tailCornerOverride,
              ]}
            >
              <Text style={[msgS.bubbleText, { color: isOwn ? COLORS.white : COLORS.textStrong }]}>
                {item.content}
              </Text>
              <View style={[msgS.bubbleMetaRow, { alignSelf: 'flex-end' }]}>
                {item.sendFailed && (
                  <Ionicons name="alert-circle" size={12} color={COLORS.error} style={{ marginRight: 2 }} />
                )}
                <Text style={[msgS.bubbleMetaText, { color: metaColor }]}>
                  {dayjs(item.created_at).format('h:mm A')}
                </Text>
                {isOwn && (
                  <Text style={[msgS.bubbleMetaCheck, { color: readColor }]}>
                    {item.read_at ? '✓✓' : isTemp && !item.sendFailed ? '○' : '✓'}
                  </Text>
                )}
              </View>
            </View>
            {isGroupEnd && (
              <View style={[isOwn ? msgS.tailOwn : msgS.tailOther, { borderTopColor: bubbleBg }]} />
            )}
            {msgReactions.length > 0 && (
              <View
                style={{
                  flexDirection: 'row',
                  gap: 3,
                  marginTop: 2,
                  paddingHorizontal: 6,
                  justifyContent: isOwn ? 'flex-end' : 'flex-start',
                }}
              >
                {msgReactions.map((emoji) => (
                  <View key={emoji} style={msgS.reactionBubble}>
                    <Text style={{ fontSize: 13 }}>{emoji}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </Pressable>
        {isOwn && isSelected && (
          <View style={{ marginLeft: 8, marginRight: 12 }}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
          </View>
        )}
      </View>
    </View>
  );
});
