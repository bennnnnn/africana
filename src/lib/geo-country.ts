import { getCountry } from '@/lib/country-data';

type IpApiCo = {
  country_code?: string;
  error?: boolean | string;
  reason?: string;
};

/**
 * Best-effort country from client IP (ipapi.co). Fails silently on network/CORS issues.
 * Used to pre-fill location in onboarding.
 */
export async function detectCountryFromIp(): Promise<{ country: string; countryCode: string } | null> {
  try {
    const res = await fetch('https://ipapi.co/json/', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as IpApiCo;
    if (data.error || !data.country_code) return null;
    const c = getCountry(data.country_code);
    if (!c) return null;
    return { country: c.name, countryCode: c.code };
  } catch {
    return null;
  }
}
