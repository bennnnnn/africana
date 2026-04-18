import { File } from 'expo-file-system';
import { readAsStringAsync } from 'expo-file-system/src/legacy/FileSystem';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';

/**
 * Compress + downscale before upload. Uploading the raw 12MP HEIC straight
 * from the camera roll is wasteful — for dating-app use-cases 1600px on the
 * long edge at JPEG q=0.82 is indistinguishable to the human eye and cuts
 * payload by ~8-20x.
 */
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

async function compressForUpload(localUri: string): Promise<{ uri: string; mimeType: string }> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      localUri,
      [{ resize: { width: MAX_DIMENSION } }],
      { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
    );
    return { uri: result.uri, mimeType: 'image/jpeg' };
  } catch (e) {
    // If manipulation fails (very large file, unsupported format) we fall back
    // to the original URI — upload can still succeed, just bigger.
    console.warn('[storage-image-upload] compress failed, uploading original:', e);
    return { uri: localUri, mimeType: '' };
  }
}

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
  upsert: boolean,
  mimeType?: string | null,
): Promise<{ publicUrl: string } | { error: string }> {
  const { uri: compressedUri, mimeType: compressedMime } = await compressForUpload(localUri);
  const effectiveMime = compressedMime || mimeType || null;
  const contentType = imageContentType(compressedUri, effectiveMime);
  let buffer: ArrayBuffer;
  try {
    buffer = await localImageUriToArrayBuffer(compressedUri);
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
  // Always .jpg — compressForUpload() converts everything to JPEG before upload.
  const path = `${userId}/${Date.now()}.jpg`;
  return uploadLocalImageToBucket('avatars', path, localUri, false, mimeType);
}

/** Verification selfie → `profile-photos` bucket (same RLS pattern: first path segment = user id). */
export async function uploadVerificationSelfie(
  userId: string,
  localUri: string,
  mimeType?: string | null,
): Promise<{ publicUrl: string } | { error: string }> {
  const path = `${userId}/verification-${Date.now()}.jpg`;
  return uploadLocalImageToBucket('profile-photos', path, localUri, true, mimeType);
}
