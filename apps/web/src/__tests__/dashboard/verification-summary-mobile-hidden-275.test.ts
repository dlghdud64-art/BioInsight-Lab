/**
 * §11.275 #verification-summary-mobile-hidden
 *   quote-dispatch-verification-summary section 모바일 hidden (호영님 P0)
 *
 * 호영님 보고: 견적 관리 페이지 SEND TO SUPPLIER GATE 블록이 모바일 80%+ 점유.
 * 검색/필터/견적 카드까지 2 스크롤 이상. Progressive Disclosure 부재.
 *
 * Root cause:
 *   7554e64d 신규 추가 quote-dispatch-verification-summary section (~140 line)
 *   이 모바일 hidden 분기 없이 mount → §11.272b fixed-flow section 과 동일
 *   카테고리지만 별도 land 되어 분기 누락.
 *
 * Fix (호영님 권장안 A, minimum diff, 1 file 1 spot):
 *   - section className 앞 hidden sm:block 추가
 *   - §11.272b fixed-flow 패턴 reuse
 *   - §11.272b mobile banner (sm:hidden + dispatchableCount > 0 + 발송하기)
 *     이미 land → 모바일 entry point 보존
 *
 * canonical truth lock (§11.142):
 *   - quote-dispatch-verification-summary + aria-label 보존
 *   - 공급사 발송 게이트 eyebrow (§11.274b) 보존
 *   - 수신자 선택 → 연락처 → 미리보기 → 발송 h2 보존
 *   - quote-dispatch-summary-send-cta + 공급사에 전송 (§11.274b) 보존
 *   - quote-dispatch-visible-block-reason + canSend/blockReason 보존
 *   - quote-dispatch-independent-state-chips + three-cell-summary + tracking-row 보존
 *   - primaryDispatchEvidence 6 field 보존
 *   - §11.272b mobile banner (quote-dispatch-mobile-banner) 보존
 *   - §11.272b fixed-flow (quote-dispatch-fixed-flow hidden sm:block) 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(
  __dirname,
  "../../app/dashboard/quotes/page.tsx"
);
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.275 #1 — verification-summary 모바일 hidden 적용", () => {
  it("§11.275 trace marker comment 존재", () => {
    expect(page).toMatch(/§11\.275/);
  });

  it("quote-dispatch-verification-summary section hidden sm:block 적용", () => {
    expect(page).toMatch(
      /data-testid="quote-dispatch-verification-summary"[\s\S]{0,100}hidden sm:block/
    );
  });

  it("§11.272b fixed-flow 도 hidden sm:block 보존 (패턴 정합)", () => {
    expect(page).toMatch(
      /data-testid="quote-dispatch-fixed-flow"[\s\S]{0,100}hidden sm:block/
    );
  });

  it("§11.272b mobile banner (sm:hidden + dispatchableCount > 0) 보존", () => {
    expect(page).toContain('data-testid="quote-dispatch-mobile-banner"');
    expect(page).toMatch(/dispatchableCount > 0 && \(/);
  });
});

describe("§11.275 #2 — verification-summary section 구조 invariant 보존", () => {
  it("aria-label '견적 발송 전 수신자 검증 요약' 보존", () => {
    expect(page).toContain('aria-label="견적 발송 전 수신자 검증 요약"');
  });

  it("eyebrow '공급사 발송 게이트' (§11.274b) 보존", () => {
    expect(page).toContain("공급사 발송 게이트");
  });

  it("h2 '수신자 선택 → 연락처 확인 → 메시지 미리보기 → 발송' 보존", () => {
    expect(page).toContain("수신자 선택 → 연락처 확인 → 메시지 미리보기 → 발송");
  });

  it("quote-dispatch-summary-send-cta + '공급사에 전송' (§11.274b) 보존", () => {
    expect(page).toContain('data-testid="quote-dispatch-summary-send-cta"');
    expect(page).toMatch(
      /quote-dispatch-summary-send-cta[\s\S]{0,700}공급사에 전송/
    );
  });

  it("quote-dispatch-visible-block-reason + canSend/blockReason 보존", () => {
    expect(page).toContain('data-testid="quote-dispatch-visible-block-reason"');
    expect(page).toContain("primaryDispatchEvidence.canSend");
    expect(page).toContain("primaryDispatchEvidence.blockReason");
  });

  it("quote-dispatch-independent-state-chips 보존", () => {
    expect(page).toContain('data-testid="quote-dispatch-independent-state-chips"');
  });

  it("quote-dispatch-three-cell-summary 보존", () => {
    expect(page).toContain('data-testid="quote-dispatch-three-cell-summary"');
  });

  it("quote-dispatch-tracking-row 보존", () => {
    expect(page).toContain('data-testid="quote-dispatch-tracking-row"');
  });
});

describe("§11.275 #3 — primaryDispatchEvidence 6 field invariant 보존", () => {
  it("supplierStatus / contactStatus / previewStatus / sendStatus 보존", () => {
    expect(page).toContain("primaryDispatchEvidence.supplierStatus");
    expect(page).toContain("primaryDispatchEvidence.contactStatus");
    expect(page).toContain("primaryDispatchEvidence.previewStatus");
    expect(page).toContain("primaryDispatchEvidence.sendStatus");
  });

  it("blockReason / canSend 보존", () => {
    expect(page).toContain("primaryDispatchEvidence.blockReason");
    expect(page).toContain("primaryDispatchEvidence.canSend");
  });
});

describe("§11.275 #4 — §11.142 한국어 정합 lock", () => {
  it("Send icon (mr-1.5 h-4 w-4) 보존", () => {
    expect(page).toMatch(/<Send className="mr-1\.5 h-4 w-4"/);
  });

  it("min-h-[44px] touch target 보존 (send CTA)", () => {
    expect(page).toMatch(
      /quote-dispatch-summary-send-cta[\s\S]{0,200}min-h-\[44px\]/
    );
  });

  it("onClick openQuoteDraftWorkbench 보존", () => {
    expect(page).toContain("openQuoteDraftWorkbench");
  });

  it("sm:px-4 데스크탑 padding 보존", () => {
    expect(page).toMatch(
      /quote-dispatch-verification-summary[\s\S]{0,200}sm:px-4/
    );
  });

  it("발송하기 버튼 텍스트 (§11.272b mobile banner) 보존", () => {
    expect(page).toMatch(
      /quote-dispatch-mobile-banner[\s\S]{0,700}발송하기/
    );
  });
});
