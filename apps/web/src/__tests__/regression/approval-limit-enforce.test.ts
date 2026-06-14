/**
 * §S2 #approval-limit-server-enforce — per-user 단일건 승인 한도 서버 강제 회귀 가드.
 *
 * audit S2 HIGH: approvalLimit 이 저장·라우팅 추천에만 반영되고 승인 실행 시점에
 *   재검증되지 않던 우회를 차단. 게이트 대상 = request/[id]/approve(금액 결재 승인) 1곳
 *   (order_create 등 타 경로는 금액 결재 아님 → 분리, 호영님 결정).
 *
 * 구성:
 *   1) checkApprovalLimit 순수함수 로직(경계) — 실 단위 테스트.
 *   2) request/approve route wiring — readFileSync+regex 가드.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkApprovalLimit } from "@/lib/security/approval-limit-guard";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const APPROVE_PATH = "src/app/api/request/[id]/approve/route.ts";
const GUARD_PATH = "src/lib/security/approval-limit-guard.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§S2 — checkApprovalLimit 로직(경계)", () => {
  it("null = 무제한 통과", () => {
    expect(checkApprovalLimit(null, 999_999_999).allowed).toBe(true);
    expect(checkApprovalLimit(undefined, 999_999_999).allowed).toBe(true);
  });
  it("한도 이내 통과", () => {
    expect(checkApprovalLimit(1_000_000, 500_000).allowed).toBe(true);
  });
  it("한도 동일 통과(<=)", () => {
    expect(checkApprovalLimit(1_000_000, 1_000_000).allowed).toBe(true);
  });
  it("한도 초과 차단 + 사유", () => {
    const r = checkApprovalLimit(1_000_000, 2_000_000);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBeTruthy();
  });
  it("bigint 한도 처리", () => {
    expect(checkApprovalLimit(BigInt(1_000_000), 500_000).allowed).toBe(true);
    expect(checkApprovalLimit(BigInt(1_000_000), 2_000_000).allowed).toBe(false);
  });
});

describe("§S2 — guard helper 계약 보존", () => {
  it("checkApprovalLimit export + null 무제한 + <= 통과 패턴", () => {
    const src = read(GUARD_PATH);
    expect(src).toMatch(/export function checkApprovalLimit/);
    expect(src).toMatch(/approvalLimit == null/);
    expect(src).toMatch(/amount <= limit/);
  });
});

describe("§S2 — request/approve 승인 실행 한도 게이트 wiring", () => {
  it("checkApprovalLimit import + actor OrganizationMember.approvalLimit 조회", () => {
    const src = read(APPROVE_PATH);
    expect(src).toMatch(/checkApprovalLimit/);
    expect(src).toMatch(/organizationMember\.findFirst/);
    expect(src).toMatch(/approvalLimit: true/);
  });
  it("한도 초과 시 403 + 상위 승인자 안내(차단, front-only 아님)", () => {
    const src = read(APPROVE_PATH);
    expect(src).toMatch(
      /!approvalLimitCheck\.allowed[\s\S]{0,200}status: 403/,
    );
    expect(src).toMatch(/requiresHigherApprover/);
  });
  it("회귀 0 — 카테고리 예산 게이트(별 통제축) 보존", () => {
    const src = read(APPROVE_PATH);
    expect(src).toMatch(/validateCategoryBudgetInTransaction/);
    expect(src).toMatch(/BudgetBlockedError/);
  });
});
