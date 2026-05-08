/**
 * URL to show as the user's face in lists, inbox, and chat header.
 * Matches discover / profile cards: first gallery photo, then legacy `avatar_url`.
 */
export function primaryProfilePhotoUrl(
  user: { profile_photos?: string[] | null; avatar_url?: string | null } | null | undefined,
): string | null {
  if (!user) return null;
  const fromGallery = user.profile_photos?.find((u) => u?.trim());
  const avatar = user.avatar_url?.trim();
  return fromGallery || avatar || null;
}
