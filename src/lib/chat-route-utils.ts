export function normalizeRouteParam(v: string | string[] | undefined): string | undefined {
  if (typeof v === 'string' && v.length > 0) return v.trim();
  if (Array.isArray(v) && typeof v[0] === 'string' && v[0].length > 0) return v[0].trim();
  return undefined;
}
