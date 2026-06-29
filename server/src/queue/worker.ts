import type { SyncJob } from '@prisma/client';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { isPrismaTransientError } from '../prismaErrors.js';
import { handleLabelSync } from './handlers/labelSync.js';
import { handleThreadSync } from './handlers/threadSync.js';

const STUCK_MS = 60_000;
const DB_BACKOFF_MS = 30_000;

function backoffMs(attempts: number): number {
  return Math.min(60_000, 1000 * Math.pow(2, attempts));
}

async function recoverStuckJobs() {
  const cutoff = new Date(Date.now() - STUCK_MS);
  await prisma.syncJob.updateMany({
    where: { status: 'processing', updatedAt: { lt: cutoff } },
    data: { status: 'pending' },
  });
}

async function claimJobs(): Promise<SyncJob[]> {
  const pending = await prisma.syncJob.findMany({
    where: { status: 'pending', runAt: { lte: new Date() } },
    orderBy: { runAt: 'asc' },
    take: env.syncWorkerBatchSize,
  });
  if (pending.length === 0) return [];

  await prisma.syncJob.updateMany({
    where: { id: { in: pending.map((j) => j.id) } },
    data: { status: 'processing' },
  });

  return pending;
}

async function processJob(job: SyncJob) {
  const payload = job.payload as Record<string, string>;

  if (job.type === 'label_sync') {
    await handleLabelSync({
      userId: payload.userId!,
      workspaceId: payload.workspaceId!,
      labelId: payload.labelId!,
      historyId: payload.historyId,
    });
  } else if (job.type === 'thread_sync') {
    await handleThreadSync({
      userId: payload.userId!,
      workspaceId: payload.workspaceId!,
      messageId: payload.messageId!,
      labelId: payload.labelId,
    });
  }
}

export async function pollOnce() {
  await recoverStuckJobs();
  const jobs = await claimJobs();

  for (const job of jobs) {
    try {
      await processJob(job);
      await prisma.syncJob.update({
        where: { id: job.id },
        data: { status: 'done', lastError: null },
      });
    } catch (err) {
      if (isPrismaTransientError(err)) {
        throw err;
      }
      const attempts = job.attempts + 1;
      const message = err instanceof Error ? err.message : String(err);

      if (attempts >= job.maxAttempts) {
        await prisma.syncJob.update({
          where: { id: job.id },
          data: { status: 'failed', attempts, lastError: message },
        });
      } else {
        await prisma.syncJob.update({
          where: { id: job.id },
          data: {
            status: 'pending',
            attempts,
            lastError: message,
            runAt: new Date(Date.now() + backoffMs(attempts)),
          },
        });
      }
    }
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;
let polling = false;
let dbBackoffUntil = 0;
let lastDbWarnAt = 0;

function schedulePoll() {
  if (polling) return;
  if (Date.now() < dbBackoffUntil) return;
  polling = true;
  pollOnce()
    .then(() => {
      dbBackoffUntil = 0;
    })
    .catch((err) => {
      if (isPrismaTransientError(err)) {
        dbBackoffUntil = Date.now() + DB_BACKOFF_MS;
        const now = Date.now();
        if (now - lastDbWarnAt >= DB_BACKOFF_MS) {
          lastDbWarnAt = now;
          console.warn(`[worker] database unavailable, backing off ${DB_BACKOFF_MS / 1000}s`);
        }
        return;
      }
      console.error('[worker]', err);
    })
    .finally(() => {
      polling = false;
    });
}

export function startWorker() {
  if (intervalId) return;
  intervalId = setInterval(schedulePoll, env.syncWorkerPollMs);
  schedulePoll();
}

export function stopWorker() {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
}
