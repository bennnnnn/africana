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
});
