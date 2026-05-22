export type ValidationResult = {
  valid: boolean;
  message?: string;
};

// RFC 5322 simplified: local@domain.tld with TLD ≥ 2 chars
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
// Allow Unicode letters (covers accented and non-Latin African names like Ndèye, Ọlúwasẹun, Aimé)
const FIRST_NAME_RE = /^[\p{L}]+(?:[-'][\p{L}]+)*$/u;

export function validateEmail(value: string): ValidationResult {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return { valid: false, message: 'Email is required.' };
  if (!EMAIL_RE.test(normalized)) return { valid: false, message: 'Enter a valid email.' };
  return { valid: true };
}

/** Keep in sync with Supabase Auth password policy (Dashboard → Auth). */
export const MIN_PASSWORD_LENGTH = 12;

export function validatePassword(value: string): ValidationResult {
  if (!value) return { valid: false, message: 'Password is required.' };
  if (value.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, message: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  return { valid: true };
}

export function validateFirstName(value: string): ValidationResult {
  const normalized = value.trim();
  if (!normalized) return { valid: false, message: 'First name is required.' };
  if (normalized.includes(' ')) return { valid: false, message: 'Use first name only.' };
  if (!FIRST_NAME_RE.test(normalized)) return { valid: false, message: 'Use letters only.' };
  if (normalized.length < 2) return { valid: false, message: 'Name is too short.' };
  return { valid: true };
}

export function getValidationState(
  visible: boolean,
  result: ValidationResult,
  hasValue: boolean,
): 'default' | 'error' | 'success' {
  if (!visible) return 'default';
  if (!result.valid) return 'error';
  if (hasValue) return 'success';
  return 'default';
}
