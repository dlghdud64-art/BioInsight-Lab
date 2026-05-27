/**
 * §11.302d-6b-2 #quotes-dispatch-amber-removed — Regression sentinel
 *
 * 호영님 P2 sweep 옵션 B 그룹 2/3 — quotes dispatch/intake 7 file.
 *
 * Swap 규칙:
 *   - amber (warning/검토/medium-confidence/보류/리마인더 대상 없음/
 *     sendReadiness 미준비) → yellow (전부 주의 의미, 위험/red 아님)
 *   - 이 그룹은 orange Tailwind class 0 (amber 만)
 *   - emerald(ready/완료) / red(low confidence) 분기 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const FILES = [
  "src/components/quotes/ai-quote-parse-modal.tsx",
  "src/components/quotes/intake/quote-intake-dock.tsx",
  "src/components/quotes/dispatch/vendor-dispatch-workbench.tsx",
  "src/components/quotes/dispatch/batch-reminder-sheet.tsx",
  "src/components/quotes/dispatch/batch-dispatch-sheet.tsx",
  "src/components/quotes/dispatch/batch-status-change-sheet.tsx",
  "src/components/quotes/dispatch/batch-action-bar.tsx",
];

describe("§11.302d-6b-2 — quotes dispatch/intake amber/orange Tailwind class 0", () => {
  for (const f of FILES) {
    it(`${f.split("/").pop()} — amber/orange class 0`, () => {
      const src = read(f);
      expect(src).not.toMatch(/(bg|text|border|from|to|ring)-amber-/);
      expect(src).not.toMatch(/(bg|text|border|from|to|ring)-orange-/);
    });
  }
});

describe("§11.302d-6b-2 — yellow swap 정합", () => {
  it("ai-quote-parse medium confidence yellow (text-yellow-400)", () => {
    const src = read("src/components/quotes/ai-quote-parse-modal.tsx");
    expect(src).toMatch(/confidence === "medium" \? "text-yellow-400"/);
  });

  it("vendor-dispatch CONFIDENCE_COLOR medium yellow", () => {
    const src = read("src/components/quotes/dispatch/vendor-dispatch-workbench.tsx");
    expect(src).toMatch(/medium:\s*"text-yellow-700 border-yellow-200 bg-yellow-50"/);
  });

  it("vendor-dispatch 전송 전 확인 버튼 yellow (bg-yellow-500 hover:bg-yellow-600)", () => {
    const src = read("src/components/quotes/dispatch/vendor-dispatch-workbench.tsx");
    expect(src).toMatch(/bg-yellow-500 hover:bg-yellow-600 text-white/);
  });

  it("quote-intake-dock 검토 badge yellow", () => {
    const src = read("src/components/quotes/intake/quote-intake-dock.tsx");
    expect(src).toMatch(/bg-yellow-50 text-yellow-600 border-yellow-200/);
  });

  it("batch-status-change invalid transition 안내 yellow", () => {
    const src = read("src/components/quotes/dispatch/batch-status-change-sheet.tsx");
    expect(src).toMatch(/border border-yellow-200 bg-yellow-50/);
  });

  it("batch-reminder 대상 없음 안내 yellow", () => {
    const src = read("src/components/quotes/dispatch/batch-reminder-sheet.tsx");
    expect(src).toMatch(/border border-yellow-200 bg-yellow-50/);
    expect(src).toMatch(/text-yellow-900/);
  });
});

describe("§11.302d-6b-2 — 회귀 0 (ready/완료 emerald + low red 보존)", () => {
  it("ai-quote-parse high confidence emerald / low red 보존", () => {
    const src = read("src/components/quotes/ai-quote-parse-modal.tsx");
    expect(src).toMatch(/confidence === "high" \? "text-emerald-400"/);
    expect(src).toMatch(/:\s*"text-red-400"/);
  });

  it("vendor-dispatch CONFIDENCE_COLOR high emerald 보존", () => {
    const src = read("src/components/quotes/dispatch/vendor-dispatch-workbench.tsx");
    expect(src).toMatch(/high:\s*"text-emerald-700 border-emerald-200 bg-emerald-50"/);
  });

  it("vendor-dispatch sendReadiness ready emerald 보존", () => {
    const src = read("src/components/quotes/dispatch/vendor-dispatch-workbench.tsx");
    expect(src).toMatch(/sendReadiness === "ready" \? "bg-emerald-600 hover:bg-emerald-700 text-white"/);
  });
});
