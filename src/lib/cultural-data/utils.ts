import { CountryCultureData } from './types';

export function normalizeKey(value: string | null | undefined) {
  return (value ?? '').trim().replace(/\s+/g, '_');
}

export function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

/** Strip trailing administrative labels ("Lagos State", "Greater Accra Region"). */
function stripAdminSuffix(raw: string): string {
  return raw
    .replace(/\s+\b(state|province|region|regional\s+state|division|governorate|wilaya)\b\.?$/i, '')
    .trim();
}

/**
 * Look up string[] lists in culture maps when DB/LocationPicker strings may not
 * match map keys exactly (spacing, "State" suffix, underscores).
 */
function lookupStringListMap(
  map: Record<string, string[]> | undefined,
  raw: string | null | undefined,
): string[] {
  if (!map || !raw?.trim()) return [];
  const trimmed = raw.trim();
  const stripped = stripAdminSuffix(trimmed);
  const candidates = [
    trimmed,
    stripped,
    normalizeKey(trimmed),
    normalizeKey(stripped),
    trimmed.replace(/_/g, ' '),
    stripped.replace(/_/g, ' '),
  ];
  for (const c of candidates) {
    if (!c) continue;
    const hit = map[c] ?? map[normalizeKey(c)];
    if (hit?.length) return [...hit];
  }
  const target = stripped.toLowerCase();
  for (const k of Object.keys(map)) {
    if (stripAdminSuffix(k).toLowerCase() === target || k.toLowerCase() === trimmed.toLowerCase()) {
      const hit = map[k];
      if (hit?.length) return [...hit];
    }
  }
  return [];
}

function ethnicityLanguageList(
  country: CountryCultureData | null | undefined,
  ethnicity: string | null | undefined,
): string[] {
  if (!country?.ethnicityLanguages || !ethnicity?.trim()) return [];
  const m = country.ethnicityLanguages;
  return lookupStringListMap(m, ethnicity);
}

export function buildEthnicityOptions(
  country: CountryCultureData | null,
  subdivision?: string | null,
  city?: string | null,
) {
  if (!country) return null;

  // State/region narrows before city (country-wide list stays in `all`).
  const prioritized = unique([
    ...(subdivision ? lookupStringListMap(country.subdivisionEthnicities, subdivision) : []),
    ...(city ? lookupStringListMap(country.cityEthnicities, city) : []),
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
  city?: string | null,
) {
  if (!country && fallbackLanguages.length === 0) return null;

  const prioritized = unique([
    ...(ethnicity ? ethnicityLanguageList(country, ethnicity) : []),
    ...(subdivision ? lookupStringListMap(country?.subdivisionLanguages, subdivision) : []),
    ...(city ? lookupStringListMap(country?.cityLanguages, city) : []),
  ]);

  return {
    suggested: prioritized,
    all: unique([...prioritized, ...(country?.languages ?? []), ...fallbackLanguages]),
  };
}
