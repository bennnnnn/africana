import {
  profileMatchesLocationFilter,
  profileMatchesLocationFilterBuggy,
} from '@/lib/discover-location-filter';

describe('discover location filters', () => {
  const profile = { state: 'California', city: 'Los Angeles' };

  it('includes profiles with real city/state when viewer did not filter', () => {
    expect(profileMatchesLocationFilter(null, null, profile)).toBe(true);
  });

  it('excludes profiles when viewer filters to a different city', () => {
    expect(profileMatchesLocationFilter(null, 'San Francisco', profile)).toBe(false);
  });

  it('matches when viewer filters to the same city and state', () => {
    expect(profileMatchesLocationFilter('California', 'Los Angeles', profile)).toBe(true);
  });

  it('documents the pre-fix bug: null filters hid normal profiles', () => {
    expect(profileMatchesLocationFilterBuggy(null, null, profile)).toBe(false);
  });
});
