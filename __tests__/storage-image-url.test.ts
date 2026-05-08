jest.mock('@/constants', () => {
  const actual = jest.requireActual<typeof import('@/constants')>('@/constants');
  return {
    ...actual,
    SUPABASE_URL: 'https://xyzcompany.supabase.co',
  };
});

describe('storage-image-url', () => {
  const base = 'https://xyzcompany.supabase.co';

  test('rewrites object/public URLs to render/image with width and quality', async () => {
    const StorageImageUrl = await import('@/lib/storage-image-url');
    const input = `${base}/storage/v1/object/public/avatars/abc/photo.jpg`;
    const out = StorageImageUrl.withStorageImageTransform(
      input,
      StorageImageUrl.STORAGE_IMAGE_LIST,
    );
    expect(out).toContain('/storage/v1/render/image/public/avatars/abc/photo.jpg');
    expect(out).toContain('width=600');
    expect(out).toContain('quality=70');
  });

  test('passes through non-Supabase URLs', async () => {
    const StorageImageUrl = await import('@/lib/storage-image-url');
    const input = 'https://ui-avatars.com/api/?name=Test';
    expect(
      StorageImageUrl.withStorageImageTransform(input, StorageImageUrl.STORAGE_IMAGE_LIST),
    ).toBe(input);
  });

  test('skips render URL when EXPO_PUBLIC_SUPABASE_STORAGE_IMAGE_TRANSFORM=0', async () => {
    const prev = process.env.EXPO_PUBLIC_SUPABASE_STORAGE_IMAGE_TRANSFORM;
    process.env.EXPO_PUBLIC_SUPABASE_STORAGE_IMAGE_TRANSFORM = '0';
    jest.resetModules();
    const StorageImageUrl = await import('@/lib/storage-image-url');
    const input = 'https://xyzcompany.supabase.co/storage/v1/object/public/avatars/abc/photo.jpg';
    expect(
      StorageImageUrl.withStorageImageTransform(input, StorageImageUrl.STORAGE_IMAGE_LIST),
    ).toBe(input);
    process.env.EXPO_PUBLIC_SUPABASE_STORAGE_IMAGE_TRANSFORM = prev;
    jest.resetModules();
  });
});
