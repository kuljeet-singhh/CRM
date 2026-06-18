export interface GmailPushNotification {
  emailAddress: string;
  historyId: string;
}

export function decodeGmailPushData(data: string): GmailPushNotification {
  const raw = JSON.parse(Buffer.from(data, 'base64').toString('utf8')) as {
    emailAddress?: string;
    historyId?: string | number;
  };

  if (!raw.emailAddress || typeof raw.emailAddress !== 'string') {
    throw new Error('invalid_email_address');
  }

  const historyId =
    raw.historyId === undefined || raw.historyId === null
      ? ''
      : String(raw.historyId);

  return { emailAddress: raw.emailAddress, historyId };
}
