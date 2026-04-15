import { File } from 'expo-file-system';
import { readAsStringAsync } from 'expo-file-system/src/legacy/FileSystem';
import { supabase } from '@/lib/supabase';

export function imageContentType(uri: string, mimeType?: string | null): string {
  if (mimeType?.startsWith('image/')) return mimeType;
  const u = uri.toLowerCase();
  if (u.endsWith('.png')) return 'image/png';
  if (u.endsWith('.webp')) return 'image/webp';
  if (u.endsWith('.heic') || u.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

export function imageExtensionForContentType(contentType: string): string {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('heic') || contentType.includes('heif')) return 'heic';
  return 'jpg';
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = globalThis.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * React Native: `fetch(uri).blob()` / empty blobs are common for gallery URIs.
 * Prefer legacy base64 read (works with `file://`, `content://`, many `ph://` paths), then `File`, then fetch.
 */
export async function localImageUriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
  try {
    const base64 = await readAsStringAsync(uri, { encoding: 'base64' });
    if (base64?.length > 0) {
      const buf = base64ToArrayBuffer(base64);
      if (buf.byteLength > 0) return buf;
    }
  } catch {
    // URI not supported by legacy reader — try other strategies
  }

  try {
    const file = new File(uri);
    const buf = await file.arrayBuffer();
    if (buf.byteLength > 0) return buf;
  } catch {
    // ignore
  }

  const res = await fetch(uri);
  if (!res.ok) throw new Error('Could not read image.');
  const fallback = await res.arrayBuffer();
  if (fallback.byteLength === 0) throw new Error('Image data was empty.');
  return fallback;
}

async function uploadLocalImageToBucket(
  bucket: string,
  storagePath: string,
  localUri: string,
  mimeType?: string | null,
  upsert: boolean,
): Promise<{ publicUrl: string } | { error: string }> {
  const contentType = imageContentType(localUri, mimeType);
  let buffer: ArrayBuffer;
  try {
    buffer = await localImageUriToArrayBuffer(localUri);
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Could not read image.' };
  }

  const { error } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
    contentType,
    upsert,
  });

  if (error) return { error: error.message };

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return { publicUrl: data.publicUrl };
}

export async function uploadToAvatarsBucket(
  userId: string,
  localUri: string,
  mimeType?: string | null,
): Promise<{ publicUrl: string } | { error: string }> {
  const contentType = imageContentType(localUri, mimeType);
  const ext = imageExtensionForContentType(contentType);
  const path = `${userId}/${Date.now()}.${ext}`;
  return uploadLocalImageToBucket('avatars', path, localUri, mimeType, false);
}

/** Verification selfie → `profile-photos` bucket (same RLS pattern: first path segment = user id). */
export async function uploadVerificationSelfie(
  userId: string,
  localUri: string,
  mimeType?: string | null,
): Promise<{ publicUrl: string } | { error: string }> {
  const contentType = imageContentType(localUri, mimeType);
  const ext = imageExtensionForContentType(contentType);
  const path = `${userId}/verification-${Date.now()}.${ext}`;
  return uploadLocalImageToBucket('profile-photos', path, localUri, mimeType, true);
}
