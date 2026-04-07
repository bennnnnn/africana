import { CountryCultureData } from './types';
import { buildEthnicityOptions, buildLanguageOptions } from './utils';
type CultureOptionSet = {
  suggested: string[];
  all: string[];
};
type CultureRegion =
  | 'east_africa'
  | 'west_africa'
  | 'central_africa'
  | 'north_africa'
  | 'southern_africa';

const COUNTRY_TO_REGION: Record<string, CultureRegion> = {
  ET: 'east_africa',
  KE: 'east_africa',
  TZ: 'east_africa',
  UG: 'east_africa',
  RW: 'east_africa',
  BI: 'east_africa',
  SO: 'east_africa',
  ER: 'east_africa',
  DJ: 'east_africa',
  MG: 'east_africa',
  SS: 'east_africa',
  KM: 'east_africa',
  SC: 'east_africa',
  MU: 'east_africa',
  NG: 'west_africa',
  GH: 'west_africa',
  SN: 'west_africa',
  CI: 'west_africa',
  SL: 'west_africa',
  LR: 'west_africa',
  GN: 'west_africa',
  ML: 'west_africa',
  BF: 'west_africa',
  GW: 'west_africa',
  GM: 'west_africa',
  CV: 'west_africa',
  TG: 'west_africa',
  BJ: 'west_africa',
  NE: 'west_africa',
  MR: 'west_africa',
  ST: 'west_africa',
  CM: 'west_africa',
  CD: 'central_africa',
  CG: 'central_africa',
  CF: 'central_africa',
  TD: 'central_africa',
  GA: 'central_africa',
  GQ: 'central_africa',
  EG: 'north_africa',
  MA: 'north_africa',
  DZ: 'north_africa',
  TN: 'north_africa',
  LY: 'north_africa',
  SD: 'north_africa',
  ZA: 'southern_africa',
  ZW: 'southern_africa',
  ZM: 'southern_africa',
  MZ: 'southern_africa',
  AO: 'southern_africa',
  BW: 'southern_africa',
  NA: 'southern_africa',
  MW: 'southern_africa',
  LS: 'southern_africa',
  SZ: 'southern_africa',
};

const cultureCache = new Map<string, CountryCultureData | null>();
const languageCache = new Map<string, readonly string[]>();

const cultureLoaders: Record<CultureRegion, () => Promise<Record<string, CountryCultureData>>> = {
  east_africa: async () => (await import('./east-africa')).EAST_AFRICA_CULTURE,
  west_africa: async () => (await import('./west-africa')).WEST_AFRICA_CULTURE,
  central_africa: async () => (await import('./central-africa')).CENTRAL_AFRICA_CULTURE,
  north_africa: async () => (await import('./north-africa')).NORTH_AFRICA_CULTURE,
  southern_africa: async () => (await import('./southern-africa')).SOUTHERN_AFRICA_CULTURE,
};

const languageLoaders: Record<CultureRegion, () => Promise<Record<string, readonly string[]>>> = {
  east_africa: async () => (await import('./generated/east_africa-languages.generated')).COUNTRY_LANGUAGE_MAP,
  west_africa: async () => (await import('./generated/west_africa-languages.generated')).COUNTRY_LANGUAGE_MAP,
  central_africa: async () => (await import('./generated/central_africa-languages.generated')).COUNTRY_LANGUAGE_MAP,
  north_africa: async () => (await import('./generated/north_africa-languages.generated')).COUNTRY_LANGUAGE_MAP,
  southern_africa: async () => (await import('./generated/southern_africa-languages.generated')).COUNTRY_LANGUAGE_MAP,
};

export type { CountryCultureData } from './types';
export type { CultureOptionSet };

export async function getCountryCultureData(countryCode: string | null | undefined) {
  if (!countryCode) return null;
  if (cultureCache.has(countryCode)) return cultureCache.get(countryCode) ?? null;

  const region = COUNTRY_TO_REGION[countryCode];
  if (!region) {
    cultureCache.set(countryCode, null);
    return null;
  }

  const data = await cultureLoaders[region]();
  const countryData = data[countryCode] ?? null;
  cultureCache.set(countryCode, countryData);
  return countryData;
}

export async function getEthnicityOptions(
  countryCode: string | null | undefined,
  subdivision?: string | null,
  city?: string | null
): Promise<CultureOptionSet | null> {
  return buildEthnicityOptions(await getCountryCultureData(countryCode), subdivision, city);
}

async function getCountryLanguages(countryCode: string | null | undefined) {
  if (!countryCode) return [];
  if (languageCache.has(countryCode)) return languageCache.get(countryCode) ?? [];

  const region = COUNTRY_TO_REGION[countryCode];
  if (!region) {
    languageCache.set(countryCode, []);
    return [];
  }

  const data = await languageLoaders[region]();
  const languages = data[countryCode] ?? [];
  languageCache.set(countryCode, languages);
  return languages;
}

export async function getLanguageOptions(
  countryCode: string | null | undefined,
  ethnicity?: string | null,
  subdivision?: string | null,
  city?: string | null
): Promise<CultureOptionSet | null> {
  const [countryData, fallbackLanguages] = await Promise.all([
    getCountryCultureData(countryCode),
    getCountryLanguages(countryCode),
  ]);
  return buildLanguageOptions(countryData, fallbackLanguages, ethnicity, subdivision, city);
}
