import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { User } from '@/types';
import { COLORS, DEFAULT_AVATAR } from '@/constants';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

interface BlockedUser extends User {
  block_id: string;
}

export default function BlockedUsersScreen() {
  const { user } = useAuthStore();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBlockedUsers = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('blocks')
      .select('id, blocked:profiles!blocked_id(*)')
      .eq('blocker_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      setBlockedUsers(data.map((b: { id: string; blocked: unknown }) => ({
        ...(b.blocked as User),
        block_id: b.id,
      })));
    }
  };

  useEffect(() => {
    fetchBlockedUsers().finally(() => setIsLoading(false));
  }, [user]);

  const unblock = (blockId: string, name: string) => {
    Alert.alert('Unblock', `Unblock ${name}? They will be able to see your profile and contact you again.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: async () => {
          await supabase.from('blocks').delete().eq('id', blockId);
          setBlockedUsers((prev) => prev.filter((u) => u.block_id !== blockId));
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 14,
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
          gap: 12,
        }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: '700', color: COLORS.text }}>
          Blocked Users ({blockedUsers.length})
        </Text>
      </View>

      <FlatList
        data={blockedUsers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <EmptyState
            icon="ban-outline"
            title="No blocked users"
            description="Users you block will appear here."
          />
        }
        renderItem={({ item }) => {
          const avatar = item.avatar_url || item.profile_photos[0] || `${DEFAULT_AVATAR}${encodeURIComponent(item.full_name.charAt(0))}`;
          return (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#FFFFFF',
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
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.text }}>
                  {item.full_name}
                </Text>
                <Text style={{ fontSize: 13, color: COLORS.textSecondary }}>
                  {item.country}
                </Text>
              </View>
              <Button
                title="Unblock"
                variant="outline"
                size="sm"
                onPress={() => unblock(item.block_id, item.full_name)}
              />
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
