import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { isSpeechRecognitionSupported } from './browserSupport';

describe('isSpeechRecognitionSupported', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {} as Window);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false when neither API is present', () => {
    expect(isSpeechRecognitionSupported()).toBe(false);
  });

  it('returns true when SpeechRecognition is present', () => {
    window.SpeechRecognition = function MockSpeechRecognition() {} as unknown as typeof SpeechRecognition;
    expect(isSpeechRecognitionSupported()).toBe(true);
  });

  it('returns true when webkitSpeechRecognition is present', () => {
    window.webkitSpeechRecognition = function MockWebkitSpeechRecognition() {} as unknown as typeof SpeechRecognition;
    expect(isSpeechRecognitionSupported()).toBe(true);
  });
});
