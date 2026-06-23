-- CreateTable
CREATE TABLE "UserCalendar" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "CalendarProvider" NOT NULL,
    "calendarId" TEXT NOT NULL,
    "calendarName" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "syncToken" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCalendar_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN "calendarId" TEXT NOT NULL DEFAULT 'primary';
ALTER TABLE "CalendarEvent" ADD COLUMN "createdFromCrm" BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing events
UPDATE "CalendarEvent" SET "calendarId" = 'primary' WHERE "calendarId" IS NULL OR "calendarId" = '';

-- CreateTable
CREATE TABLE "CalendarEventContact" (
    "id" TEXT NOT NULL,
    "calendarEventId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,

    CONSTRAINT "CalendarEventContact_pkey" PRIMARY KEY ("id")
);

-- DropIndex
DROP INDEX "CalendarEvent_workspaceId_googleEventId_key";

-- DropIndex
DROP INDEX "CalendarEvent_workspaceId_outlookEventId_key";

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEvent_workspaceId_calendarId_googleEventId_key" ON "CalendarEvent"("workspaceId", "calendarId", "googleEventId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEvent_workspaceId_calendarId_outlookEventId_key" ON "CalendarEvent"("workspaceId", "calendarId", "outlookEventId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCalendar_userId_calendarId_key" ON "UserCalendar"("userId", "calendarId");

-- CreateIndex
CREATE INDEX "UserCalendar_userId_syncEnabled_idx" ON "UserCalendar"("userId", "syncEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEventContact_calendarEventId_contactId_key" ON "CalendarEventContact"("calendarEventId", "contactId");

-- AddForeignKey
ALTER TABLE "UserCalendar" ADD CONSTRAINT "UserCalendar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventContact" ADD CONSTRAINT "CalendarEventContact_calendarEventId_fkey" FOREIGN KEY ("calendarEventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventContact" ADD CONSTRAINT "CalendarEventContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
