/**
 * §11.279f #quote-dispatch-desktop-banner — 데스크탑 (sm+) "📨 발송 준비 완료 N건 [일괄 발송]"
 *   1줄 배너 신규 (호영님 P0 spec, §11.279 후속, dispatchableCount > 0 조건부).
 *
 * 호영님 spec (§11.279 ADR-002 Out-of-scope, §11.279f 후속 sprint):
 *   상단 "📨 발송 준비 완료 N건 [일괄 발송]" 1줄 배너 신규.
 *   - dispatchableCount > 0 조건부 (0건 = 배너 자체 unmount)
 *   - [일괄 발송] click → setBatchSheetOpen(true) → BatchDispatchSheet 직진
 *   - 데스크탑 한정 (hidden sm:flex)
 *   - 모바일은 §11.272b 기존 배너 보존 (sm:hidden, openQuoteDraftWorkbench 진입)
 *
 * Fix (minimum diff, 1 file 1 block prepend, byte-level CRLF preserved swap):
 *   §11.272b 모바일 배너 (line ~2184) 위에 데스크탑 배너 1 block (~17 line) prepend.
 *   - data-testid="quote-dispatch-desktop-banner"
 *   - className: "hidden sm:flex items-center justify-between gap-3 rounded-lg
 *     border border-blue-200 bg-blue-50/80 px-4 py-3"
 *   - aria-label="발송 준비 완료 N건 일괄 발송"
 *   - 좌측: Send icon + "📨 발송 준비 완료 N건 · 공급사 전송 가능" (text-sm
 *     font-semibold text-blue-900)
 *   - 우측: Button "[일괄 발송]" (size="sm" h-9 bg-blue-600 hover:bg-blue-700
 *     text-white) onClick={() => setBatchSheetOpen(true)}
 *
 * canonical truth lock:
 *   - §11.272b 모바일 배너 (data-testid="quote-dispatch-mobile-banner",
 *     sm:hidden, openQuoteDraftWorkbench) 변경 0
 *   - BatchDispatchSheet mount 보존
 *   - dispatchableCount useMemo 로직 보존
 *   - BatchActionBar (selectedCount > 0) 보존
 *   - KPI grid (hidden sm:grid) 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(
  resolve(__dirname, "../../../app/dashboard/quotes/page.tsx"),
  "utf8",
);

describe("§11.279f — 데스크탑 발송 준비 배너 신규", () => {
  it("§11.279f trace marker comment 존재", () => {
    expect(PAGE).toMatch(/§11\.279f/);
  });

  it("data-testid=\"quote-dispatch-desktop-banner\" 존재", () => {
    expect(PAGE).toMatch(/data-testid="quote-dispatch-desktop-banner"/);
  });

  it("데스크탑 배너 hidden sm:flex (모바일 노출 0, 데스크탑만)", () => {
    expect(PAGE).toMatch(
      /data-testid="quote-dispatch-desktop-banner"[\s\S]{0,400}hidden sm:flex/,
    );
  });

  it("데스크탑 배너 dispatchableCount > 0 조건부 분기", () => {
    // 모바일 배너와 같은 분기 또는 별 분기 — dispatchableCount > 0 check 가 데스크탑 배너 directly 또는 surrounding wrapper 안에 존재
    expect(PAGE).toMatch(
      /dispatchableCount > 0[\s\S]{0,800}data-testid="quote-dispatch-desktop-banner"/,
    );
  });

  it("데스크탑 배너 한글 라벨 \"발송 준비\" + dispatchableCount 인터폴레이션", () => {
    expect(PAGE).toMatch(
      /data-testid="quote-dispatch-desktop-banner"[\s\S]{0,800}발송 준비/,
    );
    expect(PAGE).toMatch(
      /data-testid="quote-dispatch-desktop-banner"[\s\S]{0,800}\{dispatchableCount\}/,
    );
  });

  it("데스크탑 배너 [일괄 발송] button 한글 라벨", () => {
    expect(PAGE).toMatch(
      /data-testid="quote-dispatch-desktop-banner"[\s\S]{0,1200}일괄 발송/,
    );
  });

  it("데스크탑 배너 onClick → setBatchSheetOpen(true) (BatchDispatchSheet 직진)", () => {
    expect(PAGE).toMatch(
      /data-testid="quote-dispatch-desktop-banner"[\s\S]{0,1500}setBatchSheetOpen\(true\)/,
    );
  });

  it("데스크탑 배너 aria-label 한글 (a11y)", () => {
    // aria-label 는 string literal ("...") 또는 backtick template (`...`) 둘 다 허용
    expect(PAGE).toMatch(
      /data-testid="quote-dispatch-desktop-banner"[\s\S]{0,400}aria-label=(?:"[^"]*발송[^"]*"|\{`[^`]*발송[^`]*`\})/,
    );
  });
});

describe("§11.279f — invariant 보존 (canonical truth)", () => {
  it("§11.272b 모바일 배너 (data-testid=\"quote-dispatch-mobile-banner\") 보존", () => {
    expect(PAGE).toMatch(/data-testid="quote-dispatch-mobile-banner"/);
    expect(PAGE).toMatch(
      /data-testid="quote-dispatch-mobile-banner"[\s\S]{0,400}sm:hidden/,
    );
  });

  it("§11.272b 모바일 배너 onClick → openQuoteDraftWorkbench 보존 (워크벤치 진입)", () => {
    expect(PAGE).toMatch(
      /data-testid="quote-dispatch-mobile-banner"[\s\S]{0,1500}openQuoteDraftWorkbench/,
    );
  });

  it("BatchDispatchSheet mount 보존", () => {
    expect(PAGE).toMatch(/<BatchDispatchSheet/);
  });

  it("dispatchableCount useMemo 로직 보존 (canonical 계산)", () => {
    expect(PAGE).toMatch(
      /const \{ dispatchableCount, hardBlockCount \} = useMemo/,
    );
  });

  it("BatchActionBar mount 보존 (selectedCount > 0 entry)", () => {
    expect(PAGE).toMatch(/<BatchActionBar/);
  });

  it("KPI grid (hidden sm:grid) 제거 유지 (§quote-flat KPI-dedup — 퍼널 단일 surface, §11.272c/§11.374 retire 정합)", () => {
    // §quote-flat KPI-dedup(호영님 2026-06-21): 데스크탑 KPI grid 제거 — 퍼널(§quote-management P2)이
    //   canonical 단계 카운트 단일 surface. 279f 의 KPI-grid cross-guard 를 '존재 보존' → '제거 유지'
    //   부재-lock 으로 진화(272c/272c-2/259a/§11.374 와 동일 KPI-grid family). dispatch banner 본연 단언은 불변.
    expect(PAGE).not.toMatch(/hidden sm:grid sm:overflow-visible/);
  });

  it("STATE_PROFILE 9 entries 보존 (canonical truth)", () => {
    expect(PAGE).toMatch(/request_not_sent:\s*\{/);
    expect(PAGE).toMatch(/awaiting_responses:\s*\{/);
    expect(PAGE).toMatch(/ready_for_po_conversion:\s*\{/);
  });

  it("§11.279d 카드 직접 [발송] CTA (data-testid=\"quote-card-direct-send-cta\") 보존", () => {
    expect(PAGE).toMatch(/"quote-card-direct-send-cta"/);
  });
});
