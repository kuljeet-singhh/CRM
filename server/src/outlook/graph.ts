export const OUTLOOK_MESSAGE_SELECT =
  'id,subject,bodyPreview,body,from,toRecipients,sentDateTime,receivedDateTime,conversationId';

export function isStaleDeltaStatus(status: number): boolean {
  return status === 410 || status === 400;
}

export async function readGraphErrorBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return '';
  }
}

export function logGraphFailure(context: string, status: number, body: string): void {
  console.error(`[outlook/${context}] Graph ${status}`, body || '(empty)');
}

export function initialDeltaUrl(folderId: string): string {
  return `https://graph.microsoft.com/v1.0/me/mailFolders/${folderId}/messages/delta?$top=50&$select=${OUTLOOK_MESSAGE_SELECT}`;
}
