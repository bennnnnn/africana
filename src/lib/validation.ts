export type ValidationResult = {
  valid: boolean;
  message?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FIRST_NAME_RE = /^[A-Za-z]+(?:[-'][A-Za-z]+)*$/;
const LETTER_RE = /[A-Za-z]/;
const NUMBER_RE = /\d/;
const HEIGHT_RE = /^\d{2,3}$/;
const WORD_LIST_RE = /^[A-Za-z]+(?:[ -][A-Za-z]+)*(?:,\s*[A-Za-z]+(?:[ -][A-Za-z]+)*)*$/;
const TEXT_RE = /^[A-Za-z]+(?:[ -][A-Za-z]+)*$/;

export function validateEmail(value: string): ValidationResult {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return { valid: false, message: 'Email is required.' };
  if (!EMAIL_RE.test(normalized)) return { valid: false, message: 'Enter a valid email.' };
  return { valid: true };
}

export function validatePassword(value: string): ValidationResult {
  if (!value) return { valid: false, message: 'Password is required.' };
  if (value.length < 6) return { valid: false, message: 'Use at least 6 characters.' };
  if (!LETTER_RE.test(value)) return { valid: false, message: 'Add at least one letter.' };
  if (!NUMBER_RE.test(value)) return { valid: false, message: 'Add at least one number.' };
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

export function validateOptionalHeight(value: string): ValidationResult {
  const normalized = value.trim();
  if (!normalized) return { valid: true };
  if (!HEIGHT_RE.test(normalized)) return { valid: false, message: 'Use numbers only.' };
  const height = Number(normalized);
  if (height < 90 || height > 260) return { valid: false, message: 'Enter a realistic height.' };
  return { valid: true };
}

export function validateOptionalWordList(value: string, label: string): ValidationResult {
  const normalized = value.trim();
  if (!normalized) return { valid: true };
  if (!WORD_LIST_RE.test(normalized)) {
    return { valid: false, message: `${label} must use letters only.` };
  }
  return { valid: true };
}

export function validateOptionalText(value: string, label: string): ValidationResult {
  const normalized = value.trim();
  if (!normalized) return { valid: true };
  if (!TEXT_RE.test(normalized)) {
    return { valid: false, message: `${label} must use letters only.` };
  }
  return { valid: true };
}

export function getValidationState(
  visible: boolean,
  result: ValidationResult,
  hasValue: boolean
): 'default' | 'error' | 'success' {
  if (!visible) return 'default';
  if (!result.valid) return 'error';
  if (hasValue) return 'success';
  return 'default';
}
