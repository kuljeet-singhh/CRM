import { describe, it, expect } from 'vitest';
import { resolveGmailWatchLabelIds } from './watchManager.js';

describe('resolveGmailWatchLabelIds', () => {
  it('includes INBOX alongside CRM label', () => {
    expect(
      resolveGmailWatchLabelIds(
        [
          { id: 'crm-label', name: 'CRM1' },
          { id: 'INBOX', name: 'INBOX' },
        ],
        'crm-label'
      )
    ).toEqual(['crm-label', 'INBOX']);
  });

  it('returns only CRM label when INBOX is missing', () => {
    expect(resolveGmailWatchLabelIds([{ id: 'crm-label', name: 'CRM1' }], 'crm-label')).toEqual([
      'crm-label',
    ]);
  });

  it('dedupes when CRM label id is INBOX', () => {
    expect(resolveGmailWatchLabelIds([{ id: 'INBOX', name: 'INBOX' }], 'INBOX')).toEqual(['INBOX']);
  });
});
