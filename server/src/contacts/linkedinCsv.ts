export type LinkedInCsvRow = {
  firstName: string;
  lastName: string;
  name: string;
  linkedinUrl: string | null;
  linkedinUrlRaw: string | null;
  email: string | null;
  company: string | null;
  title: string | null;
};

export function normalizeLinkedInUrl(raw: string | undefined | null): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  try {
    let href = trimmed;
    if (!/^https?:\/\//i.test(href)) {
      href = `https://${href}`;
    }
    const parsed = new URL(href);
    if (!parsed.hostname.toLowerCase().includes('linkedin.com')) {
      return null;
    }
    parsed.hostname = parsed.hostname.toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.protocol}//${parsed.hostname}${path}`;
  } catch {
    return null;
  }
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

type ColumnKey = 'firstName' | 'lastName' | 'linkedinUrl' | 'email' | 'company' | 'title';

function mapHeader(header: string): ColumnKey | null {
  const h = normalizeHeader(header);
  if (h === 'first name') return 'firstName';
  if (h === 'last name') return 'lastName';
  if (h === 'url' || h === 'profile url') return 'linkedinUrl';
  if (h === 'email address' || h === 'email') return 'email';
  if (h === 'company') return 'company';
  if (h === 'position' || h === 'title') return 'title';
  return null;
}

function isHeaderRow(cells: string[]): boolean {
  const normalized = cells.map(normalizeHeader);
  const hasFirst = normalized.includes('first name');
  const hasUrl = normalized.includes('url') || normalized.includes('profile url');
  return hasFirst && hasUrl;
}

function buildColumnIndex(headers: string[]): Partial<Record<ColumnKey, number>> {
  const index: Partial<Record<ColumnKey, number>> = {};
  headers.forEach((header, i) => {
    const key = mapHeader(header);
    if (key !== null) index[key] = i;
  });
  return index;
}

function cellValue(cells: string[], idx: number | undefined): string {
  if (idx === undefined) return '';
  return (cells[idx] ?? '').trim();
}

export function parseLinkedInConnectionsCsv(text: string): LinkedInCsvRow[] {
  const cleaned = stripBom(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleaned.split('\n').filter((line) => line.trim().length > 0);

  let headerIndex = -1;
  let columnIndex: Partial<Record<ColumnKey, number>> = {};

  for (let i = 0; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]!);
    if (isHeaderRow(cells)) {
      headerIndex = i;
      columnIndex = buildColumnIndex(cells);
      break;
    }
  }

  if (headerIndex < 0) {
    throw new Error('invalid_csv');
  }

  const rows: LinkedInCsvRow[] = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]!);
    const firstName = cellValue(cells, columnIndex.firstName);
    const lastName = cellValue(cells, columnIndex.lastName);
    if (!firstName && !lastName) continue;

    const name = [firstName, lastName].filter(Boolean).join(' ').trim();
    const emailRaw = cellValue(cells, columnIndex.email);
    const email = emailRaw ? emailRaw.toLowerCase() : null;
    const linkedinUrlRaw = cellValue(cells, columnIndex.linkedinUrl) || null;
    const linkedinUrl = normalizeLinkedInUrl(linkedinUrlRaw);
    const company = cellValue(cells, columnIndex.company) || null;
    const title = cellValue(cells, columnIndex.title) || null;

    rows.push({
      firstName,
      lastName,
      name,
      linkedinUrl,
      linkedinUrlRaw,
      email,
      company,
      title,
    });
  }

  return rows;
}
