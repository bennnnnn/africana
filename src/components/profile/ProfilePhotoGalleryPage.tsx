import React, { useEffect, useRef } from 'react';
import { View, FlatList, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useProfileGalleryPhotos } from '@/hooks/use-profile-gallery-photos';

export function ProfilePhotoGalleryPage({
  userId,
  winWidth,
  winHeight,
  activePhotoIndex,
  dotBottom,
  onHorizontalIndexChange,
}: {
  userId: string;
  winWidth: number;
  winHeight: number;
  activePhotoIndex: number;
  dotBottom: number;
  onHorizontalIndexChange: (i: number) => void;
}) {
  const { photos, loading } = useProfileGalleryPhotos(userId);
  const listRef = useRef<FlatList<string>>(null);
  const scrollSyncedRef = useRef<{ userId: string; index: number } | null>(null);
  const clampedIndex = Math.min(activePhotoIndex, Math.max(photos.length - 1, 0));

  useEffect(() => {
    if (loading) return;
    if (clampedIndex !== activePhotoIndex) {
      onHorizontalIndexChange(clampedIndex);
    }
  }, [activePhotoIndex, clampedIndex, loading, onHorizontalIndexChange]);

  useEffect(() => {
    if (loading || photos.length === 0) return;
    const idx = Math.min(activePhotoIndex, photos.length - 1);
    const s = scrollSyncedRef.current;
    if (s?.userId === userId && s.index === idx) return;
    scrollSyncedRef.current = { userId, index: idx };
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: idx, animated: false });
    });
  }, [loading, photos.length, userId, activePhotoIndex]);

  if (loading) {
    return (
      <View style={{ width: winWidth, height: winHeight, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#FFF" />
      </View>
    );
  }
  if (photos.length === 0) {
    return <View style={{ width: winWidth, height: winHeight, backgroundColor: '#000' }} />;
  }

  return (
    <View style={{ width: winWidth, height: winHeight, backgroundColor: '#000' }}>
      <FlatList
        ref={listRef}
        data={photos}
        keyExtractor={(uri, i) => `${uri}-${i}`}
        horizontal
        pagingEnabled
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
        initialScrollIndex={Math.min(activePhotoIndex, photos.length - 1)}
        getItemLayout={(_, index) => ({
          length: winWidth,
          offset: winWidth * index,
          index,
        })}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / winWidth);
          const next = Math.max(0, Math.min(i, photos.length - 1));
          scrollSyncedRef.current = { userId, index: next };
          if (next !== activePhotoIndex) {
            onHorizontalIndexChange(next);
          }
        }}
        onScrollToIndexFailed={(info) => {
          requestAnimationFrame(() => {
            listRef.current?.scrollToIndex({ index: info.index, animated: false });
          });
        }}
        renderItem={({ item: uri }) => (
          <View style={{ width: winWidth, height: winHeight }}>
            <Image
              source={{ uri }}
              style={{ width: winWidth, height: winHeight }}
              contentFit="contain"
              transition={180}
            />
          </View>
        )}
      />
      {photos.length > 1 ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: dotBottom,
            left: 0,
            right: 0,
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {photos.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === clampedIndex ? 22 : 7,
                height: 7,
                borderRadius: 3.5,
                backgroundColor: i === clampedIndex ? '#FFF' : 'rgba(255,255,255,0.45)',
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
