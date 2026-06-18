export type MailFolder = { id: string; displayName: string };

export async function listOutlookMailFolders(token: string): Promise<MailFolder[]> {
  const res = await fetch('https://graph.microsoft.com/v1.0/me/mailFolders?$top=100', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('folders_list_failed');
  const data = (await res.json()) as { value: MailFolder[] };
  return data.value ?? [];
}

export function findFolderByDisplayName(folders: MailFolder[], displayName: string): MailFolder | undefined {
  return folders.find((f) => f.displayName === displayName);
}
