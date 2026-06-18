import { parseLinkedInConnectionsCsv } from './linkedinCsv.js';
import { upsertContactFromLinkedInCsv } from './upsert.js';

export type LinkedInImportResult = {
  imported: number;
  created: number;
  updated: number;
  skippedNoIdentifier: number;
  skippedInvalidUrl: number;
};

export async function importLinkedInCsv(
  workspaceId: string,
  csvText: string
): Promise<LinkedInImportResult> {
  const rows = parseLinkedInConnectionsCsv(csvText);

  let imported = 0;
  let created = 0;
  let updated = 0;
  let skippedNoIdentifier = 0;
  let skippedInvalidUrl = 0;

  for (const row of rows) {
    if (!row.email && !row.linkedinUrl && !row.linkedinUrlRaw) {
      skippedNoIdentifier++;
      continue;
    }

    const result = await upsertContactFromLinkedInCsv(workspaceId, row);

    if (result.skipped === 'no_identifier') {
      skippedNoIdentifier++;
      continue;
    }
    if (result.skipped === 'invalid_url') {
      skippedInvalidUrl++;
      continue;
    }

    if (!('contact' in result)) continue;

    imported++;
    if (result.created) created++;
    else if (result.updated) updated++;
  }

  return { imported, created, updated, skippedNoIdentifier, skippedInvalidUrl };
}
