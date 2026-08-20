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

  it("handleQuoteCardSelect ctaLabel === '견적 요청 발송' → 발송 인텐트(2-step) 게이트 (§quote-management-redesign P2)", () => {
    // §11.279d → §quote-management-redesign P2 진화: 1-tap 직접 발송이 패널 토글 회귀 없이
    //   발송 워크플로우로 진입하되, 오발송 방지 위해 ConfirmSendModal(인텐트) 2-step 경유.
    //   보호의도(발송 워크플로우 진입·토글 회귀 금지) 불변, 진입 경로만 인텐트 게이트로 진화.
    expect(PAGE).toMatch(
      /ctaLabel === "견적 요청 발송"[\s\S]{0,260}setSendIntentQuoteId\(quoteId\)/,
    );
    // 워크플로우 진입(request_send)은 인텐트 "발송 검토 계속"에서 보존.
    expect(PAGE).toMatch(
      /quote-send-intent-continue[\s\S]{0,200}setActiveWorkWindow\(["']request_send["']\)/,
    );
  });

  it("[발송] button visible label — STATE_PROFILE ctaLabel '견적 요청 발송' 한글 보존 (§11.142 lock)", () => {
    // button 은 {signals.ctaLabel} 렌더링. request_not_sent 상태에서 "견적 요청 발송" 출력.
    expect(PAGE).toMatch(/ctaLabel:\s*"견적 요청 발송"/);
  });
});

/**
 * §11.279-holes — 은퇴한 sentinel 이 잠그던 자리를 승계한다 (2026-08-19)
 *
 * (나) 갈래. §11.279 계열 sentinel 을 은퇴시키면서 **아무도 안 잠그던 9토큰**이 드러났다.
 * 은퇴만 하면 그 자리가 무잠금이 되므로 같은 커밋에서 메운다(#1·#3 과 같은 처리).
 *
 * 🛑 잠그기 전에 **토큰별로** 소스 부재를 재확인했다. 묶어서 잠그지 않는다 —
 *    같은 4단계 라벨이라도 `1.`·`2.` 는 제거됐고 `3.`·`4.` 는 **살아 있다**(L3609 등).
 *    묶었으면 살아 있는 라벨의 제거를 고정해 결함을 계약으로 만들 뻔했다.
 *
 * ⚠️ `isCompareReviewZero` 는 여기 없다 — 제거 커밋이 170222b3(§quote-flat KPI-dedup)로
 *    **원인이 다르다.** 이 배치는 fd86d1c4 계열만 다룬다.
 */
describe("§11.279-holes — 제거된 dispatch 표면 재유입 차단", () => {
  const GONE: ReadonlyArray<[string, string]> = [
    ["three-cell summary", "data-testid=\"quote-dispatch-three-cell-summary\""],
    ["visible block reason", "data-testid=\"quote-dispatch-visible-block-reason\""],
    ["independent state chips", "data-testid=\"quote-dispatch-independent-state-chips\""],
    ["tracking row", "data-testid=\"quote-dispatch-tracking-row\""],
    ["send cta", "data-testid=\"quote-dispatch-send-cta\""],
    ["readiness badges", "data-testid=\"quote-dispatch-readiness-badges\""],
    ["primaryDispatchBadges helper", "primaryDispatchBadges"],
    ["4단계 라벨 1", "1. 공급사 선택"],
    ["4단계 라벨 2", "2. 연락처 확인"],
  ];

  for (const [label, token] of GONE) {
    it(`${label} 재유입 0`, () => {
      expect(PAGE).not.toContain(token);
    });
  }

  it("🛑 앵커 유일성 — PAGE 를 실제로 읽었다 (공허 통과 방지)", () => {
    /* 위 단언은 전부 부정형이라 PAGE 가 빈 문자열이어도 통과한다. */
    expect(PAGE.length).toBeGreaterThan(100000);
    expect(PAGE).toContain("use client");
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
