/**
 * §11.290 Phase 4c-2 #receiving-quote-scanner-trigger — receiving page 에
 *   QuoteScannerModal trigger button 추가 (Phase 4c QuoteScannerModal 의 caller).
 *
 * 호영님 P1 spec (2026-05-23):
 *   Phase 4c (QuoteScannerModal skeleton land) 후 Phase 4c-2 진입.
 *   receiving/[receivingId]/page.tsx 의 ReceivingInputPanel 안에 trigger
 *   button + modal 렌더 추가. PO 매칭 풀스펙은 별도 batch.
 *
 * Lock:
 *   - minimum-diff — ReceivingInputPanel 안 button + state + modal 렌더만
 *   - onScanComplete handler 는 placeholder (console.log + state 저장)
 *   - PO 매칭 / 입고 자동 prefill 은 Phase 4c-3 별도
 *
 * Test scope:
 *   1. QuoteScannerModal import 존재
 *   2. quoteScannerOpen state 존재 (toggle)
 *   3. trigger button (data-testid="receiving-quote-scanner-button")
 *   4. QuoteScannerModal 렌더 (data-testid="quote-scanner-modal" mount)
 *   5. §11.290 Phase 4c-2 trace marker
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const RECEIVING_PAGE = readFileSync(
  resolve(__dirname, "../../app/dashboard/receiving/[receivingId]/page.tsx"),
  "utf8",
);

describe("§11.290 Phase 4c-2 — receiving page QuoteScannerModal trigger", () => {
  it("§11.290 Phase 4c-2 trace marker 존재", () => {
    expect(RECEIVING_PAGE).toMatch(/§11\.290 Phase 4c-2/);
  });

  it("QuoteScannerModal import 존재", () => {
    expect(RECEIVING_PAGE).toMatch(
      /QuoteScannerModal.*from.*["']@\/components\/inventory\/QuoteScannerModal["']/,
    );
  });

  it("quoteScannerOpen state 존재 (useState destructuring)", () => {
    expect(RECEIVING_PAGE).toMatch(/\[quoteScannerOpen,\s*setQuoteScannerOpen\]/);
    expect(RECEIVING_PAGE).toMatch(/setQuoteScannerOpen/);
  });

  it("trigger button data-testid 존재", () => {
    expect(RECEIVING_PAGE).toMatch(/data-testid=["']receiving-quote-scanner-button["']/);
  });

  it("QuoteScannerModal 렌더 (open + onOpenChange wiring)", () => {
    expect(RECEIVING_PAGE).toMatch(/<QuoteScannerModal/);
    expect(RECEIVING_PAGE).toMatch(/open=\{quoteScannerOpen\}/);
    expect(RECEIVING_PAGE).toMatch(/onOpenChange=\{setQuoteScannerOpen\}/);
  });

  it("onScanComplete handler 존재 (placeholder)", () => {
    expect(RECEIVING_PAGE).toMatch(/onScanComplete=/);
  });
});
