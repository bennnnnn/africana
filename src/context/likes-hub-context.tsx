import React, { createContext, useContext } from 'react';
import { useLikesHubController, type LikesHubContextValue } from '@/hooks/use-likes-hub-controller';

export type { LikesHubContextValue };

const LikesHubContext = createContext<LikesHubContextValue | null>(null);

export function LikesHubProvider({ children }: { children: React.ReactNode }) {
  const value = useLikesHubController();
  return (
    <LikesHubContext.Provider value={value}>{children}</LikesHubContext.Provider>
  );
}

export function useLikesHub(): LikesHubContextValue {
  const v = useContext(LikesHubContext);
  if (!v) throw new Error('useLikesHub must be used within LikesHubProvider');
  return v;
}
