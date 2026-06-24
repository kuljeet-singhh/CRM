import { useCallback, useEffect, useState } from 'react';
import { isSpeechRecognitionSupported } from '@/lib/speech/browserSupport';
import {
  abortRecognition,
  startRecognition,
  stopRecognition,
} from '@/lib/speech/speechRecognition';

export type SpeechStatus = 'idle' | 'listening' | 'ready' | 'error' | 'unsupported';

function initialStatus(): SpeechStatus {
  return isSpeechRecognitionSupported() ? 'idle' : 'unsupported';
}

export function useSpeechToText() {
  const [status, setStatus] = useState<SpeechStatus>(initialStatus);
  const [text, setText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(() => {
    if (!isSpeechRecognitionSupported()) {
      setStatus('unsupported');
      return;
    }

    setError(null);
    setText('');
    setInterimText('');
    setStatus('listening');

    const ok = startRecognition({
      onResult: (final, interim) => {
        setText(final);
        setInterimText(interim);
      },
      onError: (message) => {
        setError(message);
        setStatus('error');
      },
      onEnd: () => {
        setInterimText('');
        setStatus((prev) => (prev === 'listening' ? 'ready' : prev));
      },
    });

    if (!ok) {
      setStatus('unsupported');
    }
  }, []);

  const stop = useCallback(() => {
    stopRecognition();
    setInterimText('');
    setStatus('ready');
  }, []);

  const reset = useCallback(() => {
    abortRecognition();
    setText('');
    setInterimText('');
    setError(null);
    setStatus(initialStatus());
  }, []);

  useEffect(() => {
    return () => {
      abortRecognition();
    };
  }, []);

  return {
    status,
    text,
    interimText,
    error,
    start,
    stop,
    reset,
  };
}
