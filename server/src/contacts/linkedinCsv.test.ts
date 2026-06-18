import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeLinkedInUrl, parseLinkedInConnectionsCsv } from './linkedinCsv.js';
import { importLinkedInCsv } from './linkedinImport.js';

const { upsertMock } = vi.hoisted(() => ({
  upsertMock: vi.fn(),
}));

vi.mock('./upsert.js', () => ({
  upsertContactFromLinkedInCsv: upsertMock,
}));

const SAMPLE_CSV = `Notes:
"When exporting your connection data"
First Name,Last Name,URL,Email Address,Company,Position,Connected On
Jane,Doe,https://www.linkedin.com/in/jane-doe,jane@acme.com,Acme Inc,VP Sales,01 Jan 2024
John,Smith,http://www.linkedin.com/in/john-smith,,Beta LLC,Engineer,02 Jan 2024
Bad,Row,not-a-url,,,,
`;

describe('normalizeLinkedInUrl', () => {
  it('normalizes http linkedin URLs', () => {
    expect(normalizeLinkedInUrl('http://www.linkedin.com/in/jane-doe/')).toBe(
      'http://www.linkedin.com/in/jane-doe'
    );
  });

  it('rejects non-linkedin hosts', () => {
    expect(normalizeLinkedInUrl('https://example.com/in/jane')).toBeNull();
  });
});

describe('parseLinkedInConnectionsCsv', () => {
  it('parses header after note lines and maps columns', () => {
    const rows = parseLinkedInConnectionsCsv(SAMPLE_CSV);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      name: 'Jane Doe',
      email: 'jane@acme.com',
      linkedinUrl: 'https://www.linkedin.com/in/jane-doe',
      company: 'Acme Inc',
      title: 'VP Sales',
    });
    expect(rows[1]?.email).toBeNull();
    expect(rows[1]?.linkedinUrl).toBe('http://www.linkedin.com/in/john-smith');
  });

  it('throws invalid_csv when no header', () => {
    expect(() => parseLinkedInConnectionsCsv('foo,bar\n1,2')).toThrow('invalid_csv');
  });
});

describe('importLinkedInCsv', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upsertMock
      .mockResolvedValueOnce({ contact: { id: '1' }, created: true, updated: false })
      .mockResolvedValueOnce({ contact: { id: '2' }, created: true, updated: false })
      .mockResolvedValueOnce({ skipped: 'invalid_url' });
  });

  it('aggregates import stats', async () => {
    const result = await importLinkedInCsv('ws1', SAMPLE_CSV);
    expect(result).toEqual({
      imported: 2,
      created: 2,
      updated: 0,
      skippedNoIdentifier: 0,
      skippedInvalidUrl: 1,
    });
    expect(upsertMock).toHaveBeenCalledTimes(3);
  });
});
