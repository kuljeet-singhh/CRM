import bcrypt from 'bcryptjs';

const COST = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

export type PasswordChangeError = 'missing_fields' | 'weak_password' | 'same_password';

export function validatePasswordChangeInput(
  currentPassword: string | undefined,
  newPassword: string | undefined
): PasswordChangeError | null {
  if (!currentPassword || !newPassword) return 'missing_fields';
  if (!isValidPassword(newPassword)) return 'weak_password';
  if (newPassword === currentPassword) return 'same_password';
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
