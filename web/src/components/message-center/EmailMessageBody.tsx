import { resolveEmailDisplay } from '@/lib/emailBody';

interface EmailMessageBodyProps {
  bodyText?: string | null;
  bodyHtml?: string | null;
  preview?: string;
}

export function EmailMessageBody({ bodyText, bodyHtml, preview }: EmailMessageBodyProps) {
  const { html, plain } = resolveEmailDisplay({ bodyText, bodyHtml, preview });

  if (html) {
    return (
      <div
        className="prose prose-sm dark:prose-invert max-w-none break-words email-body-html"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return <div className="whitespace-pre-wrap text-foreground">{plain}</div>;
}
