import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { encrypt } from '../auth/crypto.js';
import {
  ApolloAuthError,
  ApolloRateLimitError,
  verifyApolloKey,
} from './client.js';
import { syncApolloContacts } from './sync.js';

export const apolloRouter = Router();
apolloRouter.use(requireAuth);

apolloRouter.get('/status', async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  res.json({
    connected: Boolean(user?.apolloApiKey),
    lastSyncedAt: user?.apolloLastSyncedAt?.toISOString() ?? null,
  });
});

apolloRouter.put('/key', async (req: AuthedRequest, res) => {
  const { apiKey } = req.body as { apiKey?: string };
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    res.status(400).json({ error: 'missing_api_key' });
    return;
  }

  try {
    await verifyApolloKey(apiKey.trim());
  } catch (err) {
    if (err instanceof ApolloAuthError) {
      res.status(400).json({ error: 'invalid_api_key' });
      return;
    }
    console.error('[apollo/key]', err);
    res.status(500).json({ error: 'verify_failed' });
    return;
  }

  await prisma.user.update({
    where: { id: req.userId! },
    data: { apolloApiKey: encrypt(apiKey.trim()) },
  });

  res.json({ connected: true });
});

apolloRouter.delete('/key', async (req: AuthedRequest, res) => {
  await prisma.user.update({
    where: { id: req.userId! },
    data: { apolloApiKey: null },
  });
  res.json({ connected: false });
});

apolloRouter.post('/sync', async (req: AuthedRequest, res) => {
  try {
    const result = await syncApolloContacts(req.userId!, req.workspaceId!);
    res.json(result);
  } catch (err) {
    if ((err as Error).message === 'apollo_not_connected') {
      res.status(400).json({ error: 'apollo_not_connected' });
      return;
    }
    if (err instanceof ApolloAuthError) {
      res.status(401).json({ error: 'apollo_reauth_required' });
      return;
    }
    if (err instanceof ApolloRateLimitError) {
      res.status(429).json({ error: 'apollo_rate_limited' });
      return;
    }
    console.error('[apollo/sync]', err);
    res.status(500).json({ error: 'sync_failed' });
  }
});
