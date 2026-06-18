import { describe, it, expect } from 'vitest';
import { parseEmailAddress, parseAddressList } from './parser.js';

describe('parser', () => {
  it('parses angle-bracket address', () => {
    expect(parseEmailAddress('John <john@example.com>')).toEqual({
      email: 'john@example.com',
      name: 'John',
    });
  });

  it('parses address list', () => {
    const list = parseAddressList('a@test.com, B <b@test.com>');
    expect(list).toHaveLength(2);
    expect(list[0]?.email).toBe('a@test.com');
  });
});
