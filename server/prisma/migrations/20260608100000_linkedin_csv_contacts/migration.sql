-- AlterEnum
ALTER TYPE "ContactSource" ADD VALUE 'linkedin_csv';

-- AlterTable
ALTER TABLE "Contact" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "Contact" ADD COLUMN "company" TEXT;
ALTER TABLE "Contact" ADD COLUMN "title" TEXT;
ALTER TABLE "Contact" ADD COLUMN "linkedinUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Contact_workspaceId_linkedinUrl_key" ON "Contact"("workspaceId", "linkedinUrl");
