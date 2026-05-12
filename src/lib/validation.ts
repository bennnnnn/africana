export type ValidationResult = {
  valid: boolean;
  message?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Allow Unicode letters (covers accented and non-Latin African names like Ndèye, Ọlúwasẹun, Aimé)
const FIRST_NAME_RE = /^[\p{L}]+(?:[-'][\p{L}]+)*$/u;

export function validateEmail(value: string): ValidationResult {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return { valid: false, message: 'Email is required.' };
  if (!EMAIL_RE.test(normalized)) return { valid: false, message: 'Enter a valid email.' };
  return { valid: true };
}

export function validatePassword(value: string): ValidationResult {
  if (!value) return { valid: false, message: 'Password is required.' };
  if (value.length < 6) return { valid: false, message: 'Use at least 6 characters.' };
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
