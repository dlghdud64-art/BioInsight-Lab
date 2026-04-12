-- Governance Server Persistence (Batch G+F)
-- sessionStorage 의존 3개 레이어를 Supabase 서버 테이블로 전환

-- 1. ApprovalBaseline — approval 시점 PO snapshot (dispatch changedFields diff 계산용)
CREATE TABLE "ApprovalBaseline" (
  "id"                TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "poNumber"          TEXT NOT NULL,
  "approvalDecidedAt" TEXT NOT NULL,
  "capturedAt"        TEXT NOT NULL,
  "totalAmount"       DOUBLE PRECISION NOT NULL,
  "vendorId"          TEXT NOT NULL,
  "paymentTerms"      TEXT,
  "incoterms"         TEXT,
  "shippingRegion"    TEXT NOT NULL,
  "billToEntity"      TEXT NOT NULL,
  "shipToLocation"    TEXT NOT NULL,
  "notes"             TEXT,
  "lineCount"         INTEGER NOT NULL,
  "invalidatedAt"     TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ApprovalBaseline_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApprovalBaseline_poNumber_approvalDecidedAt_key"
  ON "ApprovalBaseline"("poNumber", "approvalDecidedAt");
CREATE INDEX "ApprovalBaseline_poNumber_idx"
  ON "ApprovalBaseline"("poNumber");

-- 2. OutboundHistory — dispatch outbound execution lineage
CREATE TABLE "OutboundHistory" (
  "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "poId"       TEXT NOT NULL,
  "seqIndex"   INTEGER NOT NULL,
  "recordType" TEXT NOT NULL,
  "payload"    JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OutboundHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OutboundHistory_poId_seqIndex_key"
  ON "OutboundHistory"("poId", "seqIndex");
CREATE INDEX "OutboundHistory_poId_idx"
  ON "OutboundHistory"("poId");

-- 3. GovernanceEventDedupe — governance event publish 중복 방지
CREATE TABLE "GovernanceEventDedupe" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "poNumber"     TEXT NOT NULL,
  "eventType"    TEXT NOT NULL,
  "signatureKey" TEXT NOT NULL,
  "publishedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GovernanceEventDedupe_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GovernanceEventDedupe_poNumber_eventType_signatureKey_key"
  ON "GovernanceEventDedupe"("poNumber", "eventType", "signatureKey");
CREATE INDEX "GovernanceEventDedupe_poNumber_idx"
  ON "GovernanceEventDedupe"("poNumber");
CREATE INDEX "GovernanceEventDedupe_expiresAt_idx"
  ON "GovernanceEventDedupe"("expiresAt");
