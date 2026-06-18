export async function checkApiReachable(): Promise<boolean> {
  try {
    const res = await fetch('/api/health/live', { credentials: 'omit' });
    return res.ok;
  } catch {
    return false;
  }
}
