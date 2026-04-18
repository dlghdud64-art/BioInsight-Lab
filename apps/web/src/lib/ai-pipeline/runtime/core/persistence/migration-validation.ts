/**
 * P1-1 Slice-1B — Migration Validation Hook
 *
 * Pre-implementation checklist and validation contract
 * for Slice-1A schema migration.
 *
 * This file documents the validation steps that must pass
 * BEFORE Slice-1C/1D implementations are written.
 */

// ══════════════════════════════════════════════════════════════════════════════
// 1. Schema Validation Command Contract
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Commands to validate schema before migration execution.
 * Run these manually or in CI before prisma migrate deploy.
 */
export const SCHEMA_VALIDATION_COMMANDS = [
  {
    step: 1,
    command: "npx prisma validate",
    purpose: "Validate schema.prisma syntax and model relationships",
    expectedResult: "The schema at prisma/schema.prisma is valid",
    status: "PASSED" as const, // Verified in Slice-1A
  },
  {
    step: 2,
    command: "npx prisma generate",
    purpose: "Generate Prisma client types from schema",
    expectedResult: "Prisma client generated successfully",
    status: "PENDING" as const,
  },
  {
    step: 3,
    command: "npx tsc --noEmit",
    purpose: "Verify TypeScript compilation with new Prisma types",
    expectedResult: "No compilation errors",
    status: "PENDING" as const,
  },
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// 2. Migration Dry-Run Checklist
// ══════════════════════════════════════════════════════════════════════════════

export const MIGRATION_DRY_RUN_CHECKLIST = [
  {
    checkId: "MIG-001",
    description: "All 6 CREATE TABLE statements present in migration.sql",
    tables: [
      "StabilizationBaseline",
      "StabilizationSnapshot",
      "StabilizationAuthorityLine",
      "StabilizationIncident",
      "StabilizationAuditEvent",
      "CanonicalAuditEvent",
    ],
    status: "PASSED" as const,
  },
  {
    checkId: "MIG-002",
    description: "Unique constraints defined for business keys",
    constraints: [
      "StabilizationAuthorityLine.authorityLineId",
      "StabilizationIncident.incidentId",
      "StabilizationAuditEvent.eventId",
      "CanonicalAuditEvent.eventId",
    ],
    status: "PASSED" as const,
  },
  {
    checkId: "MIG-003",
    description: "Foreign keys defined with correct ON DELETE behavior",
    foreignKeys: [
      { table: "StabilizationSnapshot", column: "baselineId", onDelete: "RESTRICT" },
      { table: "StabilizationAuthorityLine", column: "baselineId", onDelete: "SET NULL" },
      { table: "StabilizationIncident", column: "baselineId", onDelete: "SET NULL" },
    ],
    status: "PASSED" as const,
  },
  {
    checkId: "MIG-004",
    description: "No ALTER on existing tables — additive-only",
    status: "PASSED" as const,
  },
  {
    checkId: "MIG-005",
    description: "All indexes created for query patterns in repository interfaces",
    status: "PASSED" as const,
  },
  {
    checkId: "MIG-006",
    description: "JSON columns (includedScopes, revokedAuthorityIds, affectedScopes) use JSONB",
    status: "PASSED" as const,
  },
  {
    checkId: "MIG-007",
    description: "Rollback possible via DROP TABLE in reverse order",
    rollbackOrder: [
      "DROP TABLE IF EXISTS \"CanonicalAuditEvent\"",
      "DROP TABLE IF EXISTS \"StabilizationAuditEvent\"",
      "DROP TABLE IF EXISTS \"StabilizationIncident\"",
      "DROP TABLE IF EXISTS \"StabilizationAuthorityLine\"",
      "DROP TABLE IF EXISTS \"StabilizationSnapshot\"",
      "DROP TABLE IF EXISTS \"StabilizationBaseline\"",
    ],
    status: "PASSED" as const,
  },
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// 3. Repository Implementation Prerequisites
// ══════════════════════════════════════════════════════════════════════════════

export const REPOSITORY_IMPL_PREREQUISITES = [
  {
    prereqId: "PRE-001",
    description: "All 6 repository interfaces defined and exported",
    dependsOn: "Slice-1B",
    status: "IN_PROGRESS" as const,
  },
  {
    prereqId: "PRE-002",
    description: "Persisted entity types match Prisma schema column-for-column",
    dependsOn: "Slice-1A + Slice-1B",
    status: "IN_PROGRESS" as const,
  },
  {
    prereqId: "PRE-003",
    description: "RepositoryResult<T> error codes cover all known failure modes",
    dependsOn: "Slice-1B",
    status: "IN_PROGRESS" as const,
  },
  {
    prereqId: "PRE-004",
    description: "Incident status lifecycle transitions fully documented",
    dependsOn: "Slice-1B",
    status: "IN_PROGRESS" as const,
  },
  {
    prereqId: "PRE-005",
    description: "Optimistic locking targets identified (Baseline, AuthorityLine, Incident)",
    dependsOn: "Slice-1B",
    status: "IN_PROGRESS" as const,
  },
  {
    prereqId: "PRE-006",
    description: "prisma generate succeeds with new schema models",
    dependsOn: "Slice-1A schema + DB access",
    status: "PENDING" as const,
  },
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// 4. Validation Check Function Contract
// ══════════════════════════════════════════════════════════════════════════════

export type ValidationStatus = "PASSED" | "FAILED" | "PENDING" | "IN_PROGRESS";

export interface MigrationValidationResult {
  allPassed: boolean;
  schemaValidation: ValidationStatus;
  migrationChecklist: { checkId: string; status: ValidationStatus }[];
  prerequisites: { prereqId: string; status: ValidationStatus }[];
  blockers: string[];
}

/**
 * Aggregates all validation results.
 * Call this before starting Slice-1C/1D implementation.
 */
export function evaluateMigrationReadiness(): MigrationValidationResult {
  const schemaStatus = SCHEMA_VALIDATION_COMMANDS.every((c) => c.status === "PASSED")
    ? "PASSED" as const
    : "PENDING" as const;

  const migChecks = MIGRATION_DRY_RUN_CHECKLIST.map((c) => ({
    checkId: c.checkId,
    status: c.status,
  }));

  const prereqs = REPOSITORY_IMPL_PREREQUISITES.map((p) => ({
    prereqId: p.prereqId,
    status: p.status,
  }));

  const blockers: string[] = [];

  for (const cmd of SCHEMA_VALIDATION_COMMANDS) {
    if (cmd.status !== "PASSED") {
      blockers.push(`Schema validation step ${cmd.step} not passed: ${cmd.command}`);
    }
  }

  for (const check of MIGRATION_DRY_RUN_CHECKLIST) {
    if (check.status !== "PASSED") {
      blockers.push(`Migration check ${check.checkId} not passed`);
    }
  }

  for (const prereq of REPOSITORY_IMPL_PREREQUISITES) {
    if (prereq.status === "PENDING") {
      blockers.push(`Prerequisite ${prereq.prereqId} pending: ${prereq.description}`);
    }
  }

  return {
    allPassed: blockers.length === 0 && schemaStatus === "PASSED",
    schemaValidation: schemaStatus,
    migrationChecklist: migChecks,
    prerequisites: prereqs,
    blockers,
  };
}
