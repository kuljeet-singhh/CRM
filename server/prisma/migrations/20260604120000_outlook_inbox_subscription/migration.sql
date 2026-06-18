ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "outlookInboxSubscriptionId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "outlookInboxSubscriptionExpiry" TIMESTAMP(3);
