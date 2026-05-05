import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants';
import { LIKES_TAB_ORDER, LIKES_TAB_META, type LikesTab } from '@/constants/likes-screen';
import { likesScreenStyles as s } from '@/components/likes/likes-screen-styles';

export type LikesHubTabStripProps = {
  activeTab: LikesTab;
  counts: Record<LikesTab, number>;
  onTabPress: (t: LikesTab) => void;
};

function countsEqual(a: Record<LikesTab, number>, b: Record<LikesTab, number>): boolean {
  for (const t of LIKES_TAB_ORDER) {
    if (a[t] !== b[t]) return false;
  }
  return true;
}

export const LikesHubTabStrip = React.memo(function LikesHubTabStrip({
  activeTab,
  counts,
  onTabPress,
}: LikesHubTabStripProps) {
  return (
    <View style={s.tabsWrap}>
      {LIKES_TAB_ORDER.map((t) => {
        const isActive = activeTab === t;
        const meta = LIKES_TAB_META[t];
        const c = counts[t] ?? 0;
        return (
          <TouchableOpacity
            key={t}
            onPress={() => onTabPress(t)}
            style={s.tabItem}
            activeOpacity={0.65}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${meta.label}${c > 0 ? `, ${c} new` : ''}`}
          >
            <View style={s.tabIconRow}>
              <Ionicons
                name={isActive ? meta.iconActive : meta.icon}
                size={20}
                color={isActive ? COLORS.primary : COLORS.textSecondary}
              />
              <View style={s.tabLabelRow}>
                <Text style={[s.tabLabel, isActive && s.tabLabelActive]} numberOfLines={1}>
                  {meta.label}
                </Text>
                {c > 0 ? (
                  <View style={[s.tabBadge, isActive && s.tabBadgeActive]}>
                    <Text style={[s.tabBadgeTxt, isActive && s.tabBadgeTxtActive]}>{c > 99 ? '99+' : c}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}, (prev, next) =>
  prev.activeTab === next.activeTab &&
  countsEqual(prev.counts, next.counts) &&
  prev.onTabPress === next.onTabPress,
);
