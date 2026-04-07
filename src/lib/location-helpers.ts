import * as Location from 'expo-location';
import { ALL_COUNTRIES } from '@/lib/country-data';
import { loadAfricaCountryCities } from '@/lib/africa-city-data';

export interface SuggestedLocation {
  country: string;
  countryCode: string;
  region: string;
  subdivision: string;
  city: string;
}

export function parseSubdivisionPath(
  value: string | null | undefined,
): { region?: string; subdivision?: string } {
  if (!value) return {};
  const parts = value
    .split('>')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return {
      region: parts[0],
      subdivision: parts.slice(1).join(' > '),
    };
  }

  return { region: value.trim() };
}

export function formatSubdivisionPath(
  region: string | null | undefined,
  subdivision: string | null | undefined,
): string | null {
  const cleanRegion = region?.trim();
  const cleanSubdivision = subdivision?.trim();
  if (!cleanSubdivision) return cleanRegion || null;
  return cleanRegion ? `${cleanRegion} > ${cleanSubdivision}` : cleanSubdivision;
}

export async function detectCountryCodeByIp(): Promise<string | null> {
  const makeSignal = (ms: number) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    ctrl.signal.addEventListener('abort', () => clearTimeout(t));
    return ctrl.signal;
  };

  const providers: Array<() => Promise<string | null>> = [
    async () => {
      const res = await fetch('https://ipapi.co/json/', { signal: makeSignal(4500) });
      const data = await res.json();
      return typeof data?.country_code === 'string' ? data.country_code : null;
    },
    async () => {
      const res = await fetch('https://ipwho.is/', { signal: makeSignal(4500) });
      const data = await res.json();
      return typeof data?.country_code === 'string' ? data.country_code : null;
    },
    async () => {
      const res = await fetch('https://ip-api.com/json/?fields=countryCode', { signal: makeSignal(4500) });
      const data = await res.json();
      return typeof data?.countryCode === 'string' ? data.countryCode : null;
    },
  ];

  for (const provider of providers) {
    try {
      const code = await provider();
      if (code) return code.toUpperCase();
    } catch {}
  }

  return null;
}

export function normalizeLocationLabel(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(region|regional state|state|province|county|district|zone|governorate|wilaya|department|division)\b/g, '')
    .replace(/[()'’.,/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function mapGeocodedPlaceToSuggestion(
  place: Location.LocationGeocodedAddress,
): Promise<SuggestedLocation | null> {
  const detectedCode = (place.isoCountryCode ?? '').toUpperCase();
  const countryMatch =
    ALL_COUNTRIES.find((country) => country.code === detectedCode) ||
    ALL_COUNTRIES.find((country) => normalizeLocationLabel(country.name) === normalizeLocationLabel(place.country));

  if (!countryMatch) return null;

  const countrySubdivisions = countryMatch.subdivisions;
  const generatedCountry = await loadAfricaCountryCities(countryMatch.code);
  const regionCandidates = [place.region, place.subregion, place.district].filter(Boolean) as string[];
  const cityCandidates = [place.city, place.subregion, place.district, place.name].filter(Boolean) as string[];

  let region = '';
  let city = '';
  const pickerMode = countryMatch.pickerMode ?? 'subdivision';

  if (countrySubdivisions.length > 0) {
    const normalizedCandidates = regionCandidates.map(normalizeLocationLabel);
    const regionNames = pickerMode === 'region'
      ? [...new Set(countrySubdivisions.map((item) => item.region).filter(Boolean) as string[])]
      : countrySubdivisions.map((item) => item.name);
    const exactRegion = regionNames.find((item) =>
      normalizedCandidates.includes(normalizeLocationLabel(item)),
    );
    if (exactRegion) {
      region = exactRegion;
    }

    if (!region && cityCandidates.length > 0) {
      const inferredRegion = regionNames.find((regionName) => {
        const matchingCities = countrySubdivisions
          .filter((item) => (pickerMode === 'region' ? item.region === regionName : item.name === regionName))
          .flatMap((item) => item.cities);
        return matchingCities.some((item) =>
          cityCandidates.some((candidate) => normalizeLocationLabel(item) === normalizeLocationLabel(candidate)),
        );
      });
      if (inferredRegion) region = inferredRegion;
    }

    if (region) {
      const matchingCities = countrySubdivisions
        .filter((item) => (pickerMode === 'region' ? item.region === region : item.name === region))
        .flatMap((item) => item.cities);
      const inferredCity = matchingCities.find((item) =>
        cityCandidates.some((candidate) => normalizeLocationLabel(item) === normalizeLocationLabel(candidate)),
      );
      if (inferredCity) city = inferredCity;
    }
  }

  if (!region && generatedCountry) {
    const normalizedCandidates = regionCandidates.map(normalizeLocationLabel);
    const exactRegion = Object.keys(generatedCountry).find((item) =>
      normalizedCandidates.includes(normalizeLocationLabel(item)),
    );
    if (exactRegion) {
      region = exactRegion;
    } else {
      region = place.region ?? '';
    }
  }

  if (!city && region && generatedCountry) {
    const regionCities = generatedCountry[region] ?? [];
    const inferredCity = regionCities.find((item) =>
      cityCandidates.some((candidate) => normalizeLocationLabel(item) === normalizeLocationLabel(candidate)),
    );
    if (inferredCity) city = inferredCity;
  }

  if (!region) {
    region = place.region ?? '';
  }
  if (!city) {
    city = place.city ?? cityCandidates[0] ?? '';
  }

  return {
    country: countryMatch.name,
    countryCode: countryMatch.code,
    region,
    subdivision: '',
    city,
  };
}

export async function detectPreciseLocation(): Promise<SuggestedLocation | null> {
  const permission = await Location.getForegroundPermissionsAsync();
  let status = permission.status;

  if (status !== 'granted') {
    if (!permission.canAskAgain && status !== 'undetermined') return null;
    const requested = await Location.requestForegroundPermissionsAsync();
    status = requested.status;
  }

  if (status !== 'granted') return null;

  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const places = await Location.reverseGeocodeAsync({
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
  });
  const place = places[0];

  if (!place) return null;
  return mapGeocodedPlaceToSuggestion(place);
}
