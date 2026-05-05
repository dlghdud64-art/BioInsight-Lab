/**
 * §11.209d-mobile-request-approval-cta Phase 1 — RED test
 *
 * /api/quotes/[id] GET response.approval 안에 canRequestApproval boolean
 * 노출. mobile UI (하단 액션바 "결재 요청" Pressable) 가 visibility 분기
 * 에 사용. dead button 0 lock — canRequestApproval === false 시 CTA hide.
 *
 * canonical truth: server-side computed (3 조건):
 *   - quote.userId === session.user.id (본인 소유)
 *   - internalApprovalStatus === "NOT_REQUIRED"
 *   - workspace.plan + stripePriceId → resolveApprovalPolicyForPlan === "in_app_approval"
 *
 * 권한 truth = server validation 8-step (request-approval route).
 * 본 field 는 visibility 분기일 뿐.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const ROUTE = "src/app/api/quotes/[id]/route.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.209d-mobile-request-approval-cta Phase 1 — server canRequestApproval", () => {
  it("response.approval 에 canRequestApproval field 노출", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/canRequestApproval/);
  });

  it("workspaceMember 또는 workspace.plan 조회 (approvalPolicy 결정 위해)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/workspaceMember|workspace.*plan/);
  });

  it("resolveApprovalPolicyForPlan import + 호출", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/resolveApprovalPolicyForPlan/);
  });

  it("approvalPolicy === 'in_app_approval' 검사 명시 (3 조건 중 하나)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/approvalPolicy\s*===?\s*["']in_app_approval["']|["']in_app_approval["']/);
  });

  it("internalApprovalStatus === 'NOT_REQUIRED' 검사 명시 (3 조건 중 하나)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/internalApprovalStatus\s*===?\s*["']NOT_REQUIRED["']|["']NOT_REQUIRED["']/);
  });

  it("§11.209d-mobile-request-approval-cta 코멘트 명시 (drift 차단)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/§11\.209d-mobile-request-approval-cta|11\.209d-mobile-request-approval-cta/);
  });
});

describe("§11.209d-mobile-request-approval-cta Phase 1 — types/index.ts canRequestApproval", () => {
  // __dirname = apps/web/src/__tests__/api/quotes — 6단계 up = repo root
  const REPO_ROOT_MOBILE = join(__dirname, "..", "..", "..", "..", "..", "..");
  const TYPES = "apps/mobile/types/index.ts";

  function readMobile(rel: string): string {
    return readFileSync(join(REPO_ROOT_MOBILE, rel), "utf8");
  }

  it("QuoteApproval interface 안에 canRequestApproval?: boolean", () => {
    const src = readMobile(TYPES);
    expect(src).toMatch(/canRequestApproval\?:\s*boolean/);
  });

  it("§11.209d-mobile-request-approval-cta 코멘트 명시 (drift 차단)", () => {
    const src = readMobile(TYPES);
    expect(src).toMatch(/§11\.209d-mobile-request-approval-cta|11\.209d-mobile-request-approval-cta/);
  });
});
