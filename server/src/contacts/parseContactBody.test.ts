import { describe, expect, it } from 'vitest';
import { toCreateContactBody, validateCreateContactBody } from './parseContactBody.js';

describe('validateCreateContactBody', () => {
  it('accepts email only', () => {
    expect(validateCreateContactBody({ email: 'jane@acme.com' })).toBeNull();
  });

  it('accepts linkedinUrl only', () => {
    expect(
      validateCreateContactBody({ linkedinUrl: 'https://www.linkedin.com/in/jane' })
    ).toBeNull();
  });

  it('rejects when no identifier', () => {
    expect(validateCreateContactBody({ name: 'Jane' })).toBe('missing_identifier');
  });

  it('rejects invalid body types', () => {
    expect(validateCreateContactBody(null)).toBe('invalid_body');
    expect(validateCreateContactBody({ email: 123 })).toBe('invalid_body');
  });
});

describe('toCreateContactBody', () => {
  it('normalizes and trims fields', () => {
    const body = toCreateContactBody({
      name: '  Jane Doe ',
      email: ' Jane@Acme.COM ',
      company: ' Acme ',
      title: ' VP ',
      linkedinUrl: ' https://linkedin.com/in/jane ',
    });

    expect(body).toEqual({
      name: 'Jane Doe',
      email: 'jane@acme.com',
      company: 'Acme',
      title: 'VP',
      linkedinUrl: 'https://linkedin.com/in/jane',
    });
  });
});
