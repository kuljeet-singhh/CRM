# Supabase PostgreSQL

FlyCRM uses **Prisma** against Supabase Postgres. No Supabase JS SDK or API keys are required.

## Connection strings

From Supabase → **Project Settings** → **Database** → **Connection string**:

| Env var | Supabase mode | Port |
|---------|---------------|------|
| `DATABASE_URL` | **Transaction** pooler | 6543 |
| `DIRECT_URL` | **Session** pooler (or direct `db.[ref].supabase.co`) | 5432 |

Example (replace `[PASSWORD]`; URL-encode special chars e.g. `@` → `%40`, `$` → `%24`):

```env
DATABASE_URL=postgresql://postgres.qvauaicrvutnnqgmxokq:[PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://postgres.qvauaicrvutnnqgmxokq:[PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```

Set these in root `.env` (local) and on the **Vercel API project** (production).

### `connection_limit`

Append `connection_limit=1` to `DATABASE_URL` for **Vercel serverless** (one Prisma connection per function instance). Keep this on production.

For **local** long-running Express you may use `connection_limit=5` if needed, but the app should work with `1` after query batching fixes — avoid parallel `Promise.all` over many Prisma calls on a single client.

## First-time setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL` + `DIRECT_URL` with your Supabase password (URL-encoded).
2. Run migrations:

```bash
cd server
npm run prisma:deploy
npm run prisma:generate
```

3. Confirm tables in Supabase → **Table Editor** (`User`, `Contact`, `RefreshToken`, etc.).
4. Restart the API: `npm run dev:server` or `npm run dev:all`.

## Vercel

On the API project, set `DATABASE_URL`, `DIRECT_URL`, and `NODE_ENV=production`.

Build command:

```bash
npx prisma generate && npx prisma migrate deploy && npm run build
```
