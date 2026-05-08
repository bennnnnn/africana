jest.mock('@/constants', () => {
  const actual = jest.requireActual<typeof import('@/constants')>('@/constants');
  return {
    ...actual,
    SUPABASE_URL: 'https://xyzcompany.supabase.co',
  };
});

import { withStorageImageTransform, STORAGE_IMAGE_LIST } from '@/lib/storage-image-url';

describe('storage-image-url', () => {
  const base = 'https://xyzcompany.supabase.co';

  test('rewrites object/public URLs to render/image with width and quality', () => {
    const input = `${base}/storage/v1/object/public/avatars/abc/photo.jpg`;
    const out = withStorageImageTransform(input, STORAGE_IMAGE_LIST);
    expect(out).toContain('/storage/v1/render/image/public/avatars/abc/photo.jpg');
    expect(out).toContain('width=600');
    expect(out).toContain('quality=70');
  });

  test('passes through non-Supabase URLs', () => {
    const input = 'https://ui-avatars.com/api/?name=Test';
    expect(withStorageImageTransform(input, STORAGE_IMAGE_LIST)).toBe(input);
  });

  test('skips render URL when EXPO_PUBLIC_SUPABASE_STORAGE_IMAGE_TRANSFORM=0', () => {
    const prev = process.env.EXPO_PUBLIC_SUPABASE_STORAGE_IMAGE_TRANSFORM;
    process.env.EXPO_PUBLIC_SUPABASE_STORAGE_IMAGE_TRANSFORM = '0';
    jest.resetModules();
    const { withStorageImageTransform: transform, STORAGE_IMAGE_LIST: list } = require('@/lib/storage-image-url');
    const input = 'https://xyzcompany.supabase.co/storage/v1/object/public/avatars/abc/photo.jpg';
    expect(transform(input, list)).toBe(input);
    process.env.EXPO_PUBLIC_SUPABASE_STORAGE_IMAGE_TRANSFORM = prev;
    jest.resetModules();
  });
});
