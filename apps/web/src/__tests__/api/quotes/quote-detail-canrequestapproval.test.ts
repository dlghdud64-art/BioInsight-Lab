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
// 승계 §approval-gate-single-source (2026-09-25 · 호영님 판정) — 판정이 공용 모듈로 내려갔다.
const CAPABILITY = "src/lib/approval/approval-capability.server.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.209d-mobile-request-approval-cta Phase 1 — server canRequestApproval", () => {
  it("response.approval 에 canRequestApproval field 노출", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/canRequestApproval/);
  });

  it("workspace.plan 조회는 판정 모듈이 한다 (approvalPolicy 결정 위해)", () => {
    /* 승계 §approval-gate-single-source — 라우트가 직접 캐던 것을 공용 서버 축으로 옮겼다.
       명제(서버가 plan 을 읽어 판정한다)는 불변 · 읽는 자리만 바뀌었다. */
    const src = read(CAPABILITY);
    expect(src).toMatch(/workspaceMember|workspace[^]{0,40}plan/);
  });

  it("판정 함수 import + 호출 (라우트가 직접 정책을 비교하지 않는다)", () => {
    /* 승계 §approval-gate-single-source — 구 판본은 **정책만** 봤고, 라우트는 결재자 부재로도 400 을 낸다.
       prod(ADMIN 0)에서 화면이 CTA 를 보여주고 누르면 400 이 나는 자리였다.
       명제(서버가 계산해서 내려준다)는 불변이고, 판정이 라우트와 **같은 함수**가 됐다.
       판정축 전량은 regression/approval-gate-single-source.test.ts 가 든다. */
    const src = read(ROUTE);
    expect(src).toMatch(/resolveApprovalCapability\(session\.user\.id\)/);
    expect(src).not.toMatch(/resolveApprovalPolicyForPlan\(/);
  });

  it("in_app_approval 검사는 판정 모듈이 한다 (조건 중 하나)", () => {
    // 승계 §approval-gate-single-source — 검사 자체는 살아 있다. 사는 곳이 바뀌었다.
    const src = read("src/lib/approval/approval-capability.ts");
    expect(src).toMatch(/===[^]{0,20}"in_app_approval"/);
  });

  it("internalApprovalStatus === 'NOT_REQUIRED' 검사 명시 (3 조건 중 하나)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/internalApprovalStatus\s*===?\s*["']NOT_REQUIRED["']|["']NOT_REQUIRED["']/);
  });

  it("§11.209d-mobile-request-approval-cta 코멘트 명시 (drift 차단)", () => {
    const src = read(ROUTE);
    // 의도적 주석 인용 — 이 단언은 소스 **주석의 출처 태그**를 문다(주석이 사라지면 RED 가 맞다). §comment-axis 2026-09-21 조사에서 무효 아님으로 분류됨.
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
    // 의도적 주석 인용 — 이 단언은 소스 **주석의 출처 태그**를 문다(주석이 사라지면 RED 가 맞다). §comment-axis 2026-09-21 조사에서 무효 아님으로 분류됨.
    expect(src).toMatch(/§11\.209d-mobile-request-approval-cta|11\.209d-mobile-request-approval-cta/);
  });
});
