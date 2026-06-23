export interface CreateContactBody {
  name?: string;
  email?: string;
  company?: string;
  title?: string;
  linkedinUrl?: string;
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function validateCreateContactBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') return 'invalid_body';

  const b = body as Record<string, unknown>;
  const fields = ['name', 'email', 'company', 'title', 'linkedinUrl'] as const;
  for (const key of fields) {
    if (b[key] !== undefined && typeof b[key] !== 'string') {
      return 'invalid_body';
    }
  }

  const email = optionalString(b.email);
  const linkedinUrl = optionalString(b.linkedinUrl);
  if (!email && !linkedinUrl) {
    return 'missing_identifier';
  }

  return null;
}

export function toCreateContactBody(body: unknown): CreateContactBody {
  const b = body as Record<string, unknown>;
  return {
    name: optionalString(b.name),
    email: optionalString(b.email)?.toLowerCase(),
    company: optionalString(b.company),
    title: optionalString(b.title),
    linkedinUrl: optionalString(b.linkedinUrl),
  };
}
