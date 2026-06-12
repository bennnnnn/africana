import { useCallback, useEffect, useState } from 'react';
import {
  getEthnicityOptions,
  getLanguageOptions,
  resolveCultureLocationFromProfile,
} from '@/lib/cultural-data';
import type { User } from '@/types';

export function useMeProfileCultureData(user: User | null) {
  const [cultureEthnicitySuggested, setCultureEthnicitySuggested] = useState<string[]>([]);
  const [cultureEthnicityOpts, setCultureEthnicityOpts] = useState<string[]>([]);
  const [cultureLanguageOpts, setCultureLanguageOpts] = useState<{
    suggested: string[];
    all: string[];
  }>({
    suggested: [],
    all: [],
  });
  const [cultureLoading, setCultureLoading] = useState(false);

  const loadCultureData = useCallback(async () => {
    if (!user) return;

    setCultureLoading(true);
    const cultureLocation = resolveCultureLocationFromProfile(user);
    if (!cultureLocation) {
      setCultureEthnicitySuggested([]);
      setCultureEthnicityOpts([]);
      setCultureLanguageOpts({ suggested: [], all: [] });
      setCultureLoading(false);
      return;
    }

    const { countryCode, subdivision, city } = cultureLocation;

    try {
      const [ethOpts, langOpts] = await Promise.all([
        getEthnicityOptions(countryCode, subdivision, city),
        getLanguageOptions(countryCode, user.ethnicity ?? null, subdivision, city),
      ]);
      setCultureEthnicitySuggested(ethOpts?.suggested ?? []);
      setCultureEthnicityOpts(ethOpts?.all ?? []);
      setCultureLanguageOpts({ suggested: langOpts?.suggested ?? [], all: langOpts?.all ?? [] });
    } catch {
      /* keep prior options */
    } finally {
      setCultureLoading(false);
    }
  }, [user]);

  // Preload culture options so ethnicity/languages modals aren't empty on first open.
  useEffect(() => {
    if (!user) return;
    void loadCultureData();
  }, [
    user?.id,
    user?.country,
    user?.state,
    user?.city,
    user?.origin_country,
    user?.origin_state,
    user?.origin_city,
    user?.ethnicity,
    loadCultureData,
  ]);

  return {
    cultureEthnicitySuggested,
    cultureEthnicityOpts,
    cultureLanguageOpts,
    cultureLoading,
    loadCultureData,
  };
}
