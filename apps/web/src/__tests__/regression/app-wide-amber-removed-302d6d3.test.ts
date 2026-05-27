/**
 * §11.302d-6d-3 #app-wide-amber-removed — Regression sentinel (FINAL sweep)
 *
 * 호영님 P2 sweep 옵션 A — §11.302d-6 영역별 분할의 마지막 batch.
 * 6d-3 = admin/* + vendor-portal/* + app 기타(search/quotes/products/
 * protocol/extract/billing/contract-preview/compare/not-found/
 * organization-overview/_components/ontology) amber·orange swap.
 *
 * 6a(critical) → 6b(workbench-approval) → 6c(lib-legacy) →
 * 6d-1(dashboard) → 6d-2(components) → 6d-3(잔여 전체) 종결.
 * → 본 batch 완료 시 apps/web/src/ ** /*.tsx amber/orange Tailwind class 0.
 *
 * 색상 분류 (file별, 호영님 옵션 A):
 *   - status/warning  → yellow  (추출경고/대기/승인대기/검토중/SIGNIFICANT 등)
 *   - 위험 격상        → red     (compare HIGH significance — safety high→red 정합)
 *   - 장식/categorical → sky     (link-graph DispatchPackage 노드/404 badge/
 *                                  page-header icon tint/safety nav icon/
 *                                  요청일 calendar/Share2 icon)
 *
 * ⚠️ chart palette hex(#f59e0b) 는 Tailwind class 가 아니라 sweep 무관(보존).
 * ⚠️ "amber" 문자열 키 / dotColorMap·STATUS_RING·BADGE_COLORS 키 보존(값만 swap).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SRC_DIR = join(REPO_ROOT, "src");

const TW_AMBER_ORANGE =
  /(bg|text|border|border-l|from|to|via|ring|ring-offset|fill|stroke|accent|divide|decoration|outline|shadow)-(amber|orange)-[0-9]/;

function walkTsx(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walkTsx(full));
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("§11.302d-6d-3 — application-wide *.tsx amber/orange Tailwind class 0", () => {
  it("apps/web/src 전체 .tsx recursive 스캔 amber/orange 0 (6 종결)", () => {
    const offenders: string[] = [];
    for (const f of walkTsx(SRC_DIR)) {
      const src = readFileSync(f, "utf8");
      if (TW_AMBER_ORANGE.test(src)) {
        offenders.push(f.replace(SRC_DIR, "src"));
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("§11.302d-6d-3 — 대표 file 분류별 swap 검증", () => {
  function read(rel: string): string {
    return readFileSync(join(SRC_DIR, rel), "utf8");
  }

  it("extract 추출 경고 alert → yellow (status)", () => {
    const src = read("app/extract/page.tsx");
    expect(src).toMatch(/border-yellow-200[\s\S]{0,80}bg-yellow-50/);
    expect(src).not.toMatch(/(bg|text|border)-orange-[0-9]/);
  });

  it("compare-analysis-drawer HIGH significance → red (위험 격상), SIGNIFICANT → yellow", () => {
    const src = read("app/compare/_components/compare-analysis-drawer.tsx");
    expect(src).toMatch(/HIGH:\s*\{\s*label:\s*"높음",\s*className:\s*"bg-red-500\/20 text-red-300"/);
    expect(src).toMatch(/SIGNIFICANT_DIFFERENCES:\s*\{[\s\S]{0,80}text-yellow-400 bg-yellow-600\/10/);
    expect(src).not.toMatch(/(bg|text|border)-orange-[0-9]/);
  });

  it("link-graph DispatchPackage 노드 → sky (장식/categorical)", () => {
    const src = read("components/ontology/link-graph-visualizer.tsx");
    expect(src).toMatch(/DispatchPackage:\s*\{\s*bg:\s*"fill-sky-500\/20",\s*border:\s*"stroke-sky-500\/50"/);
    expect(src).not.toMatch(/-orange-[0-9]/);
  });

  it("dashboard-sidebar safety nav icon → sky (장식 theme)", () => {
    const src = read("app/_components/dashboard-sidebar.tsx");
    expect(src).toMatch(/"\/dashboard\/safety":\s*\{\s*active:\s*"text-sky-500",\s*inactive:\s*"text-sky-400\/70"/);
  });

  it("not-found 404 badge → sky (장식)", () => {
    const src = read("app/not-found.tsx");
    expect(src).toMatch(/bg-sky-500 text-white/);
    expect(src).not.toMatch(/bg-orange-[0-9]/);
  });
});
