import { EventEmitter } from 'events';
import { Redis } from '@upstash/redis';
import { env } from '../env.js';

export type MessagesChangedMeta = {
  added?: number;
  updated?: number;
  removed?: number;
};

export type MessagesChangedPayload = MessagesChangedMeta & {
  workspaceId: string;
  at: string;
};

const STREAM_MAX_LEN = 100;
const localBus = new EventEmitter();
localBus.setMaxListeners(200);

let redisClient: Redis | null = null;

export function isUpstashConfigured(): boolean {
  return Boolean(env.upstashRedisRestUrl && env.upstashRedisRestToken);
}

/** SSE + publish bus available (Upstash in prod, in-memory on local dev). */
export function isMessageEventsEnabled(): boolean {
  if (isUpstashConfigured()) return true;
  return !env.isProd;
}

function streamKey(workspaceId: string): string {
  return `messages-stream:${workspaceId}`;
}

function getRedis(): Redis | null {
  if (!isUpstashConfigured()) return null;
  if (!redisClient) {
    redisClient = new Redis({
      url: env.upstashRedisRestUrl,
      token: env.upstashRedisRestToken,
    });
  }
  return redisClient;
}

function parseStreamPayload(fields: Record<string, unknown>): MessagesChangedPayload | null {
  const raw = fields.data;
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw) as MessagesChangedPayload;
  } catch {
    return null;
  }
}

export async function publishMessagesChanged(
  workspaceId: string,
  meta?: MessagesChangedMeta
): Promise<void> {
  const payload: MessagesChangedPayload = {
    workspaceId,
    at: new Date().toISOString(),
    ...meta,
  };
  const json = JSON.stringify(payload);

  const redis = getRedis();
  if (redis) {
    await redis.xadd(streamKey(workspaceId), '*', { data: json });
    await redis.xtrim(streamKey(workspaceId), {
      strategy: 'MAXLEN',
      threshold: STREAM_MAX_LEN,
      exactness: '~',
    });
  } else if (env.isProd) {
    console.warn('[message-bus] Upstash not configured; SSE unavailable in production');
  } else {
    localBus.emit(workspaceId, payload);
  }
}

export type MessagesChangedListener = (payload: MessagesChangedPayload) => void;

export function subscribeLocal(
  workspaceId: string,
  listener: MessagesChangedListener
): () => void {
  const handler = (payload: MessagesChangedPayload) => listener(payload);
  localBus.on(workspaceId, handler);
  return () => localBus.off(workspaceId, handler);
}

export async function readStreamOnce(
  workspaceId: string,
  lastId: string,
  blockMs: number
): Promise<{ id: string; payload: MessagesChangedPayload } | null> {
  const redis = getRedis();
  if (!redis) return null;

  const result = await redis.xread(streamKey(workspaceId), lastId, {
    count: 1,
    blockMS: blockMs,
  });

  if (!result || !Array.isArray(result) || result.length === 0) return null;

  const streamBlock = result[0];
  if (!Array.isArray(streamBlock) || streamBlock.length < 2) return null;

  const messages = streamBlock[1];
  if (!Array.isArray(messages) || messages.length === 0) return null;

  const first = messages[0];
  if (!Array.isArray(first) || first.length < 2) return null;

  const id = String(first[0]);
  const fieldsRaw = first[1];

  let fields: Record<string, unknown>;
  if (Array.isArray(fieldsRaw)) {
    fields = {};
    for (let i = 0; i < fieldsRaw.length; i += 2) {
      const key = fieldsRaw[i];
      const value = fieldsRaw[i + 1];
      if (typeof key === 'string') fields[key] = value;
    }
  } else if (fieldsRaw && typeof fieldsRaw === 'object') {
    fields = fieldsRaw as Record<string, unknown>;
  } else {
    return null;
  }

  const payload = parseStreamPayload(fields);
  if (!payload) return null;

  return { id, payload };
}
