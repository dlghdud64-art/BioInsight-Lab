-- §catalog-A Phase 1 — procurement_catalog_ref (조달청 식별 계층 reference)
-- canonical(Product) 무변경 — 신규 테이블만 생성. 롤백 = DROP TABLE (Product 무손상).

-- CreateTable
CREATE TABLE "ProcurementCatalogRef" (
    "prdctIdNo" TEXT NOT NULL,
    "prdctClsfcNo" TEXT,
    "dtilPrdctClsfcNo" TEXT,
    "mfrtNm" TEXT,
    "prdctNm" TEXT,
    "dtilPrdctNm" TEXT,
    "engPrdctNm" TEXT,
    "modelNm" TEXT,
    "source" TEXT NOT NULL DEFAULT 'public_procurement',
    "linkedProductId" TEXT,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceUpdatedAt" TEXT,

    CONSTRAINT "ProcurementCatalogRef_pkey" PRIMARY KEY ("prdctIdNo")
);

-- CreateIndex
CREATE INDEX "ProcurementCatalogRef_prdctClsfcNo_idx" ON "ProcurementCatalogRef"("prdctClsfcNo");

-- CreateIndex
CREATE INDEX "ProcurementCatalogRef_mfrtNm_idx" ON "ProcurementCatalogRef"("mfrtNm");

-- CreateIndex
CREATE INDEX "ProcurementCatalogRef_prdctNm_idx" ON "ProcurementCatalogRef"("prdctNm");

-- CreateIndex
CREATE INDEX "ProcurementCatalogRef_linkedProductId_idx" ON "ProcurementCatalogRef"("linkedProductId");
