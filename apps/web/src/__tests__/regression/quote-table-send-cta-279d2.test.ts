/**
 * §11.279d-2 #quote-table-send-cta-modal-wiring — 호영님 P0 회귀 fix.
 *
 * 호영님 P0 (2026-05-24):
 *   견적 관리 테이블 뷰 "발송" 버튼 → 운영 브리핑 패널 토글만
 *   (껐다 켜졌다 반복) → 발송 워크플로우 진입 안 됨.
 *
 * Root cause (Phase 0 audit):
 *   line 3017-3027 테이블 row actions cell button onClick 이 모든
 *   ctaLabel (발송 포함) 에 대해 openQuoteContextRail 직접 호출.
 *   §11.279d 카드 [발송] CTA 의 handleQuoteCardSelect 분기 ("견적
 *   요청 발송" → setActiveWorkWindow("request_send")) 를 거치지 않음.
 *
 * Fix: 테이블 row button onClick 에서 handleQuoteCardSelect(quote.id,
 *   signals.ctaLabel) 재사용. 카드/테이블 일관성 정합.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(
  resolve(__dirname, "../../app/dashboard/quotes/page.tsx"),
  "utf8",
);

describe("§11.279d-2 — 테이블 뷰 발송 버튼 모달 wiring", () => {
  it("§11.279d-2 trace marker + 회귀 fix comment", () => {
    expect(PAGE).toMatch(/§11\.279d-2/);
    expect(PAGE).toMatch(/quote-table-direct-send-cta|VendorRequestModal 직접 진입/);
  });

  it("테이블 row button onClick 이 handleQuoteCardSelect 재사용", () => {
    expect(PAGE).toMatch(
      /handleQuoteCardSelect\(quote\.id,\s*signals\.ctaLabel\)/,
    );
  });

  it("테이블 row button data-testid='quote-table-direct-send-cta' (발송 시만)", () => {
    expect(PAGE).toMatch(
      /data-testid=\{signals\.ctaLabel === "견적 요청 발송" \? "quote-table-direct-send-cta" : undefined\}/,
    );
  });

  it("handleQuoteCardSelect 분기 — '견적 요청 발송' → 발송 인텐트(2-step) 게이트 (§quote-management-redesign P2)", () => {
    // 진화: 분기 보존(패널 토글 회귀 0) + 1-tap 직접 발송이 인텐트 모달 경유로 오발송 방지.
    //   워크플로우 진입(request_send)은 인텐트 "발송 검토 계속"에서 setSelectedQuoteId 동반 보존.
    expect(PAGE).toMatch(/if \(ctaLabel === "견적 요청 발송"\)/);
    expect(PAGE).toMatch(/setSendIntentQuoteId\(quoteId\)/);
    expect(PAGE).toMatch(/quote-send-intent-continue[\s\S]{0,200}setActiveWorkWindow\("request_send"\)/);
    expect(PAGE).toMatch(/setSelectedQuoteId\(sendIntentQuoteId\)/);
  });

  it("§11.279d 카드 [발송] CTA wiring 보존 (회귀 0)", () => {
    expect(PAGE).toMatch(/data-testid=\{signals\.ctaLabel === "견적 요청 발송" \? "quote-card-direct-send-cta" : undefined\}/);
    expect(PAGE).toMatch(/onSelect\?\.\(signals\.ctaLabel\)/);
  });

  it("e.stopPropagation — 행 클릭(패널 토글) vs 버튼 클릭(모달) 이벤트 분리 보존", () => {
    // 테이블 row button 의 onClick 에서 stopPropagation
    expect(PAGE).toMatch(/e\.stopPropagation\(\)[\s\S]{0,300}handleQuoteCardSelect/);
  });

  it("openQuoteContextRail 호출은 다른 CTA (새 회신 보기 등) 에서만 (기존 분기 보존)", () => {
    // handleQuoteCardSelect 안에서 발송 외 CTA 는 openQuoteContextRail 호출
    expect(PAGE).toMatch(/openQuoteContextRail\(quoteId,\s*"row"\)/);
  });
});
