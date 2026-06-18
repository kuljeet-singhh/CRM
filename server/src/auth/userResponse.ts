import type { User } from '@prisma/client';

export type MailProvider = 'gmail' | 'outlook' | null;

export function deriveMailProvider(user: User): MailProvider {
  if (user.googleRefreshToken) return 'gmail';
  if (user.outlookRefreshToken) return 'outlook';
  return null;
}

export function toPublicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    authProvider: user.authProvider,
    mailProvider: deriveMailProvider(user),
    hasPassword: Boolean(user.passwordHash),
    createdAt: user.createdAt.toISOString(),
  };
}
