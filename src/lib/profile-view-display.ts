import {
  EDUCATION_OPTIONS,
  INTERESTED_IN_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  OCCUPATION_OPTIONS,
  PHYSICAL_CONDITION_OPTIONS,
  RELIGION_OPTIONS,
  WANT_CHILDREN_YES_NO,
} from '@/constants';
import { formatShortLastSeenLabel } from '@/lib/profile-view-format';
import { getEffectivePresence, isUserEffectivelyOnline } from '@/lib/utils';
import type { User } from '@/types';

export type ProfileDisplayModel = {
  religionLabel: string | null;
  educationLabel: string | null;
  maritalLabel: string | null;
  wantChildLabel: string | null;
  bodyTypeLabel: string | null;
  occupationLabel: string | null;
  interestedInLabel: string | null;
  location: string;
  heritageLine: string;
  showHeritage: boolean;
  isVerified: boolean;
  isLiked: boolean;
  isOwnProfile: boolean;
  displayOnlineStatus: 'online' | 'offline';
  isActiveOnline: boolean;
  activityLabel: string;
  recipientMessagesPaused: boolean;
  commonHobbies: string[];
  commonLanguages: string[];
};

function normalizeText(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

export function buildProfileDisplayModel(args: {
  profile: User;
  currentUser: User | null;
  likedUserIds: ReadonlySet<string>;
  peerOnlineIds: ReadonlySet<string>;
}): ProfileDisplayModel {
  const { profile, currentUser, likedUserIds, peerOnlineIds } = args;

  const religionLabel = profile.religion
    ? (RELIGION_OPTIONS.find((r) => r.value === profile.religion)?.label ?? profile.religion)
    : null;
  const educationLabel = profile.education
    ? (EDUCATION_OPTIONS.find((e) => e.value === profile.education)?.label ?? profile.education)
    : null;
  const maritalLabel = profile.marital_status
    ? (MARITAL_STATUS_OPTIONS.find((m) => m.value === profile.marital_status)?.label ??
      profile.marital_status)
    : null;
  const wantChildLabel = profile.want_children
    ? (WANT_CHILDREN_YES_NO.find((o) => o.value === profile.want_children)?.label ??
      profile.want_children)
    : null;
  const bodyTypeLabel = profile.body_type
    ? (PHYSICAL_CONDITION_OPTIONS.find((o) => o.value === profile.body_type)?.label ??
      profile.body_type)
    : null;
  const occupationLabel = profile.occupation
    ? (OCCUPATION_OPTIONS.find((o) => o.value === profile.occupation)?.label ?? profile.occupation)
    : null;
  const interestedInLabel =
    INTERESTED_IN_OPTIONS.find((o) => o.value === profile.interested_in)?.label ??
    profile.interested_in ??
    null;

  const location = [profile.city, profile.state, profile.country].filter(Boolean).join(', ');
  const heritageLine = [profile.origin_city, profile.origin_state, profile.origin_country]
    .filter(Boolean)
    .join(', ');
  const showHeritage =
    heritageLine.length > 0 &&
    heritageLine.trim().toLowerCase() !== location.trim().toLowerCase();

  const isVerified = profile.verified === true || profile.verification_status === 'approved';
  const isLiked = likedUserIds.has(profile.id);
  const isOwnProfile = currentUser?.id === profile.id;

  const displayOnlineStatus: 'online' | 'offline' = isOwnProfile
    ? isUserEffectivelyOnline(profile.online_status, profile.last_seen)
      ? 'online'
      : 'offline'
    : getEffectivePresence(
        {
          id: profile.id,
          online_visible: profile.online_visible,
          online_status: profile.online_status,
          last_seen: profile.last_seen ?? '',
        },
        peerOnlineIds,
      );

  const isActiveOnline = displayOnlineStatus === 'online';

  const useLastActiveLabel =
    !isActiveOnline && !isOwnProfile && profile.online_visible !== false && !!profile.last_seen;
  const shortLastSeenLabel = formatShortLastSeenLabel(profile.last_seen, useLastActiveLabel);
  const activityLabel = isActiveOnline ? 'Online' : (shortLastSeenLabel ?? 'Offline');

  const recipientMessagesPaused = !isOwnProfile && profile.accepts_messages === false;

  const viewerLanguages = new Set(
    (currentUser?.languages ?? []).map((lang) => normalizeText(lang)).filter(Boolean),
  );
  const viewerHobbies = new Set(
    (currentUser?.hobbies ?? []).map((h) => normalizeText(h)).filter(Boolean),
  );
  const commonHobbies = !isOwnProfile
    ? (profile.hobbies ?? []).filter((h) => viewerHobbies.has(normalizeText(h)))
    : [];
  const commonLanguages = !isOwnProfile
    ? (profile.languages ?? []).filter((l) => viewerLanguages.has(normalizeText(l)))
    : [];

  return {
    religionLabel,
    educationLabel,
    maritalLabel,
    wantChildLabel,
    bodyTypeLabel,
    occupationLabel,
    interestedInLabel,
    location,
    heritageLine,
    showHeritage,
    isVerified,
    isLiked,
    isOwnProfile,
    displayOnlineStatus,
    isActiveOnline,
    activityLabel,
    recipientMessagesPaused,
    commonHobbies,
    commonLanguages,
  };
}
