import { describe, expect, it } from 'vitest';
import { eventMatchesContactEmail } from './contactFilter.js';
import { normalizeEmail } from './types.js';

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Jane@Example.COM ')).toBe('jane@example.com');
  });
});

describe('eventMatchesContactEmail', () => {
  it('matches organizer', () => {
    expect(eventMatchesContactEmail('jane@example.com', [], 'jane@example.com')).toBe(true);
  });

  it('matches attendee json', () => {
    expect(
      eventMatchesContactEmail(null, [{ email: 'bob@example.com' }], 'bob@example.com')
    ).toBe(true);
  });

  it('does not match unrelated', () => {
    expect(
      eventMatchesContactEmail('a@example.com', [{ email: 'b@example.com' }], 'c@example.com')
    ).toBe(false);
  });
});
