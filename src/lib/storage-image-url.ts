import { SUPABASE_URL } from '@/constants';

/**
 * Supabase Storage image renderer URLs (width/quality) — typically lowers egress vs full JPEGs.
 * Requires Storage image transformations enabled on the Supabase project (often Pro+).
 */
const OBJECT_PUBLIC = '/storage/v1/object/public/';
const RENDER_IMAGE_PUBLIC = '/storage/v1/render/image/public/';

export const STORAGE_IMAGE_LIST = { width: 600, quality: 70 } as const;
export const STORAGE_IMAGE_DETAIL = { width: 1080, quality: 75 } as const;

function supabaseHostPrefix(): string | null {
  const base = (SUPABASE_URL ?? '').replace(/\/$/, '');
  if (!base) return null;
  return base;
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
  if (trimmed.includes(RENDER_IMAGE_PUBLIC)) return trimmed;
  const host = supabaseHostPrefix();
  if (!host || !trimmed.startsWith(host)) return trimmed;
  const pathFromOrigin = trimmed.slice(host.length);
  if (!pathFromOrigin.includes(OBJECT_PUBLIC)) return trimmed;
  const q = trimmed.indexOf('?');
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
