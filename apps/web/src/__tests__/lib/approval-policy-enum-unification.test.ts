/**
 * §11.99 #application-wide-approval-enum-cleanup — RED test
 *
 * §11.209b-pre (Prisma enum ApprovalPolicy: none / in_app_approval /
 * external_approval) 통일 후속 — application 어휘 (in_app_light /
 * external_manual) 를 schema 어휘로 swap. canonical truth single source.
 *
 * Drift 위치 3 file:
 *   - lib/procurement-stage.ts (type alias 정의)
 *   - lib/guardrail.ts (4 literal 비교)
 *   - lib/quote-case-contract.ts (1 union 정의)
 *
 * Out of scope (별도 §11.99b 후속):
 *   - POCandidate.approvalStatus String → enum 통일
 *   - ApprovalStatus enum 어휘 (in_app_approved / externally_approved 등)
 *     은 schema 의 별개 enum 이므로 본 cluster 미포함
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PROCUREMENT_STAGE = "src/lib/procurement-stage.ts";
const GUARDRAIL = "src/lib/guardrail.ts";
const QUOTE_CASE = "src/lib/quote-case-contract.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.99 — ApprovalPolicy enum unification (옵션 A)", () => {
  describe("procurement-stage.ts — type alias 정의", () => {
    it("ApprovalPolicy type 의 어휘가 schema enum 정합 (in_app_approval / external_approval)", () => {
      const src = read(PROCUREMENT_STAGE);
      // type ApprovalPolicy = "none" | "external_approval" | "in_app_approval"
      expect(src).toMatch(/type\s+ApprovalPolicy\s*=[\s\S]*"none"[\s\S]*"in_app_approval"[\s\S]*"external_approval"|type\s+ApprovalPolicy\s*=[\s\S]*"none"[\s\S]*"external_approval"[\s\S]*"in_app_approval"/);
    });

    it("drift 어휘 'in_app_light' / 'external_manual' 잔존 0 (procurement-stage)", () => {
      const src = read(PROCUREMENT_STAGE);
      expect(src).not.toMatch(/"in_app_light"/);
      expect(src).not.toMatch(/"external_manual"/);
    });
  });

  describe("guardrail.ts — literal 비교", () => {
    it("ctx.approvalPolicy === 'in_app_approval' 비교 (canonical 어휘)", () => {
      const src = read(GUARDRAIL);
      expect(src).toMatch(/ctx\.approvalPolicy\s*===\s*"in_app_approval"/);
    });

    it("ctx.approvalPolicy === 'external_approval' 비교 (canonical 어휘)", () => {
      const src = read(GUARDRAIL);
      expect(src).toMatch(/ctx\.approvalPolicy\s*===\s*"external_approval"/);
    });

    it("drift 어휘 'in_app_light' / 'external_manual' 잔존 0 (guardrail)", () => {
      const src = read(GUARDRAIL);
      expect(src).not.toMatch(/"in_app_light"/);
      expect(src).not.toMatch(/"external_manual"/);
    });
  });

  describe("quote-case-contract.ts — union 정의", () => {
    it("approvalPolicy union 어휘 schema 정합", () => {
      const src = read(QUOTE_CASE);
      // union 안에 "in_app_approval" 와 "external_approval" 모두 visible
      expect(src).toMatch(/approvalPolicy:\s*"none"\s*\|\s*"(in_app_approval|external_approval)"\s*\|\s*"(in_app_approval|external_approval)"/);
    });

    it("drift 어휘 잔존 0 (quote-case-contract)", () => {
      const src = read(QUOTE_CASE);
      expect(src).not.toMatch(/"in_app_light"/);
      expect(src).not.toMatch(/"external_manual"/);
    });
  });

  describe("§11.99 cleanup 코멘트", () => {
    it("procurement-stage 또는 guardrail 에 §11.99 코멘트 명시 (drift 차단)", () => {
      const ps = read(PROCUREMENT_STAGE);
      const gd = read(GUARDRAIL);
      expect(ps + gd).toMatch(/§11\.99/);
    });
  });
});
