import { execSync } from 'node:child_process';
import { ensureDirectUrl } from './ensure-direct-url.mjs';

ensureDirectUrl();

if (!process.env.DIRECT_URL) {
  console.error('[vercel-build] DIRECT_URL is required. Set it on Vercel or provide DATABASE_URL.');
  process.exit(1);
}

const env = { ...process.env };

for (const cmd of ['npx prisma generate', 'npx prisma migrate deploy', 'npm run build']) {
  execSync(cmd, { stdio: 'inherit', env });
}
