import { describe, it, expect } from 'vitest';
import { buildMimeMessage, toBase64Url } from './mime.js';

describe('mime', () => {
  it('builds RFC 2822 message', () => {
    const raw = buildMimeMessage({
      from: 'me@test.com',
      to: ['them@test.com'],
      subject: 'Hello',
      body: 'World',
    });
    expect(raw).toContain('From: me@test.com');
    expect(raw).toContain('Subject: Hello');
    expect(raw).toContain('World');
  });

  it('encodes base64url', () => {
    const encoded = toBase64Url('test');
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
  });
});
