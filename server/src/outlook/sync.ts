import { prisma } from '../db.js';
import { getOutlookAccessToken } from '../auth/tokens.js';
import {
  importOutlookConversationForCrm,
  listFolderMessages,
  upsertFolderMessages,
  upsertOutlookGraphMessage,
  type OutlookGraphMessage,
  type UpsertOutcome,
} from './conversation.js';
import {
  initialDeltaUrl,
  isStaleDeltaStatus,
  logGraphFailure,
  readGraphErrorBody,
} from './graph.js';

export type OutlookSyncResult = {
  messagesAdded: number;
  messagesUpdated?: number;
  error?: string;
  notice?: 'delta_reset';
};

function isDeltaRemovedMessage(msg: OutlookGraphMessage & { '@odata.type'?: string }): boolean {
  const type = msg['@odata.type'];
  return typeof type === 'string' && type.includes('messageDeleted');
}

function tally(
  totals: { messagesAdded: number; messagesUpdated: number },
  outcome: UpsertOutcome
) {
  if (outcome === 'added') totals.messagesAdded++;
  else if (outcome === 'updated') totals.messagesUpdated++;
}

async function runDeltaSync(params: {
  token: string;
  folderId: string;
  userId: string;
  workspaceId: string;
  userEmail: string;
  storedDeltaUrl: string | null;
  conversationIds: Set<string>;
  totals: { messagesAdded: number; messagesUpdated: number };
}): Promise<{ deltaReset: boolean; deltaConversationIds: Set<string> }> {
  let deltaReset = false;
  const deltaConversationIds = new Set<string>();
  let startUrl: string | null = params.storedDeltaUrl ?? initialDeltaUrl(params.folderId);

  for (let attempt = 0; attempt < 2; attempt++) {
    let nextLink: string | null = startUrl;

    while (nextLink) {
      const res = await fetch(nextLink, {
        headers: { Authorization: `Bearer ${params.token}` },
      });

      if (!res.ok) {
        const body = await readGraphErrorBody(res);
        if (attempt === 0 && isStaleDeltaStatus(res.status)) {
          logGraphFailure('sync/delta', res.status, body);
          await prisma.user.update({
            where: { id: params.userId },
            data: { outlookLastDeltaToken: null },
          });
          startUrl = initialDeltaUrl(params.folderId);
          deltaReset = true;
          break;
        }
        logGraphFailure('sync/delta', res.status, body);
        throw new Error('sync_failed');
      }

      const data = (await res.json()) as {
        value: (OutlookGraphMessage & { '@odata.type'?: string })[];
        '@odata.nextLink'?: string;
        '@odata.deltaLink'?: string;
      };

      for (const msg of data.value ?? []) {
        if (isDeltaRemovedMessage(msg)) continue;
        if (msg.conversationId) {
          params.conversationIds.add(msg.conversationId);
          deltaConversationIds.add(msg.conversationId);
        }
        if (msg.id) {
          tally(
            params.totals,
            await upsertOutlookGraphMessage({
              workspaceId: params.workspaceId,
              userEmail: params.userEmail,
              msg,
            })
          );
        }
      }

      nextLink = data['@odata.nextLink'] ?? null;
      if (data['@odata.deltaLink']) {
        await prisma.user.update({
          where: { id: params.userId },
          data: { outlookLastDeltaToken: data['@odata.deltaLink'] },
        });
      }
      if (!nextLink) break;
    }

    if (!deltaReset || attempt === 1) {
      return { deltaReset, deltaConversationIds };
    }
  }

  return { deltaReset, deltaConversationIds };
}

export async function manualOutlookSync(
  userId: string,
  workspaceId: string
): Promise<OutlookSyncResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.outlookSyncFolder) {
    return { messagesAdded: 0, messagesUpdated: 0, error: 'no_sync_folder' };
  }

  const token = await getOutlookAccessToken(userId);
  const foldersRes = await fetch('https://graph.microsoft.com/v1.0/me/mailFolders?$top=100', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!foldersRes.ok) throw new Error('reauth_required');

  const folders = (await foldersRes.json()) as {
    value: { id: string; displayName: string }[];
  };
  const folder = folders.value?.find((f) => f.displayName === user.outlookSyncFolder);
  if (!folder) return { messagesAdded: 0, messagesUpdated: 0, error: 'folder_not_found' };

  const folderMessages = await listFolderMessages(token, folder.id, 200);
  const folderResult = await upsertFolderMessages({
    workspaceId,
    userEmail: user.email,
    messages: folderMessages,
  });

  const conversationIds = new Set(folderResult.conversationIds);
  const totals = {
    messagesAdded: folderResult.messagesAdded,
    messagesUpdated: folderResult.messagesUpdated,
  };

  const { deltaReset, deltaConversationIds } = await runDeltaSync({
    token,
    folderId: folder.id,
    userId,
    workspaceId,
    userEmail: user.email,
    storedDeltaUrl: user.outlookLastDeltaToken,
    conversationIds,
    totals,
  });

  for (const id of deltaConversationIds) {
    conversationIds.add(id);
  }

  const importedConversations = new Set<string>();

  for (const conversationId of conversationIds) {
    if (importedConversations.has(conversationId)) continue;
    importedConversations.add(conversationId);
    const conv = await importOutlookConversationForCrm({
      token,
      workspaceId,
      userEmail: user.email,
      conversationId,
      folderId: folder.id,
      folderCache: folderMessages,
    });
    totals.messagesAdded += conv.messagesAdded;
    totals.messagesUpdated += conv.messagesUpdated;
  }

  return {
    messagesAdded: totals.messagesAdded,
    messagesUpdated: totals.messagesUpdated,
    ...(deltaReset ? { notice: 'delta_reset' as const } : {}),
  };
}
