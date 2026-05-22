import {
  EDUCATION_OPTIONS,
  INTERESTED_IN_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  OCCUPATION_OPTIONS,
  PHYSICAL_CONDITION_OPTIONS,
  RELIGION_OPTIONS,
  WANT_CHILDREN_YES_NO,
} from '@/constants';
import { resolveCountryFromStored, AFRICAN_COUNTRY_CODES } from '@/lib/country-data';
import { getProfileStrength } from '@/lib/profile-completion';
import type { User } from '@/types';

export type MeProfileDisplayModel = {
  photos: string[];
  location: string;
  age: number | null;
  isOnline: boolean;
  religionLabel: string | null;
  educationLabel: string | null;
  maritalLabel: string | null;
  wantChildrenLabel: string | null;
  bodyTypeLabel: string | null;
  occupationLabel: string | null;
  interestedInLabel: string | null;
  locationDisplay: string;
  originDisplay: string;
  livesInAfrica: boolean;
  needsOriginForData: boolean;
  completionPct: number;
  nextMissing: ReturnType<typeof getProfileStrength>['nextMissing'];
};

export function buildMeProfileDisplayModel(user: User): MeProfileDisplayModel {
  const photos = user.profile_photos ?? [];
  const location = [user.city, user.state, user.country].filter(Boolean).join(', ');
  const today = new Date();
  const bday = user.birthdate ? new Date(user.birthdate) : null;
  const age = bday
    ? today.getFullYear() -
      bday.getFullYear() -
      (today < new Date(today.getFullYear(), bday.getMonth(), bday.getDate()) ? 1 : 0)
    : null;
  const isOnline = user.online_status === 'online';

  const religionLabel = user.religion
    ? (RELIGION_OPTIONS.find((o) => o.value === user.religion)?.label ?? user.religion)
    : null;
  const educationLabel = user.education
    ? (EDUCATION_OPTIONS.find((o) => o.value === user.education)?.label ?? user.education)
    : null;
  const maritalLabel = user.marital_status
    ? (MARITAL_STATUS_OPTIONS.find((o) => o.value === user.marital_status)?.label ??
      user.marital_status)
    : null;
  const wantChildrenLabel = user.want_children
    ? (WANT_CHILDREN_YES_NO.find((o) => o.value === user.want_children)?.label ??
      user.want_children)
    : null;
  const bodyTypeLabel = user.body_type
    ? (PHYSICAL_CONDITION_OPTIONS.find((o) => o.value === user.body_type)?.label ?? user.body_type)
    : null;
  const occupationLabel = user.occupation
    ? (OCCUPATION_OPTIONS.find((o) => o.value === user.occupation)?.label ?? user.occupation)
    : null;
  const interestedInLabel =
    INTERESTED_IN_OPTIONS.find((o) => o.value === user.interested_in)?.label ?? null;
  const locationDisplay = [user.city, user.state, user.country].filter(Boolean).join(', ');
  const originDisplay = [user.origin_city, user.origin_state, user.origin_country]
    .filter(Boolean)
    .join(', ');

  const livesInAfrica = user.country
    ? AFRICAN_COUNTRY_CODES.has(resolveCountryFromStored(user.country)?.code ?? '')
    : false;
  const hasAfricanOrigin =
    !!user.origin_country &&
    AFRICAN_COUNTRY_CODES.has(resolveCountryFromStored(user.origin_country)?.code ?? '');
  const needsOriginForData = !livesInAfrica && !hasAfricanOrigin;

  const strength = getProfileStrength(user);

  return {
    photos,
    location,
    age,
    isOnline,
    religionLabel,
    educationLabel,
    maritalLabel,
    wantChildrenLabel,
    bodyTypeLabel,
    occupationLabel,
    interestedInLabel,
    locationDisplay,
    originDisplay,
    livesInAfrica,
    needsOriginForData,
    completionPct: strength.percent,
    nextMissing: strength.nextMissing,
  };
}
