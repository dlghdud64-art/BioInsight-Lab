/**
 * §dashboard-home-redesign P3 — 컴포넌트 시각 정합 (호영님 시안)
 *   (PLAN: docs/plans/PLAN_dashboard-home-redesign.md)
 *
 * Pipeline 퍼널 하단 진행바(시안 .pbar) + 0건 value 가독성 slate-500(시안 README L11).
 * NextStep blue gradient·BudgetSpend 도넛 내부는 기존 정합(무변경). §11.302 amber/orange 0.
 */

import { describe, it, expect } from "vitest";
import { zeroCardBlock, zeroIconBoxBlock, inactiveBranch } from "@/__tests__/_helpers/dashboard-zero-card";
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
    // §zero-card-window (2026-09-21 · 릴레이 판정) — 0건 카드 = **흰 배경 + 점선 테두리**(CLAUDE.md §Mobile Patterns 1 개정).
    //   창 = 카드 컨테이너 className 블록의 **0건 분기**만. 파일 전체 grep 은 두 번 틀렸다 —
    //   구 단언 /bg-gray-50/ 은 **주석**에, 중간 교체 /bg-slate-50/ 은 **아이콘 박스**에 걸렸다(둘 다 카드가 아니었다).
    const zeroCard_pipeline = inactiveBranch(zeroCardBlock(src, "pipeline"));
    expect(zeroCard_pipeline).toMatch(/\bbg-white\b/);
    expect(zeroCard_pipeline).toMatch(/\bborder-dashed\b/);
    expect(zeroCard_pipeline).toMatch(/\bborder-slate-200\b/);
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
    // §zero-card-window (2026-09-21 · 릴레이 판정) — 0건 카드 = **흰 배경 + 점선 테두리**(CLAUDE.md §Mobile Patterns 1 개정).
    //   창 = 카드 컨테이너 className 블록의 **0건 분기**만. 파일 전체 grep 은 두 번 틀렸다 —
    //   구 단언 /bg-gray-50/ 은 **주석**에, 중간 교체 /bg-slate-50/ 은 **아이콘 박스**에 걸렸다(둘 다 카드가 아니었다).
    const zeroCard_stat = inactiveBranch(zeroCardBlock(src, "stat"));
    expect(zeroCard_stat).toMatch(/\bbg-white\b/);
    expect(zeroCard_stat).toMatch(/\bborder-dashed\b/);
    expect(zeroCard_stat).toMatch(/\bborder-slate-200\b/);
    expect(src).toMatch(/text-gray-400/); // 아이콘/라벨 de-emphasis 위계 유지
  });
});
