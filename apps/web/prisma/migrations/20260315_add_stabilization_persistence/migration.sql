-- P1-1 Slice-1A: Post-Stabilization Persistence Models
-- additive-only migration — no existing table modifications
-- rollback: DROP TABLE in reverse order

-- 1. StabilizationBaseline
CREATE TABLE "StabilizationBaseline" (
    "id" TEXT NOT NULL,
    "baselineSource" TEXT NOT NULL,
    "baselineVersion" TEXT NOT NULL,
    "baselineHash" TEXT NOT NULL,
    "lifecycleState" TEXT NOT NULL,
    "releaseMode" TEXT NOT NULL,
    "baselineStatus" TEXT NOT NULL,
    "activeSnapshotId" TEXT,
    "rollbackSnapshotId" TEXT,
    "freezeReason" TEXT,
    "activePathManifestId" TEXT,
    "policySetVersion" TEXT,
    "routingRuleVersion" TEXT,
    "authorityRegistryVersion" TEXT,
    "stabilizationOnly" BOOLEAN NOT NULL DEFAULT true,
    "featureExpansionAllowed" BOOLEAN NOT NULL DEFAULT false,
    "experimentalPathAllowed" BOOLEAN NOT NULL DEFAULT false,
    "structuralRefactorAllowed" BOOLEAN NOT NULL DEFAULT false,
    "devOnlyPathAllowed" BOOLEAN NOT NULL DEFAULT false,
    "emergencyRollbackAllowed" BOOLEAN NOT NULL DEFAULT true,
    "containmentPriorityEnabled" BOOLEAN NOT NULL DEFAULT true,
    "auditStrictMode" BOOLEAN NOT NULL DEFAULT true,
    "mergeGateStrictMode" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StabilizationBaseline_pkey" PRIMARY KEY ("id")
);

-- 2. StabilizationSnapshot
CREATE TABLE "StabilizationSnapshot" (
    "id" TEXT NOT NULL,
    "baselineId" TEXT NOT NULL,
    "snapshotType" TEXT NOT NULL,
    "configChecksum" TEXT,
    "flagChecksum" TEXT,
    "routingChecksum" TEXT,
    "authorityChecksum" TEXT,
    "policyChecksum" TEXT,
    "queueTopologyChecksum" TEXT,
    "includedScopes" JSONB NOT NULL,
    "restoreVerificationStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StabilizationSnapshot_pkey" PRIMARY KEY ("id")
);

-- 3. StabilizationAuthorityLine
CREATE TABLE "StabilizationAuthorityLine" (
    "id" TEXT NOT NULL,
    "authorityLineId" TEXT NOT NULL,
    "currentAuthorityId" TEXT NOT NULL,
    "authorityState" TEXT NOT NULL,
    "transferState" TEXT NOT NULL,
    "pendingSuccessorId" TEXT,
    "revokedAuthorityIds" JSONB NOT NULL DEFAULT '[]',
    "registryVersion" TEXT NOT NULL,
    "baselineId" TEXT,
    "correlationId" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StabilizationAuthorityLine_pkey" PRIMARY KEY ("id")
);

-- 4. StabilizationIncident
CREATE TABLE "StabilizationIncident" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "baselineId" TEXT,
    "snapshotId" TEXT,
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StabilizationIncident_pkey" PRIMARY KEY ("id")
);

-- 5. StabilizationAuditEvent
CREATE TABLE "StabilizationAuditEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "incidentId" TEXT,
    "baselineId" TEXT,
    "snapshotId" TEXT,
    "actor" TEXT,
    "reasonCode" TEXT,
    "severity" TEXT,
    "sourceModule" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "resultStatus" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StabilizationAuditEvent_pkey" PRIMARY KEY ("id")
);

-- 6. CanonicalAuditEvent
CREATE TABLE "CanonicalAuditEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventStage" TEXT,
    "correlationId" TEXT NOT NULL,
    "incidentId" TEXT,
    "timelineId" TEXT NOT NULL,
    "baselineId" TEXT,
    "baselineVersion" TEXT,
    "baselineHash" TEXT,
    "lifecycleState" TEXT,
    "releaseMode" TEXT,
    "actor" TEXT,
    "sourceModule" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshotBeforeId" TEXT,
    "snapshotAfterId" TEXT,
    "affectedScopes" JSONB NOT NULL DEFAULT '[]',
    "resultStatus" TEXT NOT NULL,
    "parentEventId" TEXT,

    CONSTRAINT "CanonicalAuditEvent_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "StabilizationAuthorityLine_authorityLineId_key" ON "StabilizationAuthorityLine"("authorityLineId");
CREATE UNIQUE INDEX "StabilizationIncident_incidentId_key" ON "StabilizationIncident"("incidentId");
CREATE UNIQUE INDEX "StabilizationAuditEvent_eventId_key" ON "StabilizationAuditEvent"("eventId");
CREATE UNIQUE INDEX "CanonicalAuditEvent_eventId_key" ON "CanonicalAuditEvent"("eventId");

-- StabilizationBaseline indexes
CREATE INDEX "StabilizationBaseline_baselineVersion_idx" ON "StabilizationBaseline"("baselineVersion");
CREATE INDEX "StabilizationBaseline_lifecycleState_idx" ON "StabilizationBaseline"("lifecycleState");
CREATE INDEX "StabilizationBaseline_baselineStatus_idx" ON "StabilizationBaseline"("baselineStatus");
CREATE INDEX "StabilizationBaseline_createdAt_idx" ON "StabilizationBaseline"("createdAt");

-- StabilizationSnapshot indexes
CREATE INDEX "StabilizationSnapshot_baselineId_idx" ON "StabilizationSnapshot"("baselineId");
CREATE INDEX "StabilizationSnapshot_snapshotType_idx" ON "StabilizationSnapshot"("snapshotType");
CREATE INDEX "StabilizationSnapshot_baselineId_snapshotType_idx" ON "StabilizationSnapshot"("baselineId", "snapshotType");
CREATE INDEX "StabilizationSnapshot_createdAt_idx" ON "StabilizationSnapshot"("createdAt");

-- StabilizationAuthorityLine indexes
CREATE INDEX "StabilizationAuthorityLine_currentAuthorityId_idx" ON "StabilizationAuthorityLine"("currentAuthorityId");
CREATE INDEX "StabilizationAuthorityLine_authorityState_idx" ON "StabilizationAuthorityLine"("authorityState");
CREATE INDEX "StabilizationAuthorityLine_baselineId_idx" ON "StabilizationAuthorityLine"("baselineId");
CREATE INDEX "StabilizationAuthorityLine_correlationId_idx" ON "StabilizationAuthorityLine"("correlationId");
CREATE INDEX "StabilizationAuthorityLine_createdAt_idx" ON "StabilizationAuthorityLine"("createdAt");

-- StabilizationIncident indexes
CREATE INDEX "StabilizationIncident_incidentId_idx" ON "StabilizationIncident"("incidentId");
CREATE INDEX "StabilizationIncident_correlationId_idx" ON "StabilizationIncident"("correlationId");
CREATE INDEX "StabilizationIncident_baselineId_idx" ON "StabilizationIncident"("baselineId");
CREATE INDEX "StabilizationIncident_severity_idx" ON "StabilizationIncident"("severity");
CREATE INDEX "StabilizationIncident_status_idx" ON "StabilizationIncident"("status");
CREATE INDEX "StabilizationIncident_createdAt_idx" ON "StabilizationIncident"("createdAt");

-- StabilizationAuditEvent indexes
CREATE INDEX "StabilizationAuditEvent_correlationId_idx" ON "StabilizationAuditEvent"("correlationId");
CREATE INDEX "StabilizationAuditEvent_eventType_idx" ON "StabilizationAuditEvent"("eventType");
CREATE INDEX "StabilizationAuditEvent_incidentId_idx" ON "StabilizationAuditEvent"("incidentId");
CREATE INDEX "StabilizationAuditEvent_baselineId_idx" ON "StabilizationAuditEvent"("baselineId");
CREATE INDEX "StabilizationAuditEvent_occurredAt_idx" ON "StabilizationAuditEvent"("occurredAt");
CREATE INDEX "StabilizationAuditEvent_recordedAt_idx" ON "StabilizationAuditEvent"("recordedAt");

-- CanonicalAuditEvent indexes
CREATE INDEX "CanonicalAuditEvent_correlationId_idx" ON "CanonicalAuditEvent"("correlationId");
CREATE INDEX "CanonicalAuditEvent_timelineId_idx" ON "CanonicalAuditEvent"("timelineId");
CREATE INDEX "CanonicalAuditEvent_eventType_idx" ON "CanonicalAuditEvent"("eventType");
CREATE INDEX "CanonicalAuditEvent_incidentId_idx" ON "CanonicalAuditEvent"("incidentId");
CREATE INDEX "CanonicalAuditEvent_baselineId_idx" ON "CanonicalAuditEvent"("baselineId");
CREATE INDEX "CanonicalAuditEvent_occurredAt_idx" ON "CanonicalAuditEvent"("occurredAt");
CREATE INDEX "CanonicalAuditEvent_recordedAt_idx" ON "CanonicalAuditEvent"("recordedAt");
CREATE INDEX "CanonicalAuditEvent_parentEventId_idx" ON "CanonicalAuditEvent"("parentEventId");

-- Foreign keys
ALTER TABLE "StabilizationSnapshot" ADD CONSTRAINT "StabilizationSnapshot_baselineId_fkey" FOREIGN KEY ("baselineId") REFERENCES "StabilizationBaseline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StabilizationAuthorityLine" ADD CONSTRAINT "StabilizationAuthorityLine_baselineId_fkey" FOREIGN KEY ("baselineId") REFERENCES "StabilizationBaseline"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StabilizationIncident" ADD CONSTRAINT "StabilizationIncident_baselineId_fkey" FOREIGN KEY ("baselineId") REFERENCES "StabilizationBaseline"("id") ON DELETE SET NULL ON UPDATE CASCADE;
