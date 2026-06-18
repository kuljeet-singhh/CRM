export function htmlToPlainText(html: string): string {
  let text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text;
}

export function looksLikeHtml(content: string): boolean {
  const trimmed = content.trim();
  return /^<!DOCTYPE\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed) || /<body[\s>]/i.test(trimmed);
}

export function parseOutlookBody(
  body?: { contentType?: string; content?: string },
  bodyPreview?: string
): { bodyText: string | undefined; bodyHtml: string | undefined } {
  const content = body?.content?.trim();
  if (!content) {
    return {
      bodyText: bodyPreview?.trim() || undefined,
      bodyHtml: undefined,
    };
  }

  const contentType = body?.contentType?.toLowerCase() ?? '';
  const isHtml = contentType === 'html' || looksLikeHtml(content);

  if (isHtml) {
    const plain = bodyPreview?.trim() || htmlToPlainText(content);
    return {
      bodyText: plain || undefined,
      bodyHtml: content,
    };
  }

  return {
    bodyText: content,
    bodyHtml: undefined,
  };
}
