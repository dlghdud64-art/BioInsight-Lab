/**
 * #dashboard-quote-dispatch-card-evidence
 *
 * §11.308d-2 (호영님 P2 옵션 A, 2026-05-28) — 견적 발송 카드 재설계 후 evidence.
 *   기존: dashboard 카드 안에서 발송 플로우(공급사/연락처/미리보기/전송)를
 *   시뮬레이션 + 영구 비활 Send + 정적 state-matrix.
 *   문제: 대시보드 카드는 집계 count 만 보유 — 개별 견적 발송 준비 상태를
 *   알 수 없고, 실제 발송은 견적 워크벤치(/dashboard/quotes)에서 일어남.
 *   → 재설계: 펼침 = 발송 대기 요약 1줄 + "견적 워크벤치 열기" 진입 CTA.
 *   canonical truth: 카드 = count display-only, 발송 truth = 워크벤치 소유.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const QUICK_ACTIONS_PATH = resolve(
  __dirname,
  "../../components/dashboard/operator-quick-actions.tsx",
);
const quickActions = readFileSync(QUICK_ACTIONS_PATH, "utf8");

describe("§11.308d-2 — 견적 발송 카드 요약 + 워크벤치 진입", () => {
  it("dispatch 카드 + progressive disclosure 보존", () => {
    expect(quickActions).toContain("dashboard-quote-dispatch-card");
    expect(quickActions).toMatch(/isQuoteDispatchExpanded/);
    expect(quickActions).toMatch(/setIsQuoteDispatchExpanded/);
  });

  it("펼친 상태 = 발송 대기 요약 블록 (summary)", () => {
    expect(quickActions).toContain("dashboard-quote-dispatch-summary");
    expect(quickActions).toMatch(/발송 대기/);
    // 발송 대기 0건 empty state 도 정직하게 표시
    expect(quickActions).toMatch(/발송 대기 중인 견적이 없습니다/);
  });

  it("단일 primary CTA = 견적 워크벤치 진입 (real route, dead button 0)", () => {
    expect(quickActions).toContain("dashboard-quote-dispatch-primary-cta");
    expect(quickActions).toMatch(/견적 워크벤치 열기/);
    expect(quickActions).toMatch(/href="\/dashboard\/quotes\?labaxisPilot=quote-dispatch"/);
    expect(quickActions).toContain("bg-blue-600");
    expect(quickActions).toContain("hover:bg-blue-700");
  });

  it("CTA 는 항상 활성 — 영구 비활(aria-disabled/opacity) 제거", () => {
    // §11.308d-2 — 카드가 알 수 없는 readiness 로 Send 를 영구 비활시키던 anti-pattern 제거.
    expect(quickActions).not.toContain("aria-disabled={!canSendToSupplier}");
    expect(quickActions).not.toContain("pointer-events-none opacity-60");
    expect(quickActions).not.toMatch(/canSendToSupplier/);
  });

  it("canonical truth — in-card 발송 플로우 시뮬레이션 제거 (워크벤치 소유)", () => {
    // 정적 state-matrix / preview-tracking / contact-warning / step grid 모두 제거
    expect(quickActions).not.toContain("dashboard-quote-dispatch-state-matrix");
    expect(quickActions).not.toContain("dashboard-quote-dispatch-preview-tracking");
    expect(quickActions).not.toContain("dashboard-quote-dispatch-contact-warning");
    expect(quickActions).not.toContain("dashboard-quote-dispatch-stage");
    expect(quickActions).not.toContain("dashboard-quote-dispatch-readiness");
    // QA 메모형 문구 제거
    expect(quickActions).not.toContain("발송 후 새로고침에도 dispatch 이벤트 추적");
    // 미사용 readiness prop/타입 제거
    expect(quickActions).not.toMatch(/quoteDispatchReadiness/);
    expect(quickActions).not.toMatch(/OperatorQuickActionsQuoteDispatchReadiness/);
  });

  it("접기 CTA 보존 (progressive disclosure toggle)", () => {
    expect(quickActions).toMatch(/aria-label="견적 발송 카드 접기"/);
    expect(quickActions).toContain("접기");
  });
});
