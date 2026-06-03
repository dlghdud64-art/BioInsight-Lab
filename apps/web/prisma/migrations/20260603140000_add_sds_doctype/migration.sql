-- AlterTable
ALTER TABLE "SDSDocument" ADD COLUMN     "docType" TEXT NOT NULL DEFAULT 'sds';

-- CreateIndex
CREATE INDEX "SDSDocument_docType_idx" ON "SDSDocument"("docType");

