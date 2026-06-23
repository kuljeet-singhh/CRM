import { describe, expect, it } from 'vitest';
import { parseBusinessCard } from './parseBusinessCard';

describe('parseBusinessCard', () => {
  it('extracts email, name, title, and company from typical card text', () => {
    const text = `
Jane Doe
VP Sales
Acme Corporation
jane.doe@acme.com
+1 (555) 123-4567
www.acme.com
    `.trim();

    const result = parseBusinessCard(text);
    expect(result.email).toBe('jane.doe@acme.com');
    expect(result.name).toBe('Jane Doe');
    expect(result.title).toMatch(/VP Sales/i);
    expect(result.company).toBeTruthy();
    expect(result.phone).toBeTruthy();
    expect(result.website).toMatch(/acme/i);
  });

  it('extracts LinkedIn URL', () => {
    const text = `
John Smith
Engineer
linkedin.com/in/john-smith
john@example.com
    `.trim();

    const result = parseBusinessCard(text);
    expect(result.linkedinUrl).toBe('https://linkedin.com/in/john-smith');
    expect(result.email).toBe('john@example.com');
  });

  it('returns raw text always', () => {
    const text = 'Hello world';
    expect(parseBusinessCard(text).rawText).toBe(text);
  });

  it('handles empty input', () => {
    const result = parseBusinessCard('   ');
    expect(result.rawText).toBe('');
    expect(result.email).toBeUndefined();
  });
});
