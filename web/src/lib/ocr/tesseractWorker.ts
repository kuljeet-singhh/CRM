import type { Worker } from 'tesseract.js';

export type OcrProgress = {
  status: string;
  progress: number;
};

const IDLE_MS = 5 * 60 * 1000;

let workerPromise: Promise<Worker> | null = null;
let workerRef: Worker | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let progressCallback: ((progress: OcrProgress) => void) | null = null;

export function setOcrProgressHandler(handler: ((progress: OcrProgress) => void) | null) {
  progressCallback = handler;
}

function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    void terminateOcrWorker();
  }, IDLE_MS);
}

export async function getOcrWorker(): Promise<Worker> {
  resetIdleTimer();

  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', undefined, {
        logger: (message) => {
          if (!progressCallback || !message.status) return;
          progressCallback({
            status: message.status,
            progress: message.progress ?? 0,
          });
        },
      });
      workerRef = worker;
      return worker;
    })();
  }

  return workerPromise;
}

export async function terminateOcrWorker(): Promise<void> {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  progressCallback = null;
  if (workerRef) {
    await workerRef.terminate();
    workerRef = null;
  }
  workerPromise = null;
}
