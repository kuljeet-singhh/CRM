import { describe, expect, it } from 'vitest';
import { formatOcrDisplayText } from './formatOcrText';

describe('formatOcrDisplayText', () => {
  it('normalizes line endings and trims trailing spaces', () => {
    const raw = 'Line one   \r\nLine two  \n\n\nLine three';
    expect(formatOcrDisplayText(raw)).toBe('Line one\nLine two\n\nLine three');
  });

  it('trims leading and trailing whitespace from whole text', () => {
    expect(formatOcrDisplayText('  hello world  ')).toBe('hello world');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(formatOcrDisplayText('   \n\n   ')).toBe('');
  });
});
