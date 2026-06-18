export function deriveDirectUrl(databaseUrl) {
  const parsed = new URL(databaseUrl);
  const isSupabasePooler =
    parsed.port === '6543' || parsed.hostname.includes('pooler.supabase.com');

  if (!isSupabasePooler) {
    return databaseUrl;
  }

  parsed.port = '5432';
  parsed.searchParams.delete('pgbouncer');
  parsed.searchParams.delete('connection_limit');
  return parsed.toString();
}

export function ensureDirectUrl() {
  if (process.env.DIRECT_URL) {
    return;
  }

  if (!process.env.DATABASE_URL) {
    return;
  }

  process.env.DIRECT_URL = deriveDirectUrl(process.env.DATABASE_URL);
  console.log('[prisma] DIRECT_URL derived from DATABASE_URL (Supabase session pooler).');
}
