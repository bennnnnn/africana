import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: `${COLORS.primary}15`,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
        }}
      >
        <Ionicons name={icon} size={36} color={COLORS.primary} />
      </View>
      <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text, textAlign: 'center', marginBottom: 8 }}>
        {title}
      </Text>
      {description && (
        <Text style={{ fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
          {description}
        </Text>
      )}
      {action}
    </View>
  );
}
