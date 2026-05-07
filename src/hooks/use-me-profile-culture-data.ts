import { useCallback, useState } from 'react';
import { getEthnicityOptions, getLanguageOptions } from '@/lib/cultural-data';
import { resolveCountryFromStored, AFRICAN_COUNTRY_CODES } from '@/lib/country-data';
import type { User } from '@/types';

export function useMeProfileCultureData(user: User | null) {
  const [cultureEthnicityOpts, setCultureEthnicityOpts] = useState<string[]>([]);
  const [cultureLanguageOpts, setCultureLanguageOpts] = useState<{ suggested: string[]; all: string[] }>({
    suggested: [],
    all: [],
  });
  const [cultureLoading, setCultureLoading] = useState(false);

  const loadCultureData = useCallback(async () => {
    if (!user) return;
    const livingCountryData = resolveCountryFromStored(user.country ?? '');
    const livesInAfrica = livingCountryData ? AFRICAN_COUNTRY_CODES.has(livingCountryData.code) : false;

    let countryCode: string | undefined;
    let subdivision: string;
    let city: string;

    if (livesInAfrica) {
      countryCode = livingCountryData?.code;
      subdivision = user.state ?? '';
      city = user.city ?? '';
    } else {
      const originData = resolveCountryFromStored(user.origin_country ?? '');
      if (originData && AFRICAN_COUNTRY_CODES.has(originData.code)) {
        countryCode = originData.code;
        subdivision = user.origin_state ?? '';
        city = user.origin_city ?? '';
      } else {
        countryCode = livingCountryData?.code;
        subdivision = user.state ?? '';
        city = user.city ?? '';
      }
    }
    if (!countryCode) return;

    setCultureLoading(true);
    try {
      const [ethOpts, langOpts] = await Promise.all([
        getEthnicityOptions(countryCode, subdivision, city),
        getLanguageOptions(countryCode, user.ethnicity ?? null, subdivision, city),
      ]);
      setCultureEthnicityOpts(ethOpts?.all ?? []);
      setCultureLanguageOpts({ suggested: langOpts?.suggested ?? [], all: langOpts?.all ?? [] });
    } catch {
      /* keep prior options */
    }
    setCultureLoading(false);
  }, [user]);

  return {
    cultureEthnicityOpts,
    cultureLanguageOpts,
    cultureLoading,
    loadCultureData,
  };
}
