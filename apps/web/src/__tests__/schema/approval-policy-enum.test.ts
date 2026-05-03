/**
 * §11.209b-pre #approval-policy-enum — RED test
 *
 * POCandidate.approvalPolicy 의 String → Prisma enum ApprovalPolicy
 * 통일 검증 (옵션 B 정합).
 *
 * Scope:
 *   - schema.prisma 에 enum ApprovalPolicy 정의 존재
 *   - POCandidate.approvalPolicy 가 ApprovalPolicy enum 사용 (String 아님)
 *   - 3 값 (none / in_app_approval / external_approval) 정합
 *   - migration SQL 존재 (CREATE TYPE + ALTER COLUMN)
 *
 * Out of scope (별도 cluster):
 *   - POCandidate.approvalStatus String (§11.99 후보)
 *   - guardrail.ts / quote-case-contract.ts 의 다른 enum drift
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SCHEMA = "prisma/schema.prisma";
const MIGRATION =
  "prisma/migrations/20260504120000_pocandidate_approval_policy_enum/migration.sql";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.209b-pre — ApprovalPolicy enum 통일 (옵션 B)", () => {
  describe("schema.prisma — enum 정의", () => {
    it("enum ApprovalPolicy 정의 존재 (3 값)", () => {
      const src = read(SCHEMA);
      // enum block — 줄바꿈 다양 허용
      expect(src).toMatch(/enum\s+ApprovalPolicy\s*\{[^}]*none[^}]*\}/);
      expect(src).toMatch(/enum\s+ApprovalPolicy\s*\{[^}]*in_app_approval[^}]*\}/);
      expect(src).toMatch(/enum\s+ApprovalPolicy\s*\{[^}]*external_approval[^}]*\}/);
    });

    it("§11.209b-pre 코멘트 명시 (drift 차단)", () => {
      const src = read(SCHEMA);
      expect(src).toMatch(/§11\.209b-pre/);
    });
  });

  describe("POCandidate model — field type 통일", () => {
    it("approvalPolicy 가 ApprovalPolicy enum 사용 (String 아님)", () => {
      const src = read(SCHEMA);
      // POCandidate model block 에서 approvalPolicy 의 type
      expect(src).toMatch(/approvalPolicy\s+ApprovalPolicy\s+@default\(none\)/);
    });

    it("approvalPolicy 의 String type 잔존 0 (POCandidate 안)", () => {
      const src = read(SCHEMA);
      // POCandidate model 안에 approvalPolicy String 패턴 0
      const poCandidateBlock = src.match(/model\s+POCandidate\s*\{[^}]*\}/);
      expect(poCandidateBlock).not.toBeNull();
      expect(poCandidateBlock![0]).not.toMatch(/approvalPolicy\s+String/);
    });
  });

  describe("migration SQL — 안전한 타입 변환", () => {
    it("CREATE TYPE ApprovalPolicy (3 값) 존재", () => {
      const sql = read(MIGRATION);
      expect(sql).toMatch(/CREATE\s+TYPE\s+"ApprovalPolicy"\s+AS\s+ENUM/);
      expect(sql).toMatch(/'none'/);
      expect(sql).toMatch(/'in_app_approval'/);
      expect(sql).toMatch(/'external_approval'/);
    });

    it("invalid value fallback (UPDATE → 'none') 존재", () => {
      const sql = read(MIGRATION);
      expect(sql).toMatch(/UPDATE\s+"POCandidate"[\s\S]*SET\s+"approvalPolicy"\s*=\s*'none'/);
    });

    it("ALTER COLUMN TYPE 변환 (USING cast)", () => {
      const sql = read(MIGRATION);
      expect(sql).toMatch(/ALTER\s+TABLE\s+"POCandidate"[\s\S]*ALTER\s+COLUMN\s+"approvalPolicy"\s+TYPE\s+"ApprovalPolicy"/);
      expect(sql).toMatch(/USING\s+"approvalPolicy"::"ApprovalPolicy"/);
    });

    it("default 재설정 ('none'::ApprovalPolicy)", () => {
      const sql = read(MIGRATION);
      expect(sql).toMatch(/SET\s+DEFAULT\s+'none'::"ApprovalPolicy"/);
    });
  });

  describe("application code 호환성 보호", () => {
    it("po-candidate-server.ts 의 approvalPolicy: input.approvalPolicy ?? \"none\" 호환", () => {
      // 호환성 검증 — string literal "none" 이 enum value 와 매핑
      // 이 패턴은 변경 0 (옵션 B 의 핵심 약속)
      const POCS = "src/lib/persistence/po-candidate-server.ts";
      const src = read(POCS);
      expect(src).toMatch(/approvalPolicy:\s*input\.approvalPolicy\s*\?\?\s*["']none["']/);
    });
  });
});
