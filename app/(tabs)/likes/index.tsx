import React, { useEffect, useMemo } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';
import { useActivityStore } from '@/store/activity.store';
import { LikesHubProvider } from '@/context/likes-hub-context';
import LikesHubScreen from '@/screens/LikesHubScreen';
import { likesParamForTab, pickLandingLikesTab } from '@/constants/likes-routes';

export default function LikesIndex() {
  const { tab } = useLocalSearchParams<{ tab?: string | string[] }>();
  const counts = useActivityStore(useShallow((s) => s.counts));
  const landingTab = useMemo(() => pickLandingLikesTab(counts), [counts]);

  // On first entry, if no tab param is provided, pick the best landing tab.
  useEffect(() => {
    const seg = Array.isArray(tab) ? tab[0] : tab;
    if (!seg) {
      router.setParams({ tab: likesParamForTab(landingTab) });
    }
  }, [landingTab, tab]);

  return (
    <LikesHubProvider>
      <LikesHubScreen />
    </LikesHubProvider>
  );
}
