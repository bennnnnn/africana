import * as Linking from 'expo-linking';

/**
 * Public HTTPS origin for profile share links (Universal Links / App Links).
 * Host must serve this repo's `public/profile-share.html` and the platform
 * association files (Apple `apple-app-site-association`, Android `assetlinks.json`).
 *
 * Example EAS env: EXPO_PUBLIC_PROFILE_SHARE_WEB_ORIGIN=https://open.yourdomain.com
 *
 * When unset, falls back to `Linking.createURL` (custom scheme — fine for installs only).
 */
const WEB_ORIGIN = (process.env.EXPO_PUBLIC_PROFILE_SHARE_WEB_ORIGIN ?? '').replace(/\/$/, '');

export function getProfileShareUrl(profileId: string): string {
  if (WEB_ORIGIN.length > 0) {
    return `${WEB_ORIGIN}/profile-share.html?id=${encodeURIComponent(profileId)}`;
  }
  return Linking.createURL(`/(profile)/${profileId}`);
}
