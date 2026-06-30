import type { Response } from 'express';
import type { AuthedRequest } from '../auth/middleware.js';
import {
  isUpstashConfigured,
  readStreamOnce,
  subscribeLocal,
  type MessagesChangedPayload,
} from './messageBus.js';

const HEARTBEAT_MS = 25_000;
const STREAM_BLOCK_MS = 25_000;

function writeSseEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function writeSsePing(res: Response): void {
  res.write(': ping\n\n');
}

export function handleMessagesSse(req: AuthedRequest, res: Response): void {
  const workspaceId = req.workspaceId!;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  let closed = false;

  const onClose = () => {
    closed = true;
  };
  req.on('close', onClose);

  const pushPayload = (payload: MessagesChangedPayload) => {
    if (closed) return;
    writeSseEvent(res, 'messages_updated', payload);
  };

  const pingInterval = setInterval(() => {
    if (closed) return;
    writeSsePing(res);
  }, HEARTBEAT_MS);

  const unsubLocal = isUpstashConfigured()
    ? () => {}
    : subscribeLocal(workspaceId, pushPayload);

  const streamLoop = async () => {
    let lastId = '$';
    while (!closed) {
      try {
        const item = await readStreamOnce(workspaceId, lastId, STREAM_BLOCK_MS);
        if (closed) break;
        if (item) {
          lastId = item.id;
          pushPayload(item.payload);
        } else {
          writeSsePing(res);
        }
      } catch (err) {
        if (closed) break;
        console.error('[sse] stream read error', err);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  };

  if (isUpstashConfigured()) {
    void streamLoop();
  }

  writeSsePing(res);

  req.on('close', () => {
    clearInterval(pingInterval);
    unsubLocal();
  });
}
