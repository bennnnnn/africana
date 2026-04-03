import React from 'react';
import { View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { COLORS, DEFAULT_AVATAR } from '@/constants';
import { OnlineStatus } from '@/types';

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  onlineStatus?: OnlineStatus;
  showStatus?: boolean;
  style?: ViewStyle;
}

export function Avatar({ uri, name = '?', size = 48, onlineStatus, showStatus = false, style }: AvatarProps) {
  const statusColor = onlineStatus === 'online' ? COLORS.online : COLORS.offline;

  const avatarUri = uri || `${DEFAULT_AVATAR}${encodeURIComponent(name.charAt(0).toUpperCase())}`;

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Image
        source={{ uri: avatarUri }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: COLORS.savanna,
        }}
        contentFit="cover"
        transition={200}
      />
      {showStatus && onlineStatus && (
        <View
          style={{
            position: 'absolute',
            bottom: 1,
            right: 1,
            width: size * 0.27,
            height: size * 0.27,
            borderRadius: (size * 0.27) / 2,
            backgroundColor: statusColor,
            borderWidth: 2,
            borderColor: '#FFFFFF',
          }}
        />
      )}
    </View>
  );
}
