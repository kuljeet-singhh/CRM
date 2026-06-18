import { execSync } from 'node:child_process';
import { ensureDirectUrl } from './ensure-direct-url.mjs';

ensureDirectUrl();
execSync('npx prisma generate', { stdio: 'inherit', env: process.env });
