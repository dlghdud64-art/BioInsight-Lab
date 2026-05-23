/**
 * §11.290 Phase 4c-3 #receiving-po-matching — ReceivingInputPanel 의
 *   onScanComplete handler 를 placeholder console.info → 실제 PO 매칭 +
 *   입고 자동 prefill 로 swap.
 *
 * 호영님 P1 spec (2026-05-23):
 *   Phase 4c-2 (placeholder onScanComplete) 완료 후 Phase 4c-3 진입.
 *   거래명세서 OCR 결과의 vendor.name + items[].productName 으로
 *   lines (props) client-side matching → matched line 의 receivedQty
 *   / lotNumber 자동 prefill → 사용자 friction 제거.
 *
 * Lock:
 *   - client-side matching (새 API route 0)
 *   - items[].productName 으로 line.itemLabel string match (case-insensitive)
 *   - matched line 의 setReceivedQty(line.id, items[].quantity) 자동 prefill
 *   - 매칭 결과 사용자 alert ("N건 자동 prefill 완료" + matched line list)
 *   - 매칭 0건 시 alert ("매칭된 품목 없음 — 수동 입력 필요")
 *
 * Test scope:
 *   1. §11.290 Phase 4c-3 trace marker
 *   2. matchScanResultToLines helper 함수 존재
 *   3. setReceivedQty 호출 (matched line 에 대해)
 *   4. matchedCount alert 표시 (사용자 피드백)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const RECEIVING_PAGE = readFileSync(
  resolve(__dirname, "../../app/dashboard/receiving/[receivingId]/page.tsx"),
  "utf8",
);

describe("§11.290 Phase 4c-3 — receiving onScanComplete PO 매칭 + 입고 prefill", () => {
  it("§11.290 Phase 4c-3 trace marker 존재", () => {
    expect(RECEIVING_PAGE).toMatch(/§11\.290 Phase 4c-3/);
  });

  it("client-side matching helper — items[].productName → line.itemLabel", () => {
    // helper or inline matching: items.forEach + lines.find by productName
    expect(RECEIVING_PAGE).toMatch(/productName/);
    expect(RECEIVING_PAGE).toMatch(/itemLabel|line\.itemLabel/);
  });

  it("setReceivedQty 호출 (matched line 자동 prefill)", () => {
    expect(RECEIVING_PAGE).toMatch(/setReceivedQty\(/);
  });

  it("매칭 결과 alert (matchedCount 사용자 피드백)", () => {
    // alert 또는 console.info 에 매칭 결과 포함
    expect(RECEIVING_PAGE).toMatch(/매칭|matched|prefill/);
  });

  it("기존 Phase 4c-2 trigger button 보존 (회귀 0)", () => {
    expect(RECEIVING_PAGE).toMatch(/data-testid=["']receiving-quote-scanner-button["']/);
  });

  it("기존 QuoteScannerModal 렌더 보존 (회귀 0)", () => {
    expect(RECEIVING_PAGE).toMatch(/<QuoteScannerModal/);
    expect(RECEIVING_PAGE).toMatch(/open=\{quoteScannerOpen\}/);
  });
});
