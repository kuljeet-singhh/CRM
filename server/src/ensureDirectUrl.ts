function deriveDirectUrl(databaseUrl: string): string {
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

if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = deriveDirectUrl(process.env.DATABASE_URL);
}
