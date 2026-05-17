import React, { useEffect, useMemo, useState } from 'react';
import { View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { COLORS, DEFAULT_AVATAR } from '@/constants';
import { profileImageUrlForList, storagePublicObjectUrlFromRender } from '@/lib/storage-image-url';
import { OnlineStatus } from '@/types';

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  onlineStatus?: OnlineStatus;
  showStatus?: boolean;
  style?: ViewStyle;
}

export const Avatar = React.memo(function Avatar({
  uri,
  name = '?',
  size = 48,
  onlineStatus,
  showStatus = false,
  style,
}: AvatarProps) {
  const statusColor = onlineStatus === 'online' ? COLORS.online : COLORS.offline;

  const resolvedListUri = useMemo(() => {
    const raw = uri?.trim()
      ? uri.trim()
      : `${DEFAULT_AVATAR}${encodeURIComponent(name.charAt(0).toUpperCase())}`;
    return profileImageUrlForList(raw) ?? raw;
  }, [uri, name]);

  const [displayUri, setDisplayUri] = useState(resolvedListUri);
  useEffect(() => {
    setDisplayUri(resolvedListUri);
  }, [resolvedListUri]);

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Image
        source={{ uri: displayUri }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: COLORS.savanna,
        }}
        contentFit="cover"
        contentPosition="center"
        transition={120}
        cachePolicy="memory-disk"
        recyclingKey={displayUri}
        onError={() => {
          const stripped = storagePublicObjectUrlFromRender(displayUri);
          if (stripped && stripped !== displayUri) setDisplayUri(stripped);
        }}
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
});
