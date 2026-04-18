import { CountryCultureData } from './types';

export function normalizeKey(value: string | null | undefined) {
  return (value ?? '').trim().replace(/\s+/g, '_');
}

export function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function ethnicityLanguageList(
  country: CountryCultureData | null | undefined,
  ethnicity: string | null | undefined
): string[] {
  if (!country?.ethnicityLanguages || !ethnicity?.trim()) return [];
  const e = ethnicity.trim();
  const m = country.ethnicityLanguages;
  return (
    m[e] ??
    m[normalizeKey(e)] ??
    m[e.replace(/_/g, ' ')] ??
    []
  );
}

export function buildEthnicityOptions(
  country: CountryCultureData | null,
  subdivision?: string | null,
  city?: string | null
) {
  if (!country) return null;

  const prioritized = unique([
    ...(city ? country.cityEthnicities?.[normalizeKey(city)] ?? country.cityEthnicities?.[city] ?? [] : []),
    ...(subdivision
      ? country.subdivisionEthnicities?.[normalizeKey(subdivision)] ?? country.subdivisionEthnicities?.[subdivision] ?? []
      : []),
  ]);

  return {
    suggested: prioritized,
    all: unique([...prioritized, ...country.ethnicities]),
  };
}

export function buildLanguageOptions(
  country: CountryCultureData | null,
  fallbackLanguages: readonly string[] = [],
  ethnicity?: string | null,
  subdivision?: string | null,
  city?: string | null
) {
  if (!country && fallbackLanguages.length === 0) return null;

  const prioritized = unique([
    ...(ethnicity ? ethnicityLanguageList(country, ethnicity) : []),
    ...(city ? country?.cityLanguages?.[normalizeKey(city)] ?? country?.cityLanguages?.[city] ?? [] : []),
    ...(subdivision
      ? country?.subdivisionLanguages?.[normalizeKey(subdivision)] ?? country?.subdivisionLanguages?.[subdivision] ?? []
      : []),
  ]);

  return {
    suggested: prioritized,
    all: unique([...prioritized, ...(country?.languages ?? []), ...fallbackLanguages]),
  };
}
