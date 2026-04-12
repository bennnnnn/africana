import { create } from 'zustand';

/** Ordered IDs for Tinder/Badoo-style vertical swipe between profiles in fullscreen photos. */
type ProfileBrowseState = {
  orderedUserIds: string[];
  setOrderedUserIds: (ids: string[]) => void;
  clearOrderedUserIds: () => void;
};

export const useProfileBrowseStore = create<ProfileBrowseState>((set) => ({
  orderedUserIds: [],
  setOrderedUserIds: (ids) =>
    set({ orderedUserIds: [...new Set(ids.filter(Boolean))] }),
  clearOrderedUserIds: () => set({ orderedUserIds: [] }),
}));
