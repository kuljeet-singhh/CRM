export function looksLikeHtmlContent(content: string): boolean {
  const trimmed = content.trim();
  return (
    /^<!DOCTYPE\s+html/i.test(trimmed) ||
    /^<html[\s>]/i.test(trimmed) ||
    /<body[\s>]/i.test(trimmed)
  );
}

export function htmlToPlainText(html: string): string {
  return html
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
}

function stripColorFromStyleAttr(styles: string): string {
  return styles
    .split(';')
    .map((part) => part.trim())
    .filter(
      (part) =>
        part && !/^(color|background|background-color)\s*:/i.test(part)
    )
    .join('; ');
}

function sanitizeInlineStyles(html: string): string {
  return html
    .replace(/\s+bgcolor=(["'])[^"']*\1/gi, '')
    .replace(/\s+bgcolor=[^\s>]+/gi, '')
    .replace(/style=(["'])([^"']*)\1/gi, (_match, quote: string, styles: string) => {
      const kept = stripColorFromStyleAttr(styles);
      return kept ? ` style=${quote}${kept}${quote}` : '';
    });
}

/** Minimal sanitization for CRM-rendered email HTML (no external deps). */
export function sanitizeEmailHtml(html: string): string {
  return sanitizeInlineStyles(
    html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/\s+on\w+="[^"]*"/gi, '')
      .replace(/\s+on\w+='[^']*'/gi, '')
  );
}

export function resolveEmailDisplay(params: {
  bodyText?: string | null;
  bodyHtml?: string | null;
  preview?: string;
}): { html: string | null; plain: string } {
  if (params.bodyHtml) {
    return {
      html: sanitizeEmailHtml(params.bodyHtml),
      plain: params.bodyText?.trim() || htmlToPlainText(params.bodyHtml),
    };
  }

  const text = params.bodyText?.trim() || params.preview?.trim() || '';
  if (text && looksLikeHtmlContent(text)) {
    return {
      html: sanitizeEmailHtml(text),
      plain: htmlToPlainText(text),
    };
  }

  return { html: null, plain: text || '(No content)' };
}
