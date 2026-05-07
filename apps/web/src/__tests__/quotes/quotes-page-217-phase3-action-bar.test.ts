/**
 * §11.217 Phase 3 — BatchActionBar regression guard
 *
 * Goal: selectedCount > 0 시 sticky action bar 노출.
 *       dispatchable / hard-block 분리 표시 (preflight 합산).
 *       "검토 시작" CTA → batchSheetOpen=true.
 *       "선택 해제" → clearSelection.
 *
 * canonical truth lock:
 *   - selectedCount === 0 시 action bar 0 (conditional render).
 *   - dispatchable === 0 시 "검토 시작" disabled + tooltip 정합.
 *   - 한국어 라벨 ("선택 N건 — 발송 가능 M건 / 보류 K건").
 *   - canonical truth (getQuoteDispatchPreflight) 그대로 사용 — UI state 가 truth 덮지 않음.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../app/dashboard/quotes/page.tsx");
const ACTION_BAR_PATH = resolve(
  __dirname,
  "../../components/quotes/dispatch/batch-action-bar.tsx",
);

describe("§11.217 Phase 3 — BatchActionBar component file 존재", () => {
  it("batch-action-bar.tsx file 존재", () => {
    expect(existsSync(ACTION_BAR_PATH)).toBe(true);
  });
});

describe("§11.217 Phase 3 — BatchActionBar component contract", () => {
  it("'use client' directive (sticky positioning + click handler)", () => {
    if (!existsSync(ACTION_BAR_PATH)) return;
    const source = readFileSync(ACTION_BAR_PATH, "utf8");
    expect(source).toMatch(/^["']use client["']/);
  });

  it("default export BatchActionBar", () => {
    if (!existsSync(ACTION_BAR_PATH)) return;
    const source = readFileSync(ACTION_BAR_PATH, "utf8");
    expect(source).toMatch(/export\s+(default\s+)?function\s+BatchActionBar|export\s+function\s+BatchActionBar/);
  });

  it("selectedCount === 0 시 null return (conditional render)", () => {
    if (!existsSync(ACTION_BAR_PATH)) return;
    const source = readFileSync(ACTION_BAR_PATH, "utf8");
    // selectedCount === 0 또는 selectedQuotes.length === 0 → return null
    expect(source).toMatch(/(selectedCount\s*===\s*0|selectedQuotes\.length\s*===\s*0).*return\s+null/s);
  });

  it("sticky positioning (top + z-index)", () => {
    if (!existsSync(ACTION_BAR_PATH)) return;
    const source = readFileSync(ACTION_BAR_PATH, "utf8");
    expect(source).toMatch(/sticky/);
    expect(source).toMatch(/z-/);
  });

  it("dispatchable / hardBlock 분리 라벨 (한국어)", () => {
    if (!existsSync(ACTION_BAR_PATH)) return;
    const source = readFileSync(ACTION_BAR_PATH, "utf8");
    expect(source).toMatch(/발송 가능|발송가능/);
    expect(source).toMatch(/보류|차단/);
  });

  it("'검토 시작' primary CTA + disabled when dispatchable === 0", () => {
    if (!existsSync(ACTION_BAR_PATH)) return;
    const source = readFileSync(ACTION_BAR_PATH, "utf8");
    expect(source).toMatch(/검토 시작|검토시작/);
    // disabled 분기 존재
    expect(source).toMatch(/disabled.*dispatchableCount|dispatchableCount.*disabled|disabled=\{[^}]*dispatchable/s);
  });

  it("'선택 해제' secondary CTA + onClearSelection handler", () => {
    if (!existsSync(ACTION_BAR_PATH)) return;
    const source = readFileSync(ACTION_BAR_PATH, "utf8");
    expect(source).toMatch(/선택 해제|선택해제/);
    expect(source).toMatch(/onClearSelection|onClear/);
  });

  it("preflight 결과 사용 (canonical truth — getQuoteDispatchPreflight)", () => {
    if (!existsSync(ACTION_BAR_PATH)) return;
    const source = readFileSync(ACTION_BAR_PATH, "utf8");
    // props 로 dispatchableCount / hardBlockCount 받기 (page-level 에서 합산)
    expect(source).toMatch(/dispatchableCount|hardBlockCount|hardBlocked/);
  });
});

describe("§11.217 Phase 3 — quotes/page.tsx integration", () => {
  const pageSource = readFileSync(PAGE_PATH, "utf8");

  it("BatchActionBar import", () => {
    expect(pageSource).toMatch(/import.*BatchActionBar.*from.*batch-action-bar/);
  });

  it("batchSheetOpen state (sheet 열기 trigger)", () => {
    expect(pageSource).toMatch(/batchSheetOpen|batchDispatchSheetOpen/);
  });

  it("BatchActionBar 컴포넌트 사용 (page render)", () => {
    expect(pageSource).toMatch(/<BatchActionBar/);
  });

  it("preflight 합산 로직 — selectedQuotes 의 dispatchable / hardBlock count", () => {
    // page-level 에 dispatchableCount / hardBlockCount 계산
    expect(pageSource).toMatch(/dispatchableCount|hardBlockCount|selectedQuotes/);
  });
});
