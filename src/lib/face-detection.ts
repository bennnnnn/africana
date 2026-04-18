import { NativeModules } from 'react-native';
import FaceDetection from '@react-native-ml-kit/face-detection';

/**
 * On-device face detection via Google ML Kit (free, offline, ~100-300ms per image).
 *
 * We use this at photo-upload time to reject pictures that clearly don't contain a
 * human face (landscapes, memes, logos, pets, blank images). It cannot tell whether
 * the face is actually the user's — that's what the selfie verification flow is for.
 *
 * If the native module is not linked (e.g. the user is running the app in Expo Go,
 * or hasn't rebuilt the dev client since installing the package), we fail *open* —
 * meaning we let the photo through rather than blocking the user. A warning is
 * logged in dev so it's discoverable.
 */

const IS_AVAILABLE = NativeModules.FaceDetection != null;

if (!IS_AVAILABLE && __DEV__) {
  console.warn(
    '[face-detection] Native module not linked. Face checks are disabled. ' +
      'Rebuild the dev client (npx expo prebuild && pod install for iOS) to enable.',
  );
}

export type FaceCheckReason = 'no_face' | 'multiple_faces' | 'error' | 'disabled';

export type FaceCheckResult =
  | { ok: true; faceCount: number }
  | { ok: false; reason: FaceCheckReason };

/**
 * Check whether an image contains a single clear human face.
 *
 * Rules:
 * - 0 faces → rejected (reason: 'no_face')
 * - 1 face → accepted
 * - 2+ faces → accepted for now (group photos are valid profile pics)
 *   (Can switch to 'multiple_faces' rejection later if policy tightens.)
 */
export async function checkImageHasFace(uri: string): Promise<FaceCheckResult> {
  if (!IS_AVAILABLE) return { ok: true, faceCount: 0 };

  try {
    const faces = await FaceDetection.detect(uri, {
      performanceMode: 'fast',
      landmarkMode: 'none',
      contourMode: 'none',
      classificationMode: 'none',
      minFaceSize: 0.1,
    });

    if (!faces || faces.length === 0) {
      return { ok: false, reason: 'no_face' };
    }
    return { ok: true, faceCount: faces.length };
  } catch (e) {
    if (__DEV__) console.warn('[face-detection] detect() failed', e);
    // Fail open so a transient ML Kit error doesn't block real users.
    return { ok: false, reason: 'error' };
  }
}

/**
 * Validate a batch of picked image URIs. Runs checks in parallel (ML Kit handles
 * this fine on a native thread).
 *
 * Returns approved URIs (safe to upload) and rejected URIs (with the reason each
 * was flagged). On native-module-unavailable, everything is approved.
 */
export async function validateFacesInPhotos(uris: string[]): Promise<{
  approved: string[];
  rejected: { uri: string; reason: FaceCheckReason }[];
}> {
  if (!IS_AVAILABLE || uris.length === 0) {
    return { approved: uris, rejected: [] };
  }

  const results = await Promise.all(
    uris.map(async (uri) => ({ uri, result: await checkImageHasFace(uri) })),
  );

  const approved: string[] = [];
  const rejected: { uri: string; reason: FaceCheckReason }[] = [];

  for (const { uri, result } of results) {
    if (result.ok) approved.push(uri);
    // A transient ML Kit error on a specific photo (reason: 'error') is treated as a
    // soft pass — we don't want a flaky detector to block the user from uploading.
    else if (result.reason === 'error') approved.push(uri);
    else rejected.push({ uri, reason: result.reason });
  }

  return { approved, rejected };
}

/**
 * Human-readable message explaining why a photo was rejected. Use in dialogs.
 */
export function faceRejectionMessage(
  rejectedCount: number,
  approvedCount: number,
): { title: string; message: string } {
  if (rejectedCount === 1 && approvedCount === 0) {
    return {
      title: "We couldn't find a face",
      message:
        "That photo doesn't clearly show a human face. Please pick one where your face is visible.",
    };
  }
  if (rejectedCount > 1 && approvedCount === 0) {
    return {
      title: "We couldn't find any faces",
      message:
        "None of your photos clearly show a human face. Please pick ones where your face is visible.",
    };
  }
  // Some approved, some rejected
  return {
    title: `Skipped ${rejectedCount} photo${rejectedCount === 1 ? '' : 's'}`,
    message: `${rejectedCount} of your photos didn't clearly show a human face and were skipped. ${approvedCount} uploaded.`,
  };
}
