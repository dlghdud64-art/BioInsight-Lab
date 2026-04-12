-- PO Conversion Candidate + line items
-- MOCK_CANDIDATES → persistent DB model

CREATE TABLE "POCandidate" (
    "id"               TEXT NOT NULL,
    "userId"           TEXT NOT NULL,
    "organizationId"   TEXT,
    "title"            TEXT NOT NULL,
    "vendor"           TEXT NOT NULL,
    "totalAmount"      INTEGER NOT NULL,
    "expectedDelivery" TIMESTAMP(3),
    "selectionReason"  TEXT,
    "blockers"         TEXT[] DEFAULT ARRAY[]::TEXT[],
    "approvalPolicy"   TEXT NOT NULL DEFAULT 'none',
    "approvalStatus"   TEXT NOT NULL DEFAULT 'not_required',
    "stage"            TEXT NOT NULL DEFAULT 'po_conversion_candidate',
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "POCandidate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "POCandidateItem" (
    "id"            TEXT NOT NULL,
    "candidateId"   TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "catalogNumber" TEXT NOT NULL,
    "quantity"      INTEGER NOT NULL DEFAULT 1,
    "unitPrice"     INTEGER NOT NULL,
    "lineTotal"     INTEGER NOT NULL,
    "leadTime"      TEXT NOT NULL DEFAULT '',

    CONSTRAINT "POCandidateItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "POCandidate_userId_idx" ON "POCandidate"("userId");
CREATE INDEX "POCandidate_organizationId_idx" ON "POCandidate"("organizationId");
CREATE INDEX "POCandidate_stage_idx" ON "POCandidate"("stage");
CREATE INDEX "POCandidateItem_candidateId_idx" ON "POCandidateItem"("candidateId");

ALTER TABLE "POCandidateItem"
    ADD CONSTRAINT "POCandidateItem_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "POCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
