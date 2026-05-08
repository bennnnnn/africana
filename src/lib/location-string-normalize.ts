/**
 * Shared normalization for matching IP/API location strings to `country-data` labels.
 * Keep in sync with `LocationPicker` city/subdivision fuzzy logic.
 */
export function normalizeLocationString(input: string | null | undefined): string {
  return (input ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[()'’.,/-]/g, ' ')
    .replace(
      /\b(region|regional state|state|province|county|district|zone|governorate|wilaya|department|division)\b/g,
      '',
    )
    .replace(/\s+/g, ' ')
    .trim();
}
