-- CreateEnum
CREATE TYPE "CalendarProvider" AS ENUM ('gmail', 'outlook');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "calendarSyncEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "googleCalendarSyncToken" TEXT;
ALTER TABLE "User" ADD COLUMN "googleCalendarLastSyncedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "outlookCalendarDeltaToken" TEXT;
ALTER TABLE "User" ADD COLUMN "outlookCalendarLastSyncedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" "CalendarProvider" NOT NULL,
    "googleEventId" TEXT,
    "outlookEventId" TEXT,
    "icalUid" TEXT,
    "title" TEXT,
    "description" TEXT,
    "location" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT,
    "status" TEXT,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "organizerEmail" TEXT,
    "attendees" JSONB,
    "htmlLink" TEXT,
    "webLink" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarEvent_workspaceId_startsAt_idx" ON "CalendarEvent"("workspaceId", "startsAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_workspaceId_organizerEmail_idx" ON "CalendarEvent"("workspaceId", "organizerEmail");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEvent_workspaceId_googleEventId_key" ON "CalendarEvent"("workspaceId", "googleEventId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEvent_workspaceId_outlookEventId_key" ON "CalendarEvent"("workspaceId", "outlookEventId");

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
