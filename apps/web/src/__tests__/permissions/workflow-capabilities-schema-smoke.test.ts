/**
 * §11.193d Phase 2.1 #workflow-capabilities-schema-smoke
 *
 * prisma schema 의 OrganizationMember.workflowCapabilities Json column +
 * migration 파일 존재 검증.
 *
 * 본 smoke 는 prisma client / DB 없이 source-level 만 검증 — vitest 가
 * fast 하게 schema drift 차단.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const SCHEMA_PATH = resolve(__dirname, "../../../prisma/schema.prisma");
const MIGRATION_PATH = resolve(
  __dirname,
  "../../../prisma/migrations/20260502230000_add_organization_member_workflow_capabilities/migration.sql",
);

const SCHEMA_SOURCE = readFileSync(SCHEMA_PATH, "utf8");

describe("§11.193d Phase 2.1 schema — OrganizationMember.workflowCapabilities", () => {
  it("Json column 추가 + default '[]'", () => {
    // OrganizationMember model 안에 workflowCapabilities Json @default("[]") 존재
    expect(SCHEMA_SOURCE).toMatch(
      /model\s+OrganizationMember\b[\s\S]*?workflowCapabilities\s+Json\s+@default\("\[\]"\)/,
    );
  });

  it("기존 role 필드 보존 (RBAC layer 영향 0)", () => {
    expect(SCHEMA_SOURCE).toMatch(
      /model\s+OrganizationMember\b[\s\S]*?role\s+OrganizationRole\s+@default\(VIEWER\)/,
    );
  });

  it("§11.193d Phase 2 사유 comment 보존 (mental overhead ↓)", () => {
    expect(SCHEMA_SOURCE).toMatch(/§11\.193d Phase 2[\s\S]*?workflow capabilities/);
  });
});

describe("§11.193d Phase 2.1 migration file 존재", () => {
  it("migration 파일 생성 확인", () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
  });

  it("ALTER TABLE OrganizationMember ADD COLUMN workflowCapabilities JSONB", () => {
    const sql = readFileSync(MIGRATION_PATH, "utf8");
    expect(sql).toMatch(
      /ALTER\s+TABLE\s+"OrganizationMember"[\s\S]*?ADD\s+COLUMN\s+"workflowCapabilities"\s+JSONB[\s\S]*?DEFAULT\s+'\[\]'::jsonb/i,
    );
  });

  it("§11.193d Phase 2 사유 comment 포함 (운영자 historian)", () => {
    const sql = readFileSync(MIGRATION_PATH, "utf8");
    expect(sql).toMatch(/§11\.193d Phase 2/);
  });
});
