export const MAX_NAME_LENGTH = 100;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_PASSWORD_LENGTH = 128;
export const NIGERIAN_PHONE_DIGITS = 10;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return value.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(value);
}

/**
 * Converts common Nigerian phone-number representations to the ten local
 * digits that follow +234. Formatting characters are deliberately accepted
 * for paste support; letters and other characters are not.
 */
export function normalizeNigerianPhoneInput(value: string): { digits: string; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) return { digits: '' };

  if (/[^\d\s+()\-]/.test(trimmed)) {
    return { digits: '', error: 'Phone numbers can only contain digits, spaces, hyphens, or brackets.' };
  }

  const compact = trimmed.replace(/[\s()\-]/g, '');
  let digits: string;

  if (compact.startsWith('+234')) {
    digits = compact.slice(4);
  } else if (compact.startsWith('234') && compact.length >= 13) {
    digits = compact.slice(3);
  } else if (compact.startsWith('0') && compact.length >= 11) {
    digits = compact.slice(1);
  } else {
    digits = compact;
  }

  if (!/^\d*$/.test(digits)) {
    return { digits: '', error: 'Enter a valid Nigerian phone number.' };
  }

  return { digits: digits.slice(0, NIGERIAN_PHONE_DIGITS) };
}

export function toNigerianE164(digits: string): string {
  return `+234${digits}`;
}
