export function buildMimeMessage(params: {
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const lines: string[] = [
    `From: ${params.from}`,
    `To: ${params.to.join(', ')}`,
  ];
  if (params.cc?.length) lines.push(`Cc: ${params.cc.join(', ')}`);
  lines.push(`Subject: ${params.subject}`);
  if (params.inReplyTo) lines.push(`In-Reply-To: ${params.inReplyTo}`);
  if (params.references) lines.push(`References: ${params.references}`);
  lines.push('MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', '', params.body);
  return lines.join('\r\n');
}

export function toBase64Url(raw: string): string {
  return Buffer.from(raw)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
