import { describe, expect, it } from 'vitest';
import {
  validateCreateEventBody,
  validateUpdateEventBody,
  normalizeAttendeeEmails,
} from './types.js';

describe('validateCreateEventBody', () => {
  const valid = {
    calendarId: 'primary',
    title: 'Call',
    startsAt: '2026-06-25T15:00:00.000Z',
    endsAt: '2026-06-25T15:30:00.000Z',
    attendeeEmails: ['jane@example.com'],
  };

  it('accepts valid body', () => {
    expect(validateCreateEventBody(valid)).toBeNull();
  });

  it('rejects missing title', () => {
    expect(validateCreateEventBody({ ...valid, title: '' })).toBe('invalid_body');
  });

  it('rejects invalid dates', () => {
    expect(validateCreateEventBody({ ...valid, startsAt: 'bad' })).toBe('invalid_dates');
  });

  it('rejects endsAt before startsAt', () => {
    expect(
      validateCreateEventBody({
        ...valid,
        startsAt: '2026-06-25T16:00:00.000Z',
        endsAt: '2026-06-25T15:00:00.000Z',
      })
    ).toBe('invalid_dates');
  });
});

describe('validateUpdateEventBody', () => {
  it('requires at least one field', () => {
    expect(validateUpdateEventBody({})).toBe('invalid_body');
  });

  it('accepts title only', () => {
    expect(validateUpdateEventBody({ title: 'Updated' })).toBeNull();
  });

  it('rejects invalid date pair', () => {
    expect(
      validateUpdateEventBody({
        startsAt: '2026-06-25T16:00:00.000Z',
        endsAt: '2026-06-25T15:00:00.000Z',
      })
    ).toBe('invalid_dates');
  });
});

describe('normalizeAttendeeEmails', () => {
  it('dedupes and lowercases', () => {
    expect(normalizeAttendeeEmails(['A@x.com', 'a@x.com', ' B@x.com '])).toEqual([
      'a@x.com',
      'b@x.com',
    ]);
  });
});
