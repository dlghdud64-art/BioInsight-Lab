-- §quote-item-vendor-selection — 품목 단위 vendor 확정 truth (additive nullable).
-- rollback: 컬럼 drop (기존 행 무영향 — 전부 NULL 시작 = 기존 A안 파생 동작 유지).

-- AlterTable
ALTER TABLE "QuoteListItem" ADD COLUMN     "selectedVendorRequestId" TEXT;

-- CreateIndex
CREATE INDEX "QuoteListItem_selectedVendorRequestId_idx" ON "QuoteListItem"("selectedVendorRequestId");

-- AddForeignKey
ALTER TABLE "QuoteListItem" ADD CONSTRAINT "QuoteListItem_selectedVendorRequestId_fkey" FOREIGN KEY ("selectedVendorRequestId") REFERENCES "QuoteVendorRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
