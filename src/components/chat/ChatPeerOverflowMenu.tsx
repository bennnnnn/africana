import React from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants';
import { chatScreenStyles as s } from '@/components/chat/ChatScreenStyles';

type Props = {
  bodyTopInset: number;
  menuAnim: Animated.Value;
  isLiked: boolean;
  isFavourite: boolean;
  onBackdropPress: () => void;
  onLike: () => void;
  onFavourite: () => void;
  onReport: () => void;
  onBlock: () => void;
};

export function ChatPeerOverflowMenu({
  bodyTopInset,
  menuAnim,
  isLiked,
  isFavourite,
  onBackdropPress,
  onLike,
  onFavourite,
  onReport,
  onBlock,
}: Props) {
  return (
    <>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onBackdropPress} />
      <Animated.View
        style={[
          s.dropdown,
          { top: bodyTopInset + 6 },
          {
            opacity: menuAnim,
            transform: [
              {
                translateY: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity style={s.menuItem} onPress={onLike}>
          <View style={s.menuIcon}>
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={17}
              color={COLORS.textStrong}
            />
          </View>
          <Text style={s.menuLabel}>{isLiked ? 'Unlike' : 'Like'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.menuItem} onPress={onFavourite}>
          <View style={s.menuIcon}>
            <Ionicons
              name={isFavourite ? 'star' : 'star-outline'}
              size={17}
              color={COLORS.textStrong}
            />
          </View>
          <Text style={s.menuLabel}>{isFavourite ? 'Unfavourite' : 'Favourite'}</Text>
        </TouchableOpacity>
        <View style={{ height: 1, backgroundColor: COLORS.border, marginHorizontal: 14 }} />
        <TouchableOpacity style={s.menuItem} onPress={onReport}>
          <View style={s.menuIcon}>
            <Ionicons name="flag-outline" size={17} color={COLORS.textStrong} />
          </View>
          <Text style={s.menuLabel}>Report</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.menuItem} onPress={onBlock}>
          <View style={s.menuIcon}>
            <Ionicons name="ban-outline" size={17} color={COLORS.error} />
          </View>
          <Text style={[s.menuLabel, { color: COLORS.error }]}>Block</Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}
