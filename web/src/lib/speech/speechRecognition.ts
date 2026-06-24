import { SPEECH_DEFAULT_LANG, SPEECH_INTERIM_RESULTS, SPEECH_MAX_SESSION_MS } from './constants';
import { createSpeechRecognition } from './browserSupport';

type ResultCallback = (final: string, interim: string) => void;
type ErrorCallback = (message: string) => void;
type EndCallback = () => void;

let recognition: SpeechRecognition | null = null;
let sessionTimer: ReturnType<typeof setTimeout> | null = null;
let onResult: ResultCallback | null = null;
let onError: ErrorCallback | null = null;
let onEnd: EndCallback | null = null;
let accumulatedFinal = '';

export function mapSpeechError(error: string): string {
  switch (error) {
    case 'not-allowed':
      return 'Microphone permission denied. Allow microphone access in your browser settings.';
    case 'no-speech':
      return 'No speech detected. Speak clearly and try again.';
    case 'network':
      return 'Speech service unreachable. Check your internet connection.';
    case 'aborted':
      return 'Dictation was stopped.';
    case 'audio-capture':
      return 'Microphone not available. Check your audio input device.';
    case 'service-not-allowed':
      return 'Speech recognition is not allowed in this browser context.';
    default:
      return 'Speech recognition failed. Please try again.';
  }
}

function clearSessionTimer() {
  if (sessionTimer) {
    clearTimeout(sessionTimer);
    sessionTimer = null;
  }
}

function handleResult(event: SpeechRecognitionEvent) {
  let interim = '';
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const result = event.results[i];
    const transcript = result[0]?.transcript ?? '';
    if (result.isFinal) {
      accumulatedFinal += transcript;
    } else {
      interim += transcript;
    }
  }
  onResult?.(accumulatedFinal, interim);
}

export function startRecognition(callbacks: {
  onResult: ResultCallback;
  onError: ErrorCallback;
  onEnd: EndCallback;
}): boolean {
  abortRecognition();

  const instance = createSpeechRecognition();
  if (!instance) return false;

  recognition = instance;
  onResult = callbacks.onResult;
  onError = callbacks.onError;
  onEnd = callbacks.onEnd;
  accumulatedFinal = '';

  instance.continuous = true;
  instance.interimResults = SPEECH_INTERIM_RESULTS;
  instance.lang = SPEECH_DEFAULT_LANG;

  instance.onresult = handleResult;
  instance.onerror = (event) => {
    if (event.error === 'aborted') return;
    onError?.(mapSpeechError(event.error));
  };
  instance.onend = () => {
    clearSessionTimer();
    onEnd?.();
  };

  try {
    instance.start();
    sessionTimer = setTimeout(() => {
      stopRecognition();
    }, SPEECH_MAX_SESSION_MS);
    return true;
  } catch {
    onError?.('Could not start speech recognition.');
    return false;
  }
}

export function stopRecognition() {
  clearSessionTimer();
  if (!recognition) return;
  try {
    recognition.stop();
  } catch {
    // ignore — may already be stopped
  }
}

export function abortRecognition() {
  clearSessionTimer();
  if (recognition) {
    try {
      recognition.abort();
    } catch {
      // ignore
    }
    recognition = null;
  }
  onResult = null;
  onError = null;
  onEnd = null;
  accumulatedFinal = '';
}
