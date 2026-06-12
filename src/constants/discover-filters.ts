/**
 * Discover filter sheet visibility flags.
 * Set to true when enough members are verified to make "Verified only" useful.
 */
export const SHOW_VERIFIED_ONLY_FILTER = false;

/** Respects SHOW_VERIFIED_ONLY_FILTER — keeps stored preference but ignores it when hidden. */
export function effectiveVerifiedOnlyFilter(verifiedOnly: boolean): boolean {
  return SHOW_VERIFIED_ONLY_FILTER && verifiedOnly;
}
