import { describe, expect, it } from 'vitest';
import { formatTranscript } from './formatTranscript';

describe('formatTranscript', () => {
  it('collapses whitespace and trims', () => {
    expect(formatTranscript('  hello   world  ')).toBe('hello world');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(formatTranscript('   \n\n   ')).toBe('');
  });
});
