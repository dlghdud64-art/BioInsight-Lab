-- §11.106 #dashboard-stats-snapshot-table
-- Daily snapshot of dashboard KPIs for trend derivation.
-- §11.94 Phase 2 backend source.

CREATE TABLE "DashboardStatsSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pendingApprovalCount" INTEGER NOT NULL DEFAULT 0,
    "anomalyCount" INTEGER NOT NULL DEFAULT 0,
    "processingRequiredCount" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" BIGINT NOT NULL DEFAULT 0,
    "totalBudget" BIGINT NOT NULL DEFAULT 0,
    "capturedBy" TEXT,
    "source" TEXT NOT NULL DEFAULT 'auto',

    CONSTRAINT "DashboardStatsSnapshot_pkey" PRIMARY KEY ("id")
);

-- @@index 들 생성
CREATE INDEX "DashboardStatsSnapshot_organizationId_capturedAt_idx" ON "DashboardStatsSnapshot"("organizationId", "capturedAt");
CREATE INDEX "DashboardStatsSnapshot_userId_capturedAt_idx" ON "DashboardStatsSnapshot"("userId", "capturedAt");
CREATE INDEX "DashboardStatsSnapshot_capturedAt_idx" ON "DashboardStatsSnapshot"("capturedAt");
