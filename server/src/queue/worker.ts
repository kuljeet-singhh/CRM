import type { SyncJob } from '@prisma/client';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { handleLabelSync } from './handlers/labelSync.js';
import { handleThreadSync } from './handlers/threadSync.js';

const STUCK_MS = 60_000;

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

export function startWorker() {
  if (intervalId) return;
  intervalId = setInterval(() => {
    pollOnce().catch((err) => console.error('[worker]', err));
  }, env.syncWorkerPollMs);
  pollOnce().catch((err) => console.error('[worker]', err));
}

export function stopWorker() {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
}
