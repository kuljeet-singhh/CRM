import type { gmail_v1 } from 'googleapis';

export function extractBody(payload?: gmail_v1.Schema$MessagePart): { text?: string; html?: string } {
  if (!payload) return {};

  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return { text: decodeBase64Url(payload.body.data) };
  }
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return { html: decodeBase64Url(payload.body.data) };
  }

  let text: string | undefined;
  let html: string | undefined;
  for (const part of payload.parts ?? []) {
    const extracted = extractBody(part);
    text = text ?? extracted.text;
    html = html ?? extracted.html;
  }
  return { text, html };
}

function decodeBase64Url(data: string): string {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64').toString('utf8');
}
