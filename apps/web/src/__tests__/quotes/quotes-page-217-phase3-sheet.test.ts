/**
 * §11.217 Phase 3 — BatchDispatchSheet regression guard
 *
 * Goal: review sheet 안 N quote summary + auto-resolved supplier (read-only) +
 *       공통 message + "전체 발송" → Promise.allSettled → 결과 합산 toast.
 *
 * canonical truth lock:
 *   - server endpoint 신설 0 — 기존 POST /api/quotes/[id]/vendor-requests 그대로.
 *   - resolveSuppliers (canonical helper) 결과를 read-only 표시.
 *   - Promise.allSettled (partial failure 수용) — all-or-nothing transaction 0.
 *   - onSuccess: refetch + clearSelection + sheet close.
 *   - hardBlock quote 별도 표시 + 단일 dispatch 안내 (page-per-feature 회피).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../app/dashboard/quotes/page.tsx");
const SHEET_PATH = resolve(
  __dirname,
  "../../components/quotes/dispatch/batch-dispatch-sheet.tsx",
);

describe("§11.217 Phase 3 — BatchDispatchSheet component file 존재", () => {
  it("batch-dispatch-sheet.tsx file 존재", () => {
    expect(existsSync(SHEET_PATH)).toBe(true);
  });
});

describe("§11.217 Phase 3 — BatchDispatchSheet component contract", () => {
  it("'use client' directive (hook + dialog + fetch)", () => {
    if (!existsSync(SHEET_PATH)) return;
    const source = readFileSync(SHEET_PATH, "utf8");
    expect(source).toMatch(/^["']use client["']/);
  });

  it("export BatchDispatchSheet", () => {
    if (!existsSync(SHEET_PATH)) return;
    const source = readFileSync(SHEET_PATH, "utf8");
    expect(source).toMatch(/export\s+(default\s+)?function\s+BatchDispatchSheet|export\s+function\s+BatchDispatchSheet/);
  });

  it("Dialog 컴포넌트 사용 (open/onOpenChange)", () => {
    if (!existsSync(SHEET_PATH)) return;
    const source = readFileSync(SHEET_PATH, "utf8");
    expect(source).toMatch(/<Dialog/);
    expect(source).toMatch(/onOpenChange/);
  });

  it("auto-resolved supplier read-only (resolveSuppliers helper 사용)", () => {
    if (!existsSync(SHEET_PATH)) return;
    const source = readFileSync(SHEET_PATH, "utf8");
    expect(source).toMatch(/resolveSuppliers/);
  });

  it("공통 message Textarea (per-quote message 0 — out of scope)", () => {
    if (!existsSync(SHEET_PATH)) return;
    const source = readFileSync(SHEET_PATH, "utf8");
    expect(source).toMatch(/Textarea|<textarea/);
    // canonical truth: per-quote message 부재 검증
    expect(source).not.toMatch(/per[-_]?quote[-_]?message|perQuoteMessage/i);
  });

  it("'전체 발송' primary CTA + disabled when dispatchable === 0", () => {
    if (!existsSync(SHEET_PATH)) return;
    const source = readFileSync(SHEET_PATH, "utf8");
    expect(source).toMatch(/전체 발송|일괄 발송/);
    expect(source).toMatch(/disabled.*dispatchable|dispatchable.*disabled|disabled=\{[^}]*0/s);
  });

  it("Promise.allSettled — partial failure 수용", () => {
    if (!existsSync(SHEET_PATH)) return;
    const source = readFileSync(SHEET_PATH, "utf8");
    expect(source).toMatch(/Promise\.allSettled/);
  });

  it("csrfFetch + /api/quotes/${id}/vendor-requests POST (canonical truth path)", () => {
    if (!existsSync(SHEET_PATH)) return;
    const source = readFileSync(SHEET_PATH, "utf8");
    expect(source).toMatch(/csrfFetch/);
    expect(source).toMatch(/\/api\/quotes\/.+\/vendor-requests/);
    expect(source).toMatch(/method:\s*["']POST["']/);
  });

  it("결과 합산 toast (성공 N / 실패 M / 제외 K)", () => {
    if (!existsSync(SHEET_PATH)) return;
    const source = readFileSync(SHEET_PATH, "utf8");
    expect(source).toMatch(/toast/);
    // 한국어 결과 라벨
    expect(source).toMatch(/완료|성공|발송/);
    expect(source).toMatch(/실패/);
  });

  it("hardBlock quote 별도 표시 (제외 quote 사유)", () => {
    if (!existsSync(SHEET_PATH)) return;
    const source = readFileSync(SHEET_PATH, "utf8");
    expect(source).toMatch(/hardBlock|제외|보류/);
  });

  it("onSuccess callback (refetch + clearSelection + sheet close)", () => {
    if (!existsSync(SHEET_PATH)) return;
    const source = readFileSync(SHEET_PATH, "utf8");
    expect(source).toMatch(/onSuccess|onComplete|onDispatched/);
  });

  it("getQuoteDispatchPreflight 사용 (canonical truth)", () => {
    if (!existsSync(SHEET_PATH)) return;
    const source = readFileSync(SHEET_PATH, "utf8");
    expect(source).toMatch(/getQuoteDispatchPreflight|preflight|hardBlocked/);
  });
});

describe("§11.217 Phase 3 — quotes/page.tsx integration (sheet wiring)", () => {
  const pageSource = readFileSync(PAGE_PATH, "utf8");

  it("BatchDispatchSheet import", () => {
    expect(pageSource).toMatch(/import.*BatchDispatchSheet.*from.*batch-dispatch-sheet/);
  });

  it("BatchDispatchSheet 컴포넌트 사용 (page render)", () => {
    expect(pageSource).toMatch(/<BatchDispatchSheet/);
  });

  it("batchSheetOpen state 가 sheet open 분기", () => {
    expect(pageSource).toMatch(/open=\{batchSheetOpen\}|batchSheetOpen.*setBatchSheetOpen/s);
  });

  it("onSuccess 후 refetch + clearSelection + sheet close 정합", () => {
    expect(pageSource).toMatch(/refetch.*clearSelection|clearSelection.*refetch/s);
  });
});
