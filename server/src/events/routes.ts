import { Router } from 'express';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { isMessageEventsEnabled } from './messageBus.js';
import { handleMessagesSse } from './sse.js';

export const eventsRouter = Router();

eventsRouter.use(requireAuth);

eventsRouter.get('/messages', (req: AuthedRequest, res) => {
  if (!isMessageEventsEnabled()) {
    res.status(503).json({ error: 'events_not_configured' });
    return;
  }
  handleMessagesSse(req, res);
});
