import { api } from './api';
import type { AuthProvider, MailProvider } from '@/types';

export type OAuthMode = 'login' | 'connect';

export function connectPath(
  provider: MailProvider | AuthProvider,
  options?: { mode?: OAuthMode; returnTo?: string }
): string {
  const mode = options?.mode ?? 'login';
  const base = provider === 'gmail' ? '/auth/google' : '/auth/microsoft';
  const params = new URLSearchParams({ mode });
  if (options?.returnTo) params.set('returnTo', options.returnTo);
  return `${base}?${params.toString()}`;
}

export async function initiateConnect(
  provider: MailProvider,
  returnTo = '/settings'
): Promise<void> {
  const { url } = await api<{ url: string }>('/auth/connect/init', {
    method: 'POST',
    body: JSON.stringify({ provider, returnTo }),
  });
  window.location.href = url;
}

export function mailApiBase(provider: MailProvider): string {
  return provider === 'gmail' ? '/api/gmail' : '/api/outlook';
}
