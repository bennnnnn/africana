import { SUPABASE_URL } from '@/constants';

/**
 * Supabase Storage image renderer URLs (width/quality) — typically lowers egress vs full JPEGs.
 * Requires Storage image transformations enabled on the Supabase project (often Pro+).
 *
 * If transforms are off or URLs load blank, set in `.env`:
 *   EXPO_PUBLIC_SUPABASE_STORAGE_IMAGE_TRANSFORM=0
 * to always use direct `/object/public/...` URLs.
 */
const OBJECT_PUBLIC = '/storage/v1/object/public/';
const RENDER_IMAGE_PUBLIC = '/storage/v1/render/image/public/';

const STORAGE_IMAGE_TRANSFORM_ENABLED =
  process.env.EXPO_PUBLIC_SUPABASE_STORAGE_IMAGE_TRANSFORM !== '0';

export const STORAGE_IMAGE_LIST = { width: 600, quality: 70 } as const;
export const STORAGE_IMAGE_DETAIL = { width: 1080, quality: 75 } as const;

function supabaseHostPrefix(): string | null {
  const base = (SUPABASE_URL ?? '').replace(/\/$/, '');
  if (!base) return null;
  return base;
}

function isSupabaseStorageUrl(url: URL): boolean {
  return (
    (url.hostname.endsWith('.supabase.co') || url.hostname === 'auth.joinafricana.com') &&
    (url.pathname.includes(OBJECT_PUBLIC) || url.pathname.includes(RENDER_IMAGE_PUBLIC))
  );
}

function storagePathOnCurrentHost(trimmed: string): string | null {
  const host = supabaseHostPrefix();
  if (!host) return null;
  try {
    const parsed = new URL(trimmed);
    if (!isSupabaseStorageUrl(parsed)) return null;
    return `${host}${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

/**
 * If `url` is a public object URL on this project's Supabase Storage, rewrite to the
 * image renderer path with width/quality. Other URLs (e.g. ui-avatars, CDN) pass through.
 */
export function withStorageImageTransform(
  url: string | null | undefined,
  opts: { width: number; quality: number },
): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  const canonicalUrl = storagePathOnCurrentHost(trimmed) ?? trimmed;
  if (!STORAGE_IMAGE_TRANSFORM_ENABLED) return canonicalUrl;
  if (canonicalUrl.includes(RENDER_IMAGE_PUBLIC)) return canonicalUrl;
  const host = supabaseHostPrefix();
  if (!host || !canonicalUrl.startsWith(host)) return canonicalUrl;
  const pathFromOrigin = canonicalUrl.slice(host.length);
  if (!pathFromOrigin.includes(OBJECT_PUBLIC)) return canonicalUrl;
  const q = pathFromOrigin.indexOf('?');
  const pathOnly = q === -1 ? pathFromOrigin : pathFromOrigin.slice(0, q);
  const renderPath = pathOnly.replace(OBJECT_PUBLIC, RENDER_IMAGE_PUBLIC);
  const params = new URLSearchParams({
    width: String(opts.width),
    quality: String(opts.quality),
  });
  return `${host}${renderPath}?${params.toString()}`;
}

export function profileImageUrlForList(url: string | null | undefined): string | null {
  return withStorageImageTransform(url, STORAGE_IMAGE_LIST);
}

export function profileImageUrlForDetail(url: string | null | undefined): string | null {
  return withStorageImageTransform(url, STORAGE_IMAGE_DETAIL);
}

/**
 * If `url` is a Supabase Storage render URL (`/render/image/public/...`), return the
 * equivalent `/object/public/...` URL with no transform query — for fallbacks when
 * transforms are disabled on the project or a render request fails.
 */
export function storagePublicObjectUrlFromRender(url: string): string | null {
  const trimmed = url.trim();
  const canonicalUrl = storagePathOnCurrentHost(trimmed) ?? trimmed;
  const host = supabaseHostPrefix();
  if (!host || !canonicalUrl.startsWith(host)) return null;
  if (!canonicalUrl.includes(RENDER_IMAGE_PUBLIC)) return null;
  const pathFromOrigin = canonicalUrl.slice(host.length);
  const q = pathFromOrigin.indexOf('?');
  const pathOnly = q === -1 ? pathFromOrigin : pathFromOrigin.slice(0, q);
  const objectPath = pathOnly.replace(RENDER_IMAGE_PUBLIC, OBJECT_PUBLIC);
  return `${host}${objectPath}`;
}

export function storagePublicObjectUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  const canonicalUrl = storagePathOnCurrentHost(trimmed) ?? trimmed;
  if (canonicalUrl.includes(RENDER_IMAGE_PUBLIC)) {
    return storagePublicObjectUrlFromRender(canonicalUrl);
  }
  return canonicalUrl;
}
