/**
 * §11.99b #po-candidate-approval-status-enum — RED test
 *
 * POCandidate.approvalStatus String → Prisma enum POCandidateApprovalStatus
 * 통일 (옵션 A — surgical, AiActionItem 의 ApprovalStatus 와 분리).
 *
 * Scope:
 *   - schema.prisma 에 enum POCandidateApprovalStatus 정의 (8 값 snake_case)
 *   - POCandidate.approvalStatus 가 enum 사용 (String 아님)
 *   - migration SQL (CREATE TYPE + USING cast + invalid value fallback)
 *   - 8 값 정합 (procurement-stage.ts 의 ApprovalStatus type 어휘와 동일)
 *
 * Out of scope:
 *   - schema ApprovalStatus enum (4 값) 의 변경 (AiActionItem caller 호환)
 *   - procurement-stage.ts type alias 변경 (별도 batch)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SCHEMA = "prisma/schema.prisma";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.99b — POCandidateApprovalStatus enum 통일 (옵션 A)", () => {
  describe("schema.prisma — enum 정의", () => {
    it("enum POCandidateApprovalStatus 정의 (8 값)", () => {
      const src = read(SCHEMA);
      expect(src).toMatch(/enum\s+POCandidateApprovalStatus\s*\{/);
      // 8 값 모두 명시
      expect(src).toMatch(/enum\s+POCandidateApprovalStatus\s*\{[^}]*not_required[^}]*\}/);
      expect(src).toMatch(/enum\s+POCandidateApprovalStatus\s*\{[^}]*external_approval_required[^}]*\}/);
      expect(src).toMatch(/enum\s+POCandidateApprovalStatus\s*\{[^}]*external_approval_pending[^}]*\}/);
      expect(src).toMatch(/enum\s+POCandidateApprovalStatus\s*\{[^}]*externally_approved[^}]*\}/);
      expect(src).toMatch(/enum\s+POCandidateApprovalStatus\s*\{[^}]*externally_rejected[^}]*\}/);
      expect(src).toMatch(/enum\s+POCandidateApprovalStatus\s*\{[^}]*in_app_approval_pending[^}]*\}/);
      expect(src).toMatch(/enum\s+POCandidateApprovalStatus\s*\{[^}]*in_app_approved[^}]*\}/);
      expect(src).toMatch(/enum\s+POCandidateApprovalStatus\s*\{[^}]*in_app_rejected[^}]*\}/);
    });

    it("§11.99b 코멘트 명시", () => {
      const src = read(SCHEMA);
      expect(src).toMatch(/§11\.99b/);
    });
  });

  describe("POCandidate model — field type 통일", () => {
    it("approvalStatus 가 POCandidateApprovalStatus enum 사용 (String 아님)", () => {
      const src = read(SCHEMA);
      expect(src).toMatch(/approvalStatus\s+POCandidateApprovalStatus\s+@default\(not_required\)/);
    });

    it("POCandidate.approvalStatus 의 String type 잔존 0", () => {
      const src = read(SCHEMA);
      const poCandidateBlock = src.match(/model\s+POCandidate\s*\{[^}]*\}/);
      expect(poCandidateBlock).not.toBeNull();
      // POCandidate model 안에 approvalStatus String 패턴 0
      expect(poCandidateBlock![0]).not.toMatch(/approvalStatus\s+String/);
    });
  });
});

describe("§11.99b — migration SQL", () => {
  const MIGRATION =
    "prisma/migrations/20260505120000_pocandidate_approval_status_enum/migration.sql";

  it("CREATE TYPE POCandidateApprovalStatus (8 값) 존재", () => {
    const sql = read(MIGRATION);
    expect(sql).toMatch(/CREATE\s+TYPE\s+"POCandidateApprovalStatus"\s+AS\s+ENUM/);
    // 8 값 모두 명시
    expect(sql).toMatch(/'not_required'/);
    expect(sql).toMatch(/'external_approval_required'/);
    expect(sql).toMatch(/'external_approval_pending'/);
    expect(sql).toMatch(/'externally_approved'/);
    expect(sql).toMatch(/'externally_rejected'/);
    expect(sql).toMatch(/'in_app_approval_pending'/);
    expect(sql).toMatch(/'in_app_approved'/);
    expect(sql).toMatch(/'in_app_rejected'/);
  });

  it("invalid value fallback (UPDATE → 'not_required') 존재", () => {
    const sql = read(MIGRATION);
    expect(sql).toMatch(/UPDATE\s+"POCandidate"[\s\S]*SET\s+"approvalStatus"\s*=\s*'not_required'/);
  });

  it("ALTER COLUMN TYPE 변환 (USING cast)", () => {
    const sql = read(MIGRATION);
    expect(sql).toMatch(/ALTER\s+TABLE\s+"POCandidate"[\s\S]*ALTER\s+COLUMN\s+"approvalStatus"\s+TYPE\s+"POCandidateApprovalStatus"/);
    expect(sql).toMatch(/USING\s+"approvalStatus"::"POCandidateApprovalStatus"/);
  });

  it("default 재설정 ('not_required'::POCandidateApprovalStatus)", () => {
    const sql = read(MIGRATION);
    expect(sql).toMatch(/SET\s+DEFAULT\s+'not_required'::"POCandidateApprovalStatus"/);
  });
});

describe("§11.99b — application code 호환성", () => {
  const POCS = "src/lib/persistence/po-candidate-server.ts";

  it("po-candidate-server.ts 의 approvalStatus default 'not_required' 호환", () => {
    const src = read(POCS);
    expect(src).toMatch(/approvalStatus:\s*input\.approvalStatus\s*\?\?\s*["']not_required["']/);
  });
});
