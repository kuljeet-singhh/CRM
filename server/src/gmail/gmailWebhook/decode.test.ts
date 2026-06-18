import { describe, it, expect } from 'vitest';
import { decodeGmailPushData } from './decode.js';

describe('decodeGmailPushData', () => {
  it('decodes email and string historyId', () => {
    const payload = Buffer.from(
      JSON.stringify({ emailAddress: 'user@gmail.com', historyId: '12345' }),
      'utf8'
    ).toString('base64');

    expect(decodeGmailPushData(payload)).toEqual({
      emailAddress: 'user@gmail.com',
      historyId: '12345',
    });
  });

  it('normalizes numeric historyId', () => {
    const payload = Buffer.from(
      JSON.stringify({ emailAddress: 'user@gmail.com', historyId: 99999 }),
      'utf8'
    ).toString('base64');

    expect(decodeGmailPushData(payload).historyId).toBe('99999');
  });

  it('throws on missing email', () => {
    const payload = Buffer.from(JSON.stringify({ historyId: '1' }), 'utf8').toString('base64');
    expect(() => decodeGmailPushData(payload)).toThrow('invalid_email_address');
  });
});
