import { createApp } from './app.js';
import { startBackgroundJobs } from './backgroundJobs.js';
import { env } from './env.js';

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

const app = createApp();

app.listen(env.port, async () => {
  console.log(`Server listening on http://localhost:${env.port}`);
  await startBackgroundJobs();
});
