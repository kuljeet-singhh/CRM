import '../src/ensureDirectUrl.js';
import express from 'express';
import { getGoogleWebhookConfigWarning } from '../src/gmail/gmailWebhook/auth.js';

function startupErrorApp(message: string): express.Application {
  const app = express();
  app.all('*', (_req, res) => {
    res.status(503).json({ error: 'startup_failed', message });
  });
  return app;
}

let app: express.Application;

try {
  const webhookWarning = getGoogleWebhookConfigWarning();
  if (webhookWarning) {
    console.warn(`[gmail-webhook] config: ${webhookWarning}`);
  }

  const { createApp } = await import('../src/app.js');
  app = createApp();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error('[api] startup failed:', err);
  app = startupErrorApp(message);
}

export default app;
