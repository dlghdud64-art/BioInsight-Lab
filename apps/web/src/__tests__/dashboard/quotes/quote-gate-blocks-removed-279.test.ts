/**
 * §11.279 #quote-gate-blocks-removed — 견적 관리 게이트 + 발송 전 확인 블록 전면 제거.
 *
 * 호영님 P0 spec (대화 메시지, 2026-05-21):
 *   "공급사 발송 게이트" + "발송 전 확인" 두 블록이 거의 동일 정보 4~5회 반복.
 *   데스크톱 화면 60%+ 점유. 발송 진입은 개별 견적 카드의 직접 [발송] button (1 tap) 으로
 *   이동. helper data dead cleanup. land 순서: §11.279d (카드 button) → §11.279a/b (section
 *   unmount) → §11.279e (helper cleanup).
 *
 * Truth Reconciliation:
 *   - §11.272b/§11.272c/§11.274b/§11.275 가 부분 fix, 게이트 블록 자체 잔존
 *   - STATE_PROFILE (line 175-244) + VendorRequestModal (line 4368) = canonical truth 보존
 *   - 카드 [발송] button onClick → setActiveWorkWindow('request_send') 직접 호출 (1 tap)
 *   - rail panel primary CTA 보존 (deep dive 보조 entry)
 *
 * Sub-spec breakdown:
 *   §11.279a — quote-dispatch-verification-summary section unmount (line ~2218-2480)
 *   §11.279b — quote-dispatch-fixed-flow section unmount (line ~2513-2570)
 *   §11.279d — QuoteCard request_not_sent 분기 직접 [발송] button + e.stopPropagation
 *   §11.279e — line 1740-1806 helper data (supplier valid / contact valid / sent tracking) cleanup
 *
 * Invariant 보존 (canonical truth):
 *   - STATE_PROFILE 9 entries (request_not_sent ~ ready_for_po_conversion)
 *   - VendorRequestModal mount (activeWorkWindow === "request_send" branch)
 *   - openQuoteDraftWorkbench function + 2 header button mirror (line 2121 / 2157)
 *   - BatchDispatchSheet mount
 *   - 헤더 액션 button 4종 (견적서 파싱 / 견적서 비교 / 견적 요청 초안 만들기 / 새 견적 요청)
 *   - §11.272b mobile-banner (sm:hidden + dispatchableCount > 0 + 발송하기)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(
  resolve(__dirname, "../../../app/dashboard/quotes/page.tsx"),
  "utf8",
);

describe("§11.279a — quote-dispatch-verification-summary section unmount", () => {
  it("§11.279 trace marker comment 존재", () => {
    expect(PAGE).toMatch(/§11\.279/);
  });

  it("data-testid=\"quote-dispatch-verification-summary\" 부재 (section 제거)", () => {
    expect(PAGE).not.toMatch(/data-testid="quote-dispatch-verification-summary"/);
  });

  it("eyebrow \"공급사 발송 게이트\" 부재 (§11.274b 영문 잔존 자동 cleanup)", () => {
    expect(PAGE).not.toMatch(/공급사 발송 게이트/);
  });

  it("aria-label \"견적 발송 전 수신자 검증 요약\" 부재", () => {
    expect(PAGE).not.toMatch(/aria-label="견적 발송 전 수신자 검증 요약"/);
  });

  it("data-testid=\"quote-dispatch-summary-send-cta\" 부재 (게이트 안 button)", () => {
    expect(PAGE).not.toMatch(/data-testid="quote-dispatch-summary-send-cta"/);
  });
});

describe("§11.279b — quote-dispatch-fixed-flow section unmount", () => {
  it("data-testid=\"quote-dispatch-fixed-flow\" 부재 (section 제거)", () => {
    expect(PAGE).not.toMatch(/data-testid="quote-dispatch-fixed-flow"/);
  });

  it("aria-label \"견적 발송 전 확인 4단계\" 부재", () => {
    expect(PAGE).not.toMatch(/aria-label="견적 발송 전 확인 4단계"/);
  });

  it("eyebrow \"발송 전 확인\" 부재", () => {
    expect(PAGE).not.toMatch(/>발송 전 확인</);
  });
});

describe("§11.279d — QuoteCard request_not_sent 분기 직접 [발송] button", () => {
  it("§11.279d trace marker comment 존재", () => {
    expect(PAGE).toMatch(/§11\.279d/);
  });

  it("카드 안 직접 [발송] button data-testid 존재", () => {
    // data-testid 는 conditional: ctaLabel === "견적 요청 발송" ? "quote-card-direct-send-cta" : undefined
    expect(PAGE).toMatch(/"quote-card-direct-send-cta"/);
  });

  it("[발송] button onClick 안에 e.stopPropagation 호출 (카드 click 동시 발생 차단)", () => {
    // button onClick: (e) => { e.stopPropagation(); onSelect?.(signals.ctaLabel); }
    // 카드 wrapper div 의 onClick: (e) => e.stopPropagation() 로 이중 차단
    expect(PAGE).toMatch(/"quote-card-direct-send-cta"[\s\S]{0,300}e\.stopPropagation\(\)/);
  });

  it("handleQuoteCardSelect ctaLabel === '견적 요청 발송' → setActiveWorkWindow('request_send') 직진 (VendorRequestModal)", () => {
    // §11.279d — 카드 CTA 클릭 → handleQuoteCardSelect(quoteId, ctaLabel) →
    //   ctaLabel === "견적 요청 발송" 분기에서 setActiveWorkWindow("request_send") 직접 호출
    expect(PAGE).toMatch(
      /ctaLabel === "견적 요청 발송"[\s\S]{0,200}setActiveWorkWindow\(["']request_send["']\)/,
    );
  });

  it("[발송] button visible label — STATE_PROFILE ctaLabel '견적 요청 발송' 한글 보존 (§11.142 lock)", () => {
    // button 은 {signals.ctaLabel} 렌더링. request_not_sent 상태에서 "견적 요청 발송" 출력.
    expect(PAGE).toMatch(/ctaLabel:\s*"견적 요청 발송"/);
  });
});

describe("§11.279e — helper data dead code cleanup", () => {
  it("영문 \"supplier valid\" 잔존 0 (helper data line 1740-1741 cleanup)", () => {
    expect(PAGE).not.toMatch(/supplier valid:/);
  });

  it("영문 \"contact valid\" 잔존 0 (helper data line 1748-1749 cleanup)", () => {
    expect(PAGE).not.toMatch(/contact valid:/);
  });

  it("영문 \"sent tracking\" 잔존 0 (helper data line 1806 + section 안 line 2406 cleanup)", () => {
    expect(PAGE).not.toMatch(/sent tracking/);
  });

  it("영문 \"Send to supplier\" 잔존 0 (section 제거로 line 2247/2278/2558 cleanup)", () => {
    expect(PAGE).not.toMatch(/Send to supplier/);
  });

  it("primaryDispatchValidityBadges helper 정의 부재 (verification-summary 전용 dead)", () => {
    // §11.279e — helper 정의 자체 부재. trace marker comment 안 단어 언급은 ADR
    //   lineage 용으로 허용 (canonical truth lock 정합).
    expect(PAGE).not.toMatch(/const primaryDispatchValidityBadges\s*=\s*useMemo/);
  });
});

describe("§11.279 — invariant 보존 (canonical truth)", () => {
  it("STATE_PROFILE request_not_sent ctaLabel \"견적 요청 발송\" 보존", () => {
    expect(PAGE).toMatch(/ctaLabel:\s*"견적 요청 발송"/);
  });

  it("STATE_PROFILE awaiting_responses ctaLabel \"새 회신 보기\" 보존", () => {
    expect(PAGE).toMatch(/ctaLabel:\s*"새 회신 보기"/);
  });

  it("STATE_PROFILE 9 entries 보존 (deriveRailState matrix)", () => {
    expect(PAGE).toMatch(/request_not_sent:\s*\{/);
    expect(PAGE).toMatch(/awaiting_responses:\s*\{/);
    expect(PAGE).toMatch(/ready_for_po_conversion:\s*\{/);
  });

  it("VendorRequestModal mount (activeWorkWindow === \"request_send\") 보존", () => {
    expect(PAGE).toMatch(
      /activeWorkWindow === "request_send"[\s\S]{0,300}<VendorRequestModal/,
    );
  });

  it("openQuoteDraftWorkbench function 정의 보존 (헤더 액션 button)", () => {
    expect(PAGE).toMatch(/const openQuoteDraftWorkbench = useCallback/);
  });

  it("헤더 \"견적 요청 초안 만들기\" button 2 spot 보존 (data-testid + 모바일 더보기)", () => {
    expect(PAGE).toMatch(/data-testid="quote-draft-workbench-cta"/);
    expect(PAGE).toMatch(/견적 요청 초안 만들기/);
  });

  it("헤더 \"새 견적 요청\" button 보존 (PermissionGate quotes.create)", () => {
    expect(PAGE).toMatch(/새 견적 요청/);
    expect(PAGE).toMatch(/PermissionGate permission="quotes\.create"/);
  });

  it("헤더 \"견적서 비교\" button 보존 (runAiQuoteCompare)", () => {
    expect(PAGE).toMatch(/견적서 비교/);
    expect(PAGE).toMatch(/runAiQuoteCompare/);
  });

  it("BatchDispatchSheet mount 보존 (일괄 발송 surface)", () => {
    expect(PAGE).toMatch(/<BatchDispatchSheet/);
  });

  it("§11.272b mobile-banner (sm:hidden + dispatchableCount > 0) 보존", () => {
    expect(PAGE).toMatch(/data-testid="quote-dispatch-mobile-banner"/);
    expect(PAGE).toMatch(
      /data-testid="quote-dispatch-mobile-banner"[\s\S]{0,500}sm:hidden/,
    );
    expect(PAGE).toMatch(/dispatchableCount > 0/);
  });

  it("rail panel primary CTA (selectedSignals.railCtaLabel) 보존 — 보조 entry", () => {
    expect(PAGE).toMatch(/selectedSignals\.railCtaLabel/);
  });

  // §11.279e-cont-2 — primaryDispatchEvidence + Preflight + Quote 10 helper 전부
  //   transitively dead 로 § 11.279e-cont-2 batch 에서 일괄 제거. 본 invariant 는 정합 제거.
  //   대체 sentinel: quote-dispatch-primary-helpers-removed-279e-cont-2.test.ts (Phase 1 RED).
});
