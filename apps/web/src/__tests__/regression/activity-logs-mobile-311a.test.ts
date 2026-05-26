/**
 * §11.311a #activity-logs-mobile — Regression sentinel
 *
 * 호영님 P1 spec (2026-05-26) "더보기 모바일 최적화" — activity-logs 한정:
 *   1. KPI 3 카드 (시스템 활동 / AI 처리 / 경고 오류) → grid-cols-3 한 줄 압축
 *   2. Stream Status (4번째) → hidden lg:block (모바일 제외)
 *   3. KPI 카드 컴팩트 — p-3 + 아이콘 4 + count text-lg
 *   4. 0건 비활성 톤 (bg-gray-50 border-gray-200) vs 1+건 활성 톤 (bg-white shadow-sm)
 *   5. 경고/오류 1+건 시 red 톤 (§11.302 색상 체계 — bg-red-50 border-red-200 text-red-700)
 *   6. AI 인사이트: 0건+0건 시 1줄 muted (bg-gray-50), 1건+ 시 그라데이션 유지
 *   7. 필터 (활동 유형 + 대상 구분): flex-row 항상 (모바일 포함)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PATH = "src/app/dashboard/activity-logs/page.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.311a — KPI grid 컴팩트", () => {
  it("KPI grid: grid-cols-3 (모바일 포함 한 줄)", () => {
    const src = read(PATH);
    expect(src).toMatch(/data-testid="activity-logs-kpi-grid"[\s\S]{0,200}grid-cols-3\s+lg:grid-cols-4/);
  });

  it("이전 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 (세로 1컬럼) 제거", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4/);
  });

  it("Stream Status hidden lg:block (모바일 노출 0)", () => {
    const src = read(PATH);
    expect(src).toMatch(/className="hidden lg:block"[\s\S]{0,500}실시간 스트림/);
  });

  it("카드 padding 컴팩트 (p-3 md:p-4) — 이전 p-5 제거", () => {
    const src = read(PATH);
    expect(src).toMatch(/CardContent className="p-3 md:p-4"/);
  });

  it("아이콘 h-4 w-4 (이전 h-5 w-5 축소)", () => {
    const src = read(PATH);
    // Activity (시스템 활동) 카드의 아이콘 사이즈
    expect(src).toMatch(/<Activity className=`h-4 w-4 \$\{todayCount > 0/);
  });
});

describe("§11.311a — KPI 0건/1건+ 톤 분기", () => {
  it("시스템 활동 — 0건 비활성 (bg-gray-50 border-gray-200), 1+건 활성 (bg-white shadow-sm)", () => {
    const src = read(PATH);
    expect(src).toMatch(/todayCount > 0[\s\S]{0,50}bg-white border-slate-300 shadow-sm[\s\S]{0,50}bg-gray-50 border-gray-200/);
  });

  it("AI 처리 — 동일 0건/1+건 톤 분기", () => {
    const src = read(PATH);
    expect(src).toMatch(/aiCount > 0[\s\S]{0,50}bg-white border-slate-300 shadow-sm[\s\S]{0,50}bg-gray-50 border-gray-200/);
  });

  it("경고/오류 — 1+건 시 red 톤 (§11.302 색상 체계)", () => {
    const src = read(PATH);
    expect(src).toMatch(/alertCount > 0[\s\S]{0,80}bg-red-50 border-red-200/);
    expect(src).toMatch(/text-red-700/);
  });
});

describe("§11.311a — AI 인사이트 조건부 (0건 시 muted)", () => {
  it("0건+0건 시 1줄 muted (bg-gray-50 + activity-logs-ai-insight-muted testid)", () => {
    const src = read(PATH);
    expect(src).toMatch(/aiCount === 0 && todayCount === 0[\s\S]{0,400}data-testid="activity-logs-ai-insight-muted"[\s\S]{0,200}bg-gray-50/);
  });

  it("muted 메시지 — '오늘 활동 0건 · AI 처리 시작 시 인사이트가 표시됩니다'", () => {
    const src = read(PATH);
    expect(src).toMatch(/오늘 활동 0건 · AI 처리 시작 시 인사이트가 표시됩니다/);
  });

  it("1건+ 시 그라데이션 유지 (from-indigo-500 via-purple-500 to-pink-500)", () => {
    const src = read(PATH);
    expect(src).toMatch(/bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500/);
  });
});

describe("§11.311a — 필터 가로 인라인 1행", () => {
  it("필터 컨테이너 flex-row (모바일 포함, 이전 flex-col 제거)", () => {
    const src = read(PATH);
    expect(src).toMatch(/flex flex-row gap-2 md:gap-3 items-end/);
  });

  it("이전 flex-col md:flex-row 패턴 제거", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/flex flex-col md:flex-row gap-3 md:items-end/);
  });
});

describe("§11.311a — 회귀 0 (보존)", () => {
  it("3 KPI 카드 라벨 (시스템 활동 / AI 처리 / 경고/오류) 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/시스템 활동/);
    expect(src).toMatch(/AI 처리/);
    expect(src).toMatch(/경고\/오류/);
  });

  it("Stream Status 라벨 (실시간 스트림) 보존 — 모바일 hidden 만", () => {
    const src = read(PATH);
    expect(src).toMatch(/실시간 스트림/);
    expect(src).toMatch(/syncedAt/);
  });

  it("필터 활동 유형 + 대상 구분 (Select) 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/활동 유형/);
    expect(src).toMatch(/대상 구분/);
    expect(src).toMatch(/activityTypeFilter/);
    expect(src).toMatch(/entityTypeFilter/);
  });
});
