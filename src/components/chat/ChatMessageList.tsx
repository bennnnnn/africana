import React, { memo } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Platform,
  type ListRenderItem,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import type { ChatListItem } from '@/lib/chat-list-build';
import { COLORS } from '@/constants';

type Extra = {
  reactionEmojiArrays: Record<string, string[]>;
  selectedMessages: Map<string, { isOwn: boolean; content: string }>;
};

type Props = {
  listRef: React.RefObject<FlatList<ChatListItem> | null>;
  data: ChatListItem[];
  extraData: Extra;
  isLoadingOlder: boolean;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  renderItem: ListRenderItem<ChatListItem>;
  showEmptyHint: boolean;
};

function ChatMessageListInner({
  listRef,
  data,
  extraData,
  isLoadingOlder,
  onScroll,
  renderItem,
  showEmptyHint,
}: Props) {
  return (
    <>
      {showEmptyHint ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 60,
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <Text
            style={{
              fontSize: 14,
              color: COLORS.textSecondary,
              textAlign: 'center',
              lineHeight: 22,
            }}
          >
            No messages yet.{'\n'}Say hello! 👋
          </Text>
        </View>
      ) : null}

      <FlatList
        ref={listRef}
        style={{ flex: 1, minHeight: 0 }}
        data={data}
        inverted
        keyExtractor={(item) =>
          item.type === 'message' ? (item.message.listKey ?? item.message.id) : item.id
        }
        extraData={extraData}
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={20}
        maxToRenderPerBatch={12}
        windowSize={12}
        updateCellsBatchingPeriod={50}
        contentContainerStyle={{ padding: 12, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onScroll={onScroll}
        scrollEventThrottle={16}
        ListFooterComponent={
          isLoadingOlder ? (
            <View style={{ paddingVertical: 10, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={COLORS.textMuted} />
            </View>
          ) : null
        }
        ListEmptyComponent={null}
        renderItem={renderItem}
      />
    </>
  );
}

export const ChatMessageList = memo(ChatMessageListInner, (prev, next) => {
  return (
    prev.data.length === next.data.length &&
    prev.extraData === next.extraData &&
    prev.isLoadingOlder === next.isLoadingOlder &&
    prev.showEmptyHint === next.showEmptyHint &&
    prev.renderItem === next.renderItem &&
    prev.onScroll === next.onScroll
  );
});
