-- DropIndex
DROP INDEX "Order_poCandidateId_idx";

-- AlterTable
ALTER TABLE "POCandidate" ADD COLUMN     "quoteId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_poCandidateId_key" ON "Order"("poCandidateId");

-- CreateIndex
CREATE INDEX "POCandidate_quoteId_idx" ON "POCandidate"("quoteId");

-- AddForeignKey
ALTER TABLE "POCandidate" ADD CONSTRAINT "POCandidate_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

