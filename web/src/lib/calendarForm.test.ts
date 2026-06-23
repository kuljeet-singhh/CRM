import { describe, expect, it } from 'vitest';
import {
  defaultCreateFormState,
  parseAttendeesText,
  validateMeetingForm,
  type MeetingFormState,
} from './calendarForm';

function validForm(overrides: Partial<MeetingFormState> = {}): MeetingFormState {
  const start = new Date('2026-06-25T15:00:00.000Z');
  const end = new Date('2026-06-25T15:30:00.000Z');
  return {
    title: 'Call',
    attendeesText: 'jane@example.com',
    startDate: start,
    startTime: '15:00',
    endDate: end,
    endTime: '15:30',
    location: '',
    calendarId: 'primary',
    ...overrides,
  };
}

describe('validateMeetingForm', () => {
  it('requires title', () => {
    expect(validateMeetingForm(validForm({ title: '   ' }))).toBe('Title is required.');
  });

  it('requires end after start', () => {
    const start = new Date('2026-06-25T15:00:00.000Z');
    const end = new Date('2026-06-25T14:00:00.000Z');
    expect(
      validateMeetingForm(
        validForm({
          startDate: start,
          startTime: '15:00',
          endDate: end,
          endTime: '14:00',
        })
      )
    ).toBe('End must be after start.');
  });

  it('returns null for valid form', () => {
    expect(validateMeetingForm(validForm())).toBeNull();
  });
});

describe('parseAttendeesText', () => {
  it('dedupes and lowercases emails', () => {
    expect(
      parseAttendeesText('Jane@Example.com, jane@example.com; BOB@Example.com\nbob@example.com')
    ).toEqual(['jane@example.com', 'bob@example.com']);
  });
});

describe('defaultCreateFormState', () => {
  it('defaults title from contact name', () => {
    const form = defaultCreateFormState({ name: 'Jane Doe', email: 'jane@example.com' });
    expect(form.title).toBe('Meeting with Jane Doe');
    expect(form.attendeesText).toBe('jane@example.com');
  });
});
