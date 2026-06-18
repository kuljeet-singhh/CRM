ALTER TABLE "EmailMessage" ADD COLUMN IF NOT EXISTS "conversationId" TEXT;

CREATE INDEX IF NOT EXISTS "EmailMessage_workspaceId_conversationId_idx"
  ON "EmailMessage"("workspaceId", "conversationId");
