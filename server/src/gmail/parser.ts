export function parseHeaders(headers: { name?: string | null; value?: string | null }[]) {
  const map = new Map<string, string>();
  for (const h of headers) {
    if (h.name && h.value) map.set(h.name.toLowerCase(), h.value);
  }
  return {
    subject: map.get('subject') ?? '',
    from: map.get('from') ?? '',
    to: map.get('to') ?? '',
    cc: map.get('cc') ?? '',
    messageId: map.get('message-id') ?? '',
    date: map.get('date') ?? '',
  };
}

export function parseEmailAddress(raw: string): { email: string; name?: string } {
  const match = raw.match(/<([^>]+)>/);
  if (match) {
    const name = raw.replace(/<[^>]+>/, '').trim().replace(/^"|"$/g, '');
    return { email: match[1]!.toLowerCase(), name: name || undefined };
  }
  return { email: raw.trim().toLowerCase() };
}

export function parseAddressList(raw: string): { email: string; name?: string }[] {
  if (!raw) return [];
  return raw.split(',').map((p) => parseEmailAddress(p.trim())).filter((p) => p.email);
}
