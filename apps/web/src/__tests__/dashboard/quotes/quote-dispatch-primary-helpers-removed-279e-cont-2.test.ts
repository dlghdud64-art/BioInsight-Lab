/**
 * §11.279e-cont-2 #quote-dispatch-primary-helpers-removed — primaryDispatch* helper 정의 전면
 *   cleanup (§11.279 cluster final cleanup, P1 sprint).
 *
 * 호영님 결정 (2026-05-22): "완전 cleanup (10 helper)" — §11.279 cluster 가 §11.279a/b
 *   section unmount + §11.279e validity/lifecycle 2 helper 제거 했으나, 나머지 8 helper
 *   (primaryDispatchTracking + StateChips + LifecycleStage + ReasonState + FixedReasonChips
 *   + Badges + SummaryCells) 정의는 잔존. caller 0 (각 helper 가 다른 dead helper 안에서만
 *   참조). primaryDispatchQuote / Preflight / Evidence 도 dead 7 helper 안에서만 참조
 *   → transitively dead.
 *
 *   결정: 10 helper 모두 제거 (Quote / Preflight / Evidence + 7 dead helper).
 *   §11.279 sentinel 의 primaryDispatchEvidence 보존 invariant 도 정합 제거.
 *
 * Fix (minimum diff, 1 file 1 block 제거, byte-level Python swap):
 *   apps/web/src/app/dashboard/quotes/page.tsx line 1702-1828 = 127 line 일괄 제거.
 *
 * canonical truth 보존:
 *   - STATE_PROFILE 9 entries 보존
 *   - VendorRequestModal mount 보존
 *   - openQuoteDraftWorkbench + 헤더 액션 button 4종 보존
 *   - BatchDispatchSheet mount 보존
 *   - §11.272b 모바일 배너 + §11.279f 데스크탑 배너 보존
 *   - §11.279d 카드 [발송] CTA 보존
 *   - dispatchableCount useMemo 보존 (별 helper, primaryDispatch* 와 무관)
 *   - 선택된 quote 의 dispatch validity 계산은 BatchDispatchSheet / VendorRequestModal
 *     내부 로직이 직접 수행 (primaryDispatch* helper 외부 사용처 없음)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(
  resolve(__dirname, "../../../app/dashboard/quotes/page.tsx"),
  "utf8",
);

describe("§11.279e-cont-2 — primaryDispatch* helper 10개 정의 전면 제거", () => {
  it("§11.279e-cont-2 trace marker comment 존재", () => {
    expect(PAGE).toMatch(/§11\.279e-cont-2/);
  });

  it("primaryDispatchQuote useMemo 정의 부재", () => {
    expect(PAGE).not.toMatch(/const primaryDispatchQuote\s*=\s*useMemo/);
  });

  it("primaryDispatchPreflight useMemo 정의 부재", () => {
    expect(PAGE).not.toMatch(/const primaryDispatchPreflight\s*=\s*useMemo/);
  });

  it("primaryDispatchEvidence useMemo 정의 부재 (§11.279 sentinel 정합 제거)", () => {
    expect(PAGE).not.toMatch(/const primaryDispatchEvidence\s*=\s*useMemo/);
  });

  it("primaryDispatchTracking useMemo 정의 부재", () => {
    expect(PAGE).not.toMatch(/const primaryDispatchTracking\s*=\s*useMemo/);
  });

  it("primaryDispatchStateChips useMemo 정의 부재", () => {
    expect(PAGE).not.toMatch(/const primaryDispatchStateChips\s*=\s*useMemo/);
  });

  it("primaryDispatchLifecycleStage 정의 부재", () => {
    expect(PAGE).not.toMatch(/const primaryDispatchLifecycleStage\s*=/);
  });

  it("primaryDispatchReasonState 정의 부재", () => {
    expect(PAGE).not.toMatch(/const primaryDispatchReasonState\s*=/);
  });

  it("primaryDispatchFixedReasonChips useMemo 정의 부재", () => {
    expect(PAGE).not.toMatch(/const primaryDispatchFixedReasonChips\s*=\s*useMemo/);
  });

  it("primaryDispatchBadges useMemo 정의 부재", () => {
    expect(PAGE).not.toMatch(/const primaryDispatchBadges\s*=\s*useMemo/);
  });

  it("primaryDispatchSummaryCells useMemo 정의 부재", () => {
    expect(PAGE).not.toMatch(/const primaryDispatchSummaryCells\s*=\s*useMemo/);
  });

  it("primaryDispatch* 식별자 declaration 부재 (caller 0 = transitively dead 확인)", () => {
    // declaration 시점 차단 (const X = / let X = / var X =). comment 안 ADR lineage
    // 단어 언급은 허용 (예: §11.279 trace marker "primaryDispatchValidityBadges 등").
    expect(PAGE).not.toMatch(/\b(?:const|let|var)\s+primaryDispatch\w+\s*=/);
  });

  it("primaryDispatch* attribute 접근 부재 (X.supplierStatus 등 사용 0)", () => {
    // .supplierStatus / .contactStatus / .canSend / .hasSent 같은 helper 의 속성 접근
    expect(PAGE).not.toMatch(/\bprimaryDispatch\w+\.\w+/);
  });
});

describe("§11.279e-cont-2 — invariant 보존 (canonical truth)", () => {
  it("STATE_PROFILE 9 entries 보존", () => {
    expect(PAGE).toMatch(/request_not_sent:\s*\{/);
    expect(PAGE).toMatch(/awaiting_responses:\s*\{/);
    expect(PAGE).toMatch(/ready_for_po_conversion:\s*\{/);
  });

  it("VendorRequestModal mount 보존 (activeWorkWindow === \"request_send\")", () => {
    expect(PAGE).toMatch(
      /activeWorkWindow === "request_send"[\s\S]{0,300}<VendorRequestModal/,
    );
  });

  it("openQuoteDraftWorkbench function 정의 보존", () => {
    expect(PAGE).toMatch(/const openQuoteDraftWorkbench = useCallback/);
  });

  it("BatchDispatchSheet mount 보존", () => {
    expect(PAGE).toMatch(/<BatchDispatchSheet/);
  });

  it("§11.272b 모바일 배너 보존 (data-testid=\"quote-dispatch-mobile-banner\")", () => {
    expect(PAGE).toMatch(/data-testid="quote-dispatch-mobile-banner"/);
  });

  it("§11.279f 데스크탑 배너 보존 (data-testid=\"quote-dispatch-desktop-banner\")", () => {
    expect(PAGE).toMatch(/data-testid="quote-dispatch-desktop-banner"/);
  });

  it("§11.279d 카드 직접 [발송] CTA 보존", () => {
    expect(PAGE).toMatch(/"quote-card-direct-send-cta"/);
  });

  it("dispatchableCount useMemo 보존 (canonical 계산, primaryDispatch* 와 무관)", () => {
    expect(PAGE).toMatch(
      /const \{ dispatchableCount, hardBlockCount \} = useMemo/,
    );
  });

  it("getQuoteDispatchPreflight / Evidence / Tracking import 위치 변경 0 (BatchDispatch internal use 보존)", () => {
    // helper functions (getQuoteDispatch*) 자체는 lib 안에 보존 — BatchDispatchSheet /
    // VendorRequestModal 내부에서 직접 호출. import statement 도 보존.
    expect(PAGE).toMatch(/getQuoteDispatchPreflight/);
  });
});
