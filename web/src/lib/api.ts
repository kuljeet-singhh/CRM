import { getAccessToken, setAccessToken } from './authStore';
import { accessTokenNeedsRefresh } from './tokenExpiry';

export class ApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const SKIP_BOOTSTRAP = new Set(['/auth/refresh', '/auth/login', '/auth/register', '/auth/logout']);

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch('/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) return null;
        const body = (await res.json()) as { accessToken: string };
        setAccessToken(body.accessToken);
        return body.accessToken;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export async function restoreSession(): Promise<boolean> {
  const token = getAccessToken();
  if (token && !accessTokenNeedsRefresh(token)) return true;
  const refreshed = await refreshAccessToken();
  return Boolean(refreshed);
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  if (retry && !SKIP_BOOTSTRAP.has(path)) {
    await restoreSession();
  }

  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (res.status === 401 && retry && path !== '/auth/refresh' && path !== '/auth/login') {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return api<T>(path, options, false);
    }
  }

  if (!res.ok) {
    let code = 'request_failed';
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string; detail?: string };
      code = body.error ?? code;
      message = body.detail ?? body.error ?? message;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, code, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
