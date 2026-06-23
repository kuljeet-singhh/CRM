import { useCallback, useEffect, useState } from 'react';
import { recognizeFile } from '@/lib/ocr/recognizeImage';
import { terminateOcrWorker } from '@/lib/ocr/tesseractWorker';

export type OcrStatus = 'idle' | 'loading' | 'ready' | 'error';

export function useOcr() {
  const [status, setStatus] = useState<OcrStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognize = useCallback(async (file: File) => {
    setStatus('loading');
    setError(null);
    setProgress(0);
    setProgressStatus('Initializing…');
    setText('');

    try {
      const result = await recognizeFile(file, (p) => {
        setProgress(Math.round(p.progress * 100));
        setProgressStatus(p.status);
      });
      setText(result);
      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OCR failed');
      setStatus('error');
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setProgress(0);
    setProgressStatus('');
    setText('');
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      void terminateOcrWorker();
    };
  }, []);

  return {
    status,
    progress,
    progressStatus,
    text,
    error,
    recognize,
    reset,
  };
}
