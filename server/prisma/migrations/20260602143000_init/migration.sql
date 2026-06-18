-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('gmail', 'outlook');
CREATE TYPE "ContactSource" AS ENUM ('manual', 'logged_email', 'apollo');
CREATE TYPE "EmailDirection" AS ENUM ('sent', 'received');
CREATE TYPE "RecipientRole" AS ENUM ('from', 'to', 'cc', 'bcc');
CREATE TYPE "WorkspaceRole" AS ENUM ('owner', 'admin', 'member');
CREATE TYPE "SyncJobType" AS ENUM ('label_sync', 'thread_sync');
CREATE TYPE "SyncJobStatus" AS ENUM ('pending', 'processing', 'done', 'failed');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "authProvider" "AuthProvider" NOT NULL,
    "googleAccessToken" TEXT,
    "googleRefreshToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "outlookAccessToken" TEXT,
    "outlookRefreshToken" TEXT,
    "outlookTokenExpiry" TIMESTAMP(3),
    "gmailSyncLabel" TEXT,
    "gmailLastHistoryId" TEXT,
    "gmailWatchExpiry" TIMESTAMP(3),
    "outlookSyncFolder" TEXT,
    "outlookLastDeltaToken" TEXT,
    "timezone" TEXT,
    "apolloApiKey" TEXT,
    "apolloLastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'owner',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdFrom" "ContactSource" NOT NULL DEFAULT 'logged_email',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "gmailMessageId" TEXT,
    "gmailThreadId" TEXT,
    "outlookMessageId" TEXT,
    "rfcMessageId" TEXT,
    "subject" TEXT,
    "bodyText" TEXT,
    "bodyHtml" TEXT,
    "direction" "EmailDirection" NOT NULL,
    "sentAt" TIMESTAMP(3),
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailMessageRecipient" (
    "id" TEXT NOT NULL,
    "emailMessageId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "role" "RecipientRole" NOT NULL,
    CONSTRAINT "EmailMessageRecipient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmLabel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "labelName" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CrmLabel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "workspaceId" TEXT,
    "type" "SyncJobType" NOT NULL,
    "status" "SyncJobStatus" NOT NULL DEFAULT 'pending',
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "session" (
    "sid" varchar NOT NULL COLLATE "default",
    "sess" json NOT NULL,
    "expire" timestamp(6) NOT NULL,
    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Membership_userId_workspaceId_key" ON "Membership"("userId", "workspaceId");
CREATE UNIQUE INDEX "Contact_workspaceId_email_key" ON "Contact"("workspaceId", "email");
CREATE UNIQUE INDEX "EmailMessage_workspaceId_gmailMessageId_key" ON "EmailMessage"("workspaceId", "gmailMessageId");
CREATE UNIQUE INDEX "EmailMessageRecipient_emailMessageId_contactId_role_key" ON "EmailMessageRecipient"("emailMessageId", "contactId", "role");
CREATE UNIQUE INDEX "CrmLabel_userId_key" ON "CrmLabel"("userId");
CREATE INDEX "EmailMessage_workspaceId_sentAt_idx" ON "EmailMessage"("workspaceId", "sentAt");
CREATE INDEX "SyncJob_status_runAt_idx" ON "SyncJob"("status", "runAt");
CREATE INDEX "IDX_session_expire" ON "session" ("expire");

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailMessageRecipient" ADD CONSTRAINT "EmailMessageRecipient_emailMessageId_fkey" FOREIGN KEY ("emailMessageId") REFERENCES "EmailMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailMessageRecipient" ADD CONSTRAINT "EmailMessageRecipient_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmLabel" ADD CONSTRAINT "CrmLabel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmLabel" ADD CONSTRAINT "CrmLabel_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
