/**
 * §quote-management-redesign P2 — 발송 인텐트(2-step) 확인 모달 (호영님 시안 정합)
 *   (PLAN: docs/plans/PLAN_quote-management-redesign.md Phase 2)
 *
 * 리스트 1-tap 직접 발송(§11.279d) → ConfirmSendModal(케이스 요약 + "아직 발송 안됨") →
 *   "발송 검토 계속" 시에만 VendorRequestModal(request_send) 진입 → 오발송 방지.
 *   honesty: 취소·계속 모두 실 동작(dead button 0), 공급사 0곳 = 정직 표기(가짜 0).
 *   canonical: computePriority(dd)·toSuppliers·getOpSignals 파생 재사용(중복 저장 0).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const PAGE = readFileSync(
  join(REPO_ROOT, "src/app/dashboard/quotes/page.tsx"),
  "utf8",
);

describe("§quote-management-redesign P2 — 발송 인텐트 게이트 wiring", () => {
  it("인텐트 state 정의(sendIntentQuoteId)", () => {
    expect(PAGE).toMatch(/const \[sendIntentQuoteId, setSendIntentQuoteId\] = useState<string \| null>\(null\)/);
  });
  it("1-tap 발송 CTA → 인텐트 게이트(직접 request_send 진입 아님)", () => {
    expect(PAGE).toMatch(/ctaLabel === "견적 요청 발송"[\s\S]{0,260}setSendIntentQuoteId\(quoteId\)/);
  });
  it("ConfirmSendModal 렌더 — 제목 + canonical 요약 파생(dd/suppliers/signals)", () => {
    expect(PAGE).toMatch(/sendIntentQuoteId && \(\(\) => \{/);
    expect(PAGE).toMatch(/견적 요청을 발송할까요\?/);
    expect(PAGE).toMatch(/computePriority\(intentCase\)\.dd/);
    expect(PAGE).toMatch(/toSuppliers\(intentQuote\.vendorRequests\)/);
    // getOpSignals 결과(intentSignals)의 canonical 요약 필드는 summary(= rail-meta headerSummary 매핑, L388 summary: m.headerSummary).
    //   원안 intentSignals.headerSummary 는 signals 객체에 없는 필드(빌드 타입 에러) → 올바른 필드 summary 로 정합. 요약 파생 보호의도 불변.
    expect(PAGE).toMatch(/intentSignals\.summary/);
  });
});

describe("§quote-management-redesign P2 — honesty(오발송 방지·dead button 0)", () => {
  it("'발송 검토 계속' → request_send 진입(워크플로우 보존)", () => {
    expect(PAGE).toMatch(/quote-send-intent-continue/);
    expect(PAGE).toMatch(/quote-send-intent-continue[\s\S]{0,200}setActiveWorkWindow\("request_send"\)/);
    expect(PAGE).toMatch(/setSelectedQuoteId\(sendIntentQuoteId\)/);
  });
  it("'취소' → 인텐트 닫힘(실 동작)", () => {
    expect(PAGE).toMatch(/onClick=\{\(\) => setSendIntentQuoteId\(null\)\}/);
  });
  it("공급사 0곳 = 정직 표기(가짜 0)", () => {
    expect(PAGE).toMatch(/미지정 — 발송 검토에서 추가/);
  });
});

describe("§quote-management-redesign P2 — 회귀 0(canonical send 단일점 보존)", () => {
  it("VendorRequestModal request_send 진입 보존", () => {
    expect(PAGE).toMatch(/activeWorkWindow === "request_send" && selectedQuote && \(\s*<VendorRequestModal/);
  });
  it("direct-send CTA testid 보존(카드/테이블)", () => {
    expect(PAGE).toMatch(/"quote-card-direct-send-cta"/);
    expect(PAGE).toMatch(/"quote-table-direct-send-cta"/);
  });
});
