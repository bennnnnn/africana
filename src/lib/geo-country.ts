import type { CountryData } from '@/lib/country-data';
import { getCountry } from '@/lib/country-data';
import { loadAfricaCountryCities } from '@/lib/africa-city-data';
import { normalizeLocationString } from '@/lib/location-string-normalize';
import { logWarn } from '@/lib/logger';

const FETCH_TIMEOUT_MS = 12_000;

export type LocationFromIp = {
  country: string;
  countryCode: string;
  subdivision: string;
  city: string;
};

async function fetchJson(url: string): Promise<unknown | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function matchCatalog(countryCode: string | undefined | null): { country: string; countryCode: string } | null {
  if (!countryCode || typeof countryCode !== 'string') return null;
  const code = countryCode.trim().toUpperCase();
  if (code.length !== 2) return null;
  const c = getCountry(code);
  if (!c) return null;
  return { country: c.name, countryCode: c.code };
}

type IpRaw = { country_code: string; region: string; city: string };

function parseIpWhoToRaw(data: unknown): IpRaw | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (d.success === false) return null;
  const code =
    typeof d.country_code === 'string'
      ? d.country_code.trim().toUpperCase()
      : '';
  if (!getCountry(code)) return null;
  return {
    country_code: code,
    region: typeof d.region === 'string' ? d.region.trim() : '',
    city: typeof d.city === 'string' ? d.city.trim() : '',
  };
}

function parseGeoJsToRaw(data: unknown): IpRaw | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const code =
    typeof d.country_code === 'string'
      ? d.country_code.trim().toUpperCase()
      : '';
  if (!getCountry(code)) return null;
  return {
    country_code: code,
    region: typeof d.region === 'string' ? d.region.trim() : '',
    city: typeof d.city === 'string' ? d.city.trim() : '',
  };
}

function parseIpApiCoToRaw(data: unknown): IpRaw | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (d.error) return null;
  const code =
    typeof d.country_code === 'string'
      ? d.country_code.trim().toUpperCase()
      : '';
  if (!getCountry(code)) return null;
  const region =
    typeof d.region === 'string'
      ? d.region.trim()
      : typeof d.region_code === 'string'
        ? d.region_code.trim()
        : '';
  return {
    country_code: code,
    region,
    city: typeof d.city === 'string' ? d.city.trim() : '',
  };
}

function scoreRegionAgainstSubdivision(regionNorm: string, subName: string): number {
  const subNorm = normalizeLocationString(subName);
  if (!regionNorm || !subNorm) return 0;
  if (regionNorm === subNorm) return 100;
  if (regionNorm.includes(subNorm) || subNorm.includes(regionNorm)) {
    return 55 + Math.min(subNorm.length, regionNorm.length);
  }
  const rt = new Set(regionNorm.split(' ').filter(Boolean));
  const st = new Set(subNorm.split(' ').filter(Boolean));
  let overlap = 0;
  for (const w of st) if (rt.has(w)) overlap++;
  if (overlap > 0) return 28 + overlap * 10;
  return 0;
}

function pickBestSubdivisionName(country: CountryData, regionRaw: string): string {
  if (!regionRaw || country.subdivisions.length === 0) return '';
  const regionNorm = normalizeLocationString(regionRaw);
  let best = '';
  let bestScore = 0;
  for (const sub of country.subdivisions) {
    const sc = scoreRegionAgainstSubdivision(regionNorm, sub.name);
    if (sc > bestScore) {
      bestScore = sc;
      best = sub.name;
    }
  }
  return bestScore >= 28 ? best : '';
}

function pickBestCityInStrings(cities: string[], cityRaw: string): string {
  const cityNorm = normalizeLocationString(cityRaw);
  if (!cityNorm || cities.length === 0) return '';
  let best = '';
  let bestScore = 0;
  for (const c of cities) {
    const cn = normalizeLocationString(c);
    if (cn === cityNorm) return c;
    let sc = 0;
    if (cityNorm.includes(cn) || cn.includes(cityNorm)) {
      sc = 58 + Math.min(c.length, cityRaw.length);
    } else {
      const ct = new Set(cityNorm.split(' ').filter(Boolean));
      const nt = new Set(cn.split(' ').filter(Boolean));
      let ov = 0;
      for (const w of nt) if (ct.has(w)) ov++;
      if (ov > 0) sc = 26 + ov * 10;
    }
    if (sc > bestScore) {
      bestScore = sc;
      best = c;
    }
  }
  return bestScore >= 26 ? best : '';
}

async function citiesForSubdivision(country: CountryData, subdivisionName: string): Promise<string[]> {
  const sub = country.subdivisions.find((s) => s.name === subdivisionName);
  const staticList = sub?.cities ?? [];
  const ext = await loadAfricaCountryCities(country.code);
  if (!ext) return staticList;
  const exact = ext[subdivisionName];
  if (exact?.length) return [...new Set([...staticList, ...exact])];
  const target = normalizeLocationString(subdivisionName);
  const key = Object.keys(ext).find((k) => normalizeLocationString(k) === target);
  if (key && ext[key]?.length) return [...new Set([...staticList, ...ext[key]])];
  return staticList;
}

function resolveCanonicalSubdivisionKey(country: CountryData, mapKey: string): string {
  const exact = country.subdivisions.find((s) => s.name === mapKey);
  if (exact) return exact.name;
  const target = normalizeLocationString(mapKey);
  const fuzzy = country.subdivisions.find((s) => normalizeLocationString(s.name) === target);
  return fuzzy?.name ?? mapKey;
}

async function findSubdivisionAndCityFromCityOnly(
  country: CountryData,
  cityRaw: string,
): Promise<{ subdivision: string; city: string }> {
  const cityNorm = normalizeLocationString(cityRaw);
  if (!cityNorm) return { subdivision: '', city: '' };

  for (const sub of country.subdivisions) {
    const hit = pickBestCityInStrings(sub.cities, cityRaw);
    if (hit) return { subdivision: sub.name, city: hit };
  }

  const ext = await loadAfricaCountryCities(country.code);
  if (ext) {
    for (const [mapKey, list] of Object.entries(ext)) {
      const hit = pickBestCityInStrings(list, cityRaw);
      if (hit) {
        return { subdivision: resolveCanonicalSubdivisionKey(country, mapKey), city: hit };
      }
    }
  }

  return { subdivision: '', city: '' };
}

async function resolveIpRawToLocation(raw: IpRaw): Promise<LocationFromIp | null> {
  const cat = matchCatalog(raw.country_code);
  if (!cat) return null;
  const countryData = getCountry(cat.countryCode);
  if (!countryData) {
    return { ...cat, subdivision: '', city: '' };
  }

  const region = raw.region.trim();
  const cityIn = raw.city.trim();

  if (countryData.subdivisions.length === 0) {
    return {
      ...cat,
      subdivision: region,
      city: cityIn,
    };
  }

  let subName = pickBestSubdivisionName(countryData, region);

  if (!subName && cityIn) {
    const found = await findSubdivisionAndCityFromCityOnly(countryData, cityIn);
    if (found.subdivision) {
      return { ...cat, subdivision: found.subdivision, city: found.city };
    }
  }

  if (!subName) {
    return { ...cat, subdivision: '', city: '' };
  }

  const subObj = countryData.subdivisions.find((s) => s.name === subName);
  if (!subObj) {
    return { ...cat, subdivision: '', city: '' };
  }

  if (!cityIn) {
    return { ...cat, subdivision: subName, city: '' };
  }

  const mergedCities = await citiesForSubdivision(countryData, subName);
  const cityOut = pickBestCityInStrings(mergedCities, cityIn);

  if (cityOut) {
    return { ...cat, subdivision: subName, city: cityOut };
  }

  if (subObj.cities.length === 0) {
    return { ...cat, subdivision: subName, city: cityIn };
  }

  return { ...cat, subdivision: subName, city: '' };
}

const PROVIDERS: { name: string; url: string; parseRaw: (data: unknown) => IpRaw | null }[] = [
  { name: 'ipwho.is', url: 'https://ipwho.is/', parseRaw: parseIpWhoToRaw },
  { name: 'geojs', url: 'https://get.geojs.io/v1/ip/geo.json', parseRaw: parseGeoJsToRaw },
  { name: 'ipapi.co', url: 'https://ipapi.co/json/', parseRaw: parseIpApiCoToRaw },
];

/**
 * Country + best-effort state/region + city from IP, matched to in-app `country-data`
 * (and Africa city bundles when loaded). No GPS / coarse / “near you”.
 */
export async function detectLocationFromIp(): Promise<LocationFromIp | null> {
  for (const { name, url, parseRaw } of PROVIDERS) {
    const rawJson = await fetchJson(url);
    if (rawJson == null) {
      logWarn(`[geo-location] ${name} request failed or timed out`, { url });
      continue;
    }
    const ipRaw = parseRaw(rawJson);
    if (!ipRaw) {
      logWarn(`[geo-location] ${name} response not usable`, { sample: JSON.stringify(rawJson).slice(0, 200) });
      continue;
    }
    try {
      const resolved = await resolveIpRawToLocation(ipRaw);
      if (resolved) return resolved;
    } catch (e) {
      logWarn(`[geo-location] ${name} resolve failed`, e);
    }
  }

  logWarn('[geo-location] all IP location providers failed');
  return null;
}

/**
 * @deprecated Prefer {@link detectLocationFromIp} when you need subdivision/city hints.
 */
export async function detectCountryFromIp(): Promise<{ country: string; countryCode: string } | null> {
  const loc = await detectLocationFromIp();
  if (!loc) return null;
  return { country: loc.country, countryCode: loc.countryCode };
}
