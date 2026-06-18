export function accessTokenNeedsRefresh(token: string, bufferMs = 30_000): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]!)) as { exp?: number };
    return !payload.exp || payload.exp * 1000 <= Date.now() + bufferMs;
  } catch {
    return true;
  }
}
