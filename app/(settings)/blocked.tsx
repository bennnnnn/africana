import React, { memo, useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { User } from '@/types';
import { COLORS, DEFAULT_AVATAR, FONT } from '@/constants';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { SettingsHeaderBar } from '@/components/settings/SettingsHeaderBar';
import { appDialog } from '@/lib/app-dialog';

interface BlockedUser extends User {
  block_id: string;
}

const ROW_HEIGHT = 88; // 50 avatar + 14*2 padding + 10 marginBottom

const BlockedRow = memo(function BlockedRow({
  item,
  onUnblock,
}: {
  item: BlockedUser;
  onUnblock: (blockId: string, name: string) => void;
}) {
  const avatar =
    item.avatar_url ||
    (item.profile_photos ?? [])[0] ||
    `${DEFAULT_AVATAR}${encodeURIComponent(item.full_name.charAt(0))}`;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
      }}
    >
      <Image
        source={{ uri: avatar }}
        style={{ width: 50, height: 50, borderRadius: 25, marginRight: 12 }}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={120}
        recyclingKey={item.id}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: FONT.md, fontWeight: FONT.semibold, color: COLORS.text }}>
          {item.full_name}
        </Text>
        <Text style={{ fontSize: FONT.sm, color: COLORS.textSecondary }}>{item.country}</Text>
      </View>
      <Button
        title="Unblock"
        variant="outline"
        size="sm"
        onPress={() => onUnblock(item.block_id, item.full_name)}
      />
    </View>
  );
});

export default function BlockedUsersScreen() {
  const { user } = useAuthStore();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchBlockedUsers = useCallback(async () => {
    if (!user) return;

    setLoadError(null);

    const { data: blocks, error: blocksError } = await supabase
      .from('blocks')
      .select('id, blocked_id')
      .eq('blocker_id', user.id)
      .order('created_at', { ascending: false });

    if (blocksError) {
      setLoadError(blocksError.message || 'Could not load blocked users');
      setBlockedUsers([]);
      return;
    }

    if (!blocks || blocks.length === 0) {
      setBlockedUsers([]);
      return;
    }

    const blockedIds = blocks.map((b) => b.blocked_id);
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', blockedIds);

    if (profilesError) {
      setLoadError(profilesError.message || 'Could not load profiles');
      setBlockedUsers([]);
      return;
    }

    if (profiles) {
      const merged: BlockedUser[] = blocks
        .map((b) => {
          const profile = profiles.find((p) => p.id === b.blocked_id);
          return profile ? { ...(profile as User), block_id: b.id } : null;
        })
        .filter((u): u is BlockedUser => u !== null);
      setBlockedUsers(merged);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    fetchBlockedUsers().finally(() => setIsLoading(false));
  }, [user, fetchBlockedUsers]);

  const unblock = useCallback((blockId: string, name: string) => {
    appDialog({
      title: 'Unblock',
      message: `Unblock ${name}? They will be able to see your profile and contact you again.`,
      icon: 'person-remove-outline',
      actions: [
        { label: 'Cancel', style: 'cancel' },
        {
          label: 'Unblock',
          style: 'primary',
          onPress: async () => {
            const { error } = await supabase.from('blocks').delete().eq('id', blockId);
            if (error) {
              appDialog({
                title: 'Could not unblock',
                message: error.message || 'Please try again.',
                icon: 'alert-circle-outline',
              });
              return;
            }
            setBlockedUsers((prev) => prev.filter((u) => u.block_id !== blockId));
          },
        },
      ],
    });
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: BlockedUser }) => <BlockedRow item={item} onUnblock={unblock} />,
    [unblock],
  );
  const keyExtractor = useCallback((item: BlockedUser) => item.id, []);
  const getItemLayout = useCallback(
    (_: any, index: number) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index }),
    [],
  );

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
        <SettingsHeaderBar title="Blocked users" titleAlign="leading" />
        <EmptyState
          icon="person-outline"
          title="Not signed in"
          description="Sign in to manage blocked accounts."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <SettingsHeaderBar title={`Blocked users (${blockedUsers.length})`} titleAlign="leading" />

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : loadError ? (
        <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
          <EmptyState
            icon="alert-circle-outline"
            title="Something went wrong"
            description={loadError}
          />
          <Button title="Try again" fullWidth onPress={() => void fetchBlockedUsers()} style={{ marginTop: 20 }} />
        </View>
      ) : (
        <FlatList
          data={blockedUsers}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={9}
          removeClippedSubviews={Platform.OS === 'android'}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <EmptyState
              icon="ban-outline"
              title="No blocked users"
              description="Users you block will appear here."
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
