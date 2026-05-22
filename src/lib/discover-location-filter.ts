/**
 * Mirrors fetch_discover_profiles_page state/city predicates (for unit tests).
 * When filter param is null, any profile location value should match.
 */
export function profileMatchesLocationFilter(
  filterState: string | null,
  filterCity: string | null,
  profile: { state: string | null; city: string | null },
): boolean {
  const stateOk = filterState === null || profile.state === filterState;
  const cityOk = filterCity === null || profile.city === filterCity;
  return stateOk && cityOk;
}

/** Buggy RPC logic (pre-20260522120000): compared profile columns to null params. */
export function profileMatchesLocationFilterBuggy(
  filterState: string | null,
  filterCity: string | null,
  profile: { state: string | null; city: string | null },
): boolean {
  const stateOk = profile.state === null || profile.state === filterState;
  const cityOk = profile.city === null || profile.city === filterCity;
  return stateOk && cityOk;
}
