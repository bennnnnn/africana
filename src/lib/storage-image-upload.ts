import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';
import { logWarn } from '@/lib/logger';

/**
 * Compress + downscale before upload. Uploading the raw 12MP HEIC straight
 * from the camera roll is wasteful — for dating-app use-cases 1600px on the
 * long edge at moderate JPEG quality is indistinguishable on phone screens and
 * cuts payload vs uploading full camera resolution.
 */
const MAX_DIMENSION = 1080;
const JPEG_QUALITY = 0.78;

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
    logWarn('[storage-image-upload] compress failed, uploading original', e);
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

/**
 * Parses a public avatars URL into `bucketPath` for `storage.from('avatars').remove([path])`.
 * Returns null if the URL is not from this project's public avatars path.
 */
export function publicAvatarsUrlToStoragePath(publicUrl: string): string | null {
  const marker = '/object/public/avatars/';
  const i = publicUrl.indexOf(marker);
  if (i === -1) return null;
  const path = publicUrl.slice(i + marker.length).split('?')[0];
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
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
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
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

type UploadAccess = 'public' | 'private';

async function uploadLocalImageToBucket(
  bucket: string,
  storagePath: string,
  localUri: string,
  upsert: boolean,
  mimeType: string | null | undefined,
  access: UploadAccess,
): Promise<{ publicUrl: string } | { storagePath: string } | { error: string }> {
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

  if (access === 'private') {
    return { storagePath };
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return { publicUrl: data.publicUrl };
}

/** Private bucket for verification selfies (RLS: own folder only). */
export const VERIFICATION_PHOTOS_BUCKET = 'verification-photos';

/** Signed URL for moderation or in-app preview of a private verification object. */
export async function createSignedVerificationPhotoUrl(
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<{ signedUrl: string } | { error: string }> {
  const { data, error } = await supabase.storage
    .from(VERIFICATION_PHOTOS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) return { error: error.message };
  return { signedUrl: data.signedUrl };
}

export async function uploadToAvatarsBucket(
  userId: string,
  localUri: string,
  mimeType?: string | null,
): Promise<{ publicUrl: string } | { error: string }> {
  // Always .jpg — compressForUpload() converts everything to JPEG before upload.
  const path = `${userId}/${Date.now()}.jpg`;
  const out = await uploadLocalImageToBucket('avatars', path, localUri, false, mimeType, 'public');
  if ('error' in out) return out;
  if (!('publicUrl' in out)) return { error: 'Upload failed.' };
  return { publicUrl: out.publicUrl };
}

/**
 * Verification selfie → private `verification-photos` bucket.
 * Store the returned `storagePath` in `profiles.verification_photo` (not a public URL).
 * Legacy rows may still hold a public `avatars` URL until users re-submit.
 */
export async function uploadVerificationSelfie(
  userId: string,
  localUri: string,
  mimeType?: string | null,
): Promise<{ storagePath: string } | { error: string }> {
  const path = `${userId}/verification-${Date.now()}.jpg`;
  const out = await uploadLocalImageToBucket(
    VERIFICATION_PHOTOS_BUCKET,
    path,
    localUri,
    false,
    mimeType,
    'private',
  );
  if ('error' in out) return out;
  if (!('storagePath' in out)) return { error: 'Upload failed.' };
  return { storagePath: out.storagePath };
}
