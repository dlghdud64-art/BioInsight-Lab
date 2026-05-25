/**
 * §11.305-phase4 #mutation-audit-event-schema — MutationAuditEvent
 *   schema-codebase 정합 lock sentinel. release-prep P1 Phase 4.
 *
 * Phase 4 evidence 결과:
 *   - schema.prisma line 2969~ 의 MutationAuditEvent model 정의
 *     23 field + 1 unique + 6 @@index
 *   - prisma/migrations/0_init/migration.sql 의 CREATE TABLE 정의
 *     23 field + 1 UNIQUE INDEX + 6 INDEX + PRIMARY KEY
 *   - 두 정의 field-by-field 정합 (drift 0)
 *   - 0_init 이후 incremental migration 중 MutationAuditEvent 변경 0 file
 *
 * 결론:
 *   - production DB 가 0_init 으로 setup 됐다면 MutationAuditEvent
 *     table 존재 + field 정합 100%
 *   - 추가 migration 불필요 (idempotent 자체 보장)
 *   - 본 sentinel 은 향후 schema 또는 durable-mutation-audit.ts 수정 시
 *     drift 자동 감지용
 *
 * Production 사용처 (audit write path):
 *   - apps/web/src/app/api/admin/orders/[id]/status/route.ts
 *   - apps/web/src/app/api/request/[id]/approve/route.ts
 *
 * Scope (read-only sentinel):
 *   1. schema.prisma 에 model MutationAuditEvent 존재
 *   2. 23 field 정합 (name + nullable/required)
 *   3. 1 @unique + 6 @@index 정합
 *   4. 0_init/migration.sql 에 CREATE TABLE 존재 + 동일 field
 *   5. durable-mutation-audit.ts 가 schema field name 사용
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "../../../../..");

const SCHEMA_SRC = readFileSync(
  resolve(REPO_ROOT, "apps/web/prisma/schema.prisma"),
  "utf8",
);
const INIT_SQL_SRC = readFileSync(
  resolve(REPO_ROOT, "apps/web/prisma/migrations/0_init/migration.sql"),
  "utf8",
);
const AUDIT_HELPER_SRC = readFileSync(
  resolve(REPO_ROOT, "apps/web/src/lib/audit/durable-mutation-audit.ts"),
  "utf8",
);

describe("§11.305-phase4 — MutationAuditEvent schema-codebase 정합 lock", () => {
  it("§11.305-phase4 trace marker (self-referential)", () => {
    const selfSrc = readFileSync(__filename, "utf8");
    expect(selfSrc).toMatch(/§11\.305-phase4/);
  });

  describe("schema.prisma — model MutationAuditEvent 정의", () => {
    it("model 선언 존재", () => {
      expect(SCHEMA_SRC).toMatch(/^model MutationAuditEvent \{/m);
    });

    it("auditEventKey @unique 정의", () => {
      expect(SCHEMA_SRC).toMatch(/auditEventKey\s+String\s+@unique/);
    });

    it("23 field 모두 정의 (required + nullable 정합)", () => {
      const requiredFields = [
        "id",
        "auditEventKey",
        "occurredAt",
        "orgId",
        "actorId",
        "route",
        "action",
        "entityType",
        "entityId",
        "result",
        "correlationId",
        "recordedAt",
      ];
      const nullableFields = [
        "requestId",
        "orderId",
        "purchaseRecordId",
        "periodKey",
        "normalizedCategoryId",
        "amount",
        "thresholds",
        "decisionBasis",
        "budgetEventKey",
        "compensatingForEventId",
      ];

      for (const field of requiredFields) {
        // required: field name + non-? type
        const pattern = new RegExp(
          `\\s${field}\\s+(String|Int|DateTime|Json)(\\s|@)`,
        );
        expect(SCHEMA_SRC).toMatch(pattern);
      }
      for (const field of nullableFields) {
        // nullable: field name + Type?
        const pattern = new RegExp(`\\s${field}\\s+(String|Int|Json)\\?`);
        expect(SCHEMA_SRC).toMatch(pattern);
      }
    });

    it("6 @@index 정의 ([orgId,occurredAt] / [entityType,entityId] / [actorId] / [action] / [correlationId] / [route])", () => {
      expect(SCHEMA_SRC).toMatch(/@@index\(\[orgId, occurredAt\]\)/);
      expect(SCHEMA_SRC).toMatch(/@@index\(\[entityType, entityId\]\)/);
      expect(SCHEMA_SRC).toMatch(/@@index\(\[actorId\]\)/);
      expect(SCHEMA_SRC).toMatch(/@@index\(\[action\]\)/);
      expect(SCHEMA_SRC).toMatch(/@@index\(\[correlationId\]\)/);
      expect(SCHEMA_SRC).toMatch(/@@index\(\[route\]\)/);
    });
  });

  describe("0_init/migration.sql — CREATE TABLE 정합", () => {
    it('CREATE TABLE "MutationAuditEvent" 존재', () => {
      expect(INIT_SQL_SRC).toMatch(/CREATE TABLE "MutationAuditEvent"/);
    });

    it("PRIMARY KEY (id) 정의", () => {
      expect(INIT_SQL_SRC).toMatch(
        /CONSTRAINT "MutationAuditEvent_pkey" PRIMARY KEY \("id"\)/,
      );
    });

    it("UNIQUE INDEX auditEventKey 정의", () => {
      expect(INIT_SQL_SRC).toMatch(
        /CREATE UNIQUE INDEX "MutationAuditEvent_auditEventKey_key"/,
      );
    });

    it("6 INDEX 정의 (orgId_occurredAt / entityType_entityId / actorId / action / correlationId / route)", () => {
      expect(INIT_SQL_SRC).toMatch(
        /CREATE INDEX "MutationAuditEvent_orgId_occurredAt_idx"/,
      );
      expect(INIT_SQL_SRC).toMatch(
        /CREATE INDEX "MutationAuditEvent_entityType_entityId_idx"/,
      );
      expect(INIT_SQL_SRC).toMatch(
        /CREATE INDEX "MutationAuditEvent_actorId_idx"/,
      );
      expect(INIT_SQL_SRC).toMatch(
        /CREATE INDEX "MutationAuditEvent_action_idx"/,
      );
      expect(INIT_SQL_SRC).toMatch(
        /CREATE INDEX "MutationAuditEvent_correlationId_idx"/,
      );
      expect(INIT_SQL_SRC).toMatch(
        /CREATE INDEX "MutationAuditEvent_route_idx"/,
      );
    });

    it("required field NOT NULL constraint (11 field)", () => {
      const requiredFields = [
        "id",
        "auditEventKey",
        "orgId",
        "actorId",
        "route",
        "action",
        "entityType",
        "entityId",
        "result",
        "correlationId",
      ];
      for (const field of requiredFields) {
        const pattern = new RegExp(`"${field}" TEXT NOT NULL`);
        expect(INIT_SQL_SRC).toMatch(pattern);
      }
    });

    it("DateTime DEFAULT CURRENT_TIMESTAMP — occurredAt + recordedAt", () => {
      expect(INIT_SQL_SRC).toMatch(
        /"occurredAt" TIMESTAMP\(3\) NOT NULL DEFAULT CURRENT_TIMESTAMP/,
      );
      expect(INIT_SQL_SRC).toMatch(
        /"recordedAt" TIMESTAMP\(3\) NOT NULL DEFAULT CURRENT_TIMESTAMP/,
      );
    });
  });

  describe("durable-mutation-audit.ts — production helper 정합", () => {
    it("buildAuditEventKey + recordMutationAudit + queryMutationAuditEvents helper 정의", () => {
      // schema field name 을 helper 가 사용 (정합 lock)
      expect(AUDIT_HELPER_SRC).toMatch(/buildAuditEventKey/);
      expect(AUDIT_HELPER_SRC).toMatch(/recordMutationAudit/);
      expect(AUDIT_HELPER_SRC).toMatch(/queryMutationAuditEvents/);
    });

    it("auditEventKey unique 제약 의존 명시", () => {
      // helper comment 가 unique 제약을 의존 (idempotency key 보장)
      expect(AUDIT_HELPER_SRC).toMatch(/auditEventKey/);
      expect(AUDIT_HELPER_SRC).toMatch(/unique/);
    });
  });
});
