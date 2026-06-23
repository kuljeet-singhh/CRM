const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const LINKEDIN_RE = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/gi;
const PHONE_RE =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3}[\s.-]?\d{3,4}(?:[\s.-]?\d{2,4})?/g;
const WEBSITE_RE = /(?:https?:\/\/|www\.)[^\s]+/gi;

const TITLE_KEYWORDS =
  /\b(ceo|cto|cfo|coo|vp|vice president|director|manager|engineer|developer|designer|consultant|analyst|specialist|coordinator|president|founder|partner|lead|head of|chief)\b/i;

export interface ParsedBusinessCard {
  name?: string;
  email?: string;
  company?: string;
  title?: string;
  linkedinUrl?: string;
  phone?: string;
  website?: string;
  rawText: string;
}

function normalizeLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function extractEmail(text: string): string | undefined {
  const match = text.match(EMAIL_RE);
  return match?.[0]?.toLowerCase();
}

function extractLinkedIn(text: string): string | undefined {
  const match = text.match(LINKEDIN_RE);
  if (!match?.[0]) return undefined;
  let href = match[0].trim();
  if (!/^https?:\/\//i.test(href)) {
    href = `https://${href}`;
  }
  try {
    const parsed = new URL(href);
    if (!parsed.hostname.toLowerCase().includes('linkedin.com')) return undefined;
    const path = parsed.pathname.replace(/\/+$/, '');
    return `https://${parsed.hostname.toLowerCase()}${path}`;
  } catch {
    return undefined;
  }
}

function extractPhone(text: string): string | undefined {
  const lines = normalizeLines(text);
  for (const line of lines) {
    if (EMAIL_RE.test(line) || LINKEDIN_RE.test(line)) continue;
    const matches = line.match(PHONE_RE);
    if (matches) {
      const digits = matches[0].replace(/\D/g, '');
      if (digits.length >= 7) return matches[0].trim();
    }
  }
  return undefined;
}

function extractWebsite(text: string): string | undefined {
  const lines = normalizeLines(text);
  for (const line of lines) {
    if (EMAIL_RE.test(line) || LINKEDIN_RE.test(line)) continue;
    const match = line.match(WEBSITE_RE);
    if (match && !match[0].toLowerCase().includes('linkedin.com')) {
      return match[0].trim();
    }
  }
  return undefined;
}

function isMetadataLine(line: string): boolean {
  return (
    EMAIL_RE.test(line) ||
    LINKEDIN_RE.test(line) ||
    PHONE_RE.test(line) ||
    WEBSITE_RE.test(line)
  );
}

function extractTitle(lines: string[]): string | undefined {
  for (const line of lines) {
    if (isMetadataLine(line)) continue;
    if (TITLE_KEYWORDS.test(line) && line.length <= 80) {
      return line;
    }
  }
  return undefined;
}

function extractName(lines: string[]): string | undefined {
  for (const line of lines.slice(0, 5)) {
    if (isMetadataLine(line)) continue;
    if (line.length < 2 || line.length > 60) continue;
    if (TITLE_KEYWORDS.test(line)) continue;
    if (/^\d/.test(line)) continue;
    const words = line.split(/\s+/);
    if (words.length >= 1 && words.length <= 5) {
      return line;
    }
  }
  return undefined;
}

function extractCompany(lines: string[], used: Set<string>): string | undefined {
  const candidates = lines.filter((line) => !used.has(line) && !isMetadataLine(line));
  if (candidates.length === 0) return undefined;

  const withoutTitle = candidates.filter((line) => !TITLE_KEYWORDS.test(line));
  const pool = withoutTitle.length > 0 ? withoutTitle : candidates;

  return pool.sort((a, b) => b.length - a.length)[0];
}

export function parseBusinessCard(ocrText: string): ParsedBusinessCard {
  const rawText = ocrText.trim();
  const lines = normalizeLines(rawText);

  const email = extractEmail(rawText);
  const linkedinUrl = extractLinkedIn(rawText);
  const phone = extractPhone(rawText);
  const website = extractWebsite(rawText);
  const title = extractTitle(lines);
  const name = extractName(lines);

  const used = new Set<string>();
  if (name) used.add(name);
  if (title) used.add(title);
  const company = extractCompany(lines, used);

  return {
    rawText,
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    ...(company ? { company } : {}),
    ...(title ? { title } : {}),
    ...(linkedinUrl ? { linkedinUrl } : {}),
    ...(phone ? { phone } : {}),
    ...(website ? { website } : {}),
  };
}
