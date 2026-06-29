export function isPrismaConnectivityError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return code === 'P1001' || code === 'P1002' || code === 'P1017';
}

export function isPrismaTransientError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return isPrismaConnectivityError(err) || code === 'P2024';
}
