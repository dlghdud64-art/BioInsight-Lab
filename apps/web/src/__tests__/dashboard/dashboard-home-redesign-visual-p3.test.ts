/**
 * §dashboard-home-redesign P3 — 컴포넌트 시각 정합 (호영님 시안)
 *   (PLAN: docs/plans/PLAN_dashboard-home-redesign.md)
 *
 * Pipeline 퍼널 하단 진행바(시안 .pbar) + 0건 value 가독성 slate-500(시안 README L11).
 * NextStep blue gradient·BudgetSpend 도넛 내부는 기존 정합(무변경). §11.302 amber/orange 0.
 */

import { describe, it, expect } from "vitest";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const PIPELINE = "src/components/dashboard/pipeline.tsx";
const STATLINE = "src/components/dashboard/stat-line.tsx";

describe("§dashboard-home-redesign P3 — Pipeline 퍼널 진행바", () => {
  const src = read(PIPELINE);
  // 【은퇴 2026-09-18 · §main-dashboard-p0-honesty】 퍼널 진행바(.pbar).
  //   핸드오프 §0-5(호영님 2026-09-17): "파이프라인 게이지 기준 없음 — 견적 8건이 100%,
  //   재고 4건이 50% 등 의미 불명". §4: "상태 칩 (게이지 삭제)".
  //   분모(단계 최대 건수)가 도메인 의미를 갖지 않는다는 것이 은퇴 사유다.
  //   대체 명제(상태 칩 + 딥링크)는 main-dashboard-p0-honesty.test.ts B4·B5 가 소유한다.
  it("은퇴 승계 — 진행바 부활 차단", () => {
    expect(src).not.toMatch(/\bmaxTotal\b/);
    expect(src).not.toMatch(/stage\.total\s*\/\s*/);
  });
  it("진행바 §11.302 정합 — amber/orange 0", () => {
    expect(src).not.toMatch(/-amber-|-orange-/);
  });
  it("회귀 0 — 아이콘 틴트·화살표·0건 흐림(bg-gray-50) 보존", () => {
    expect(src).toMatch(/STAGE_TINT/);
    expect(src).toMatch(/ChevronRight/);
    // 🛑 §comment-axis (2026-09-21 · 릴레이 판정) — 이 단언은 **주석에만** 걸려 통과하고 있었다.
    //    stat-line.tsx:202 · pipeline.tsx:183 이 "de-emphasis 는 bg-gray-50 유지" 라고 **적어 두었을 뿐**,
    //    살아 있는 0건 배경은 `bg-slate-50` 이다. 주석 제거본에 걸어 무효를 막고 실제 토큰을 문다.
    //    ⚠️ 조항 충돌 상신 중 — CLAUDE.md §Mobile Patterns 4 는 0건 톤을 `bg-gray-50` 으로 적고 있다.
    //    판정이 gray-50 이면 **구현**을 고치고 이 단언도 그쪽으로 되돌린다(토큰 갱신으로 덮지 말 것).
    expect(stripComments(src)).toMatch(/bg-slate-50/);
  });
});

describe("§dashboard-home-redesign P3 — 0건 value 가독성(slate-500)", () => {
  it("Pipeline 0건 value slate-500(active slate-900)", () => {
    expect(read(PIPELINE)).toMatch(/active \? "text-slate-900" : "text-slate-500"/);
  });
  it("StatLine 0건 value slate-500(active slate-900)", () => {
    expect(read(STATLINE)).toMatch(/active \? "text-slate-900" : "text-slate-500"/);
  });
  it("회귀 0 — StatLine 0건 비활성 톤(§11.311 bg-gray-50 + 아이콘/라벨 gray-400) 보존", () => {
    const src = read(STATLINE);
    // 🛑 §comment-axis (2026-09-21 · 릴레이 판정) — 이 단언은 **주석에만** 걸려 통과하고 있었다.
    //    stat-line.tsx:202 · pipeline.tsx:183 이 "de-emphasis 는 bg-gray-50 유지" 라고 **적어 두었을 뿐**,
    //    살아 있는 0건 배경은 `bg-slate-50` 이다. 주석 제거본에 걸어 무효를 막고 실제 토큰을 문다.
    //    ⚠️ 조항 충돌 상신 중 — CLAUDE.md §Mobile Patterns 4 는 0건 톤을 `bg-gray-50` 으로 적고 있다.
    //    판정이 gray-50 이면 **구현**을 고치고 이 단언도 그쪽으로 되돌린다(토큰 갱신으로 덮지 말 것).
    expect(stripComments(src)).toMatch(/bg-slate-50/);
    expect(src).toMatch(/text-gray-400/); // 아이콘/라벨 de-emphasis 위계 유지
  });
});
