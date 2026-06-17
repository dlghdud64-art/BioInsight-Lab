/**
 * §dashboard-shifan-polish — 시안 비주얼 정합(저위험군 A1·A2·A7) sentinel
 *
 * 원칙: 구조·아이콘·배치 = 시안 / 데이터 = empty 정직. 가짜 수치 0.
 *
 * 범위:
 *   (A1) StatLine — KPI별 아이콘 틴트 박스(구분 강화). 0건 회색 비활성 보존(§11.311).
 *   (A2) Pipeline — 단계별 아이콘 틴트(견적 blue/발주 indigo/입고 teal/재고 yellow).
 *   (A7) GlobalEmpty — 카피 구체화(무엇을 쌓으면 무엇이 채워지는지 action→result).
 *
 * 회귀 0: 라벨/상태/회색 비활성/정직 empty/§11.302(amber·orange 금지) 전부 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");

const STAT = read("src/components/dashboard/stat-line.tsx");
const PIPE = read("src/components/dashboard/pipeline.tsx");
const EMPTY = read("src/components/dashboard/global-empty.tsx");
const CAT = read("src/components/dashboard/category-distribution-card.tsx");

// ── (A1) StatLine KPI 아이콘 틴트 ─────────────────────────────────────────
describe("§dashboard-shifan-polish A1 — StatLine 아이콘 구분 강화", () => {
  it("KPI별 틴트 맵 + 아이콘 박스(active만)", () => {
    expect(STAT).toMatch(/KPI_TINT/);
    expect(STAT).toMatch(/bg-blue-50/);
    expect(STAT).toMatch(/bg-emerald-50/);
    expect(STAT).toMatch(/bg-indigo-50/);
  });
  it("회귀 — 0건 회색 비활성(§11.311) + KPI3 라벨 + grid-cols-3 보존", () => {
    expect(STAT).toMatch(/bg-gray-50/);
    expect(STAT).toMatch(/bg-gray-100/); // 비활성 아이콘 박스
    expect(STAT).toMatch(/이번달 지출/);
    expect(STAT).toMatch(/잔여 예산/);
    expect(STAT).toMatch(/확정 발주액/);
    expect(STAT).toMatch(/grid-cols-3/);
  });
  it("§11.302 — amber·orange 금지(틴트는 신호색 아님)", () => {
    expect(STAT).not.toMatch(/-amber-|-orange-/);
  });
});

// ── (A2) Pipeline 단계 아이콘 틴트 ────────────────────────────────────────
describe("§dashboard-shifan-polish A2 — Pipeline 단계별 틴트", () => {
  it("단계별 틴트 맵 + 4색(견적 blue/발주 indigo/입고 teal/재고 yellow)", () => {
    expect(PIPE).toMatch(/STAGE_TINT/);
    expect(PIPE).toMatch(/bg-blue-50/);
    expect(PIPE).toMatch(/bg-indigo-50/);
    expect(PIPE).toMatch(/bg-teal-50/);
    expect(PIPE).toMatch(/bg-yellow-50/);
  });
  it("회귀 — 4단계 라벨 + modules 단일 진실 + 0건 회색 비활성 보존", () => {
    expect(PIPE).toMatch(/견적/);
    expect(PIPE).toMatch(/발주/);
    expect(PIPE).toMatch(/입고/);
    expect(PIPE).toMatch(/재고/);
    expect(PIPE).toMatch(/modules\.quote/);
    expect(PIPE).toMatch(/bg-gray-50/);
    expect(PIPE).toMatch(/bg-gray-100/); // 비활성 아이콘 박스
  });
  it("§11.302 — amber·orange 금지", () => {
    expect(PIPE).not.toMatch(/-amber-|-orange-/);
  });
});

// ── (A7) GlobalEmpty 카피 구체화 ─────────────────────────────────────────
describe("§dashboard-shifan-polish A7 — GlobalEmpty 카피 구체화", () => {
  it("action→result 매핑 명시(견적→파이프라인 / 예산→집행률 / 입고→재고)", () => {
    expect(EMPTY).toMatch(/견적을 요청하면/);
    expect(EMPTY).toMatch(/예산을 등록하면/);
    expect(EMPTY).toMatch(/입고가 기록되면/);
  });
  it("회귀 — 정직 empty 문구 + 시작 CTA(터치 ≥44px) + mockup 0 보존", () => {
    expect(EMPTY).toMatch(/빈 상태로 정직하게/);
    expect(EMPTY).toMatch(/min-h-\[44px\]/);
    expect(EMPTY).not.toMatch(/MOCKUP|mockup/);
  });
});

// ── (A5/B1) 카테고리 empty 높이 reserve + 분포 암시 금지 ───────────────────
describe("§dashboard-shifan-polish A5/B1 — 카테고리 empty 차트높이 reserve + 분포 암시 0", () => {
  it("empty 가 차트 실높이 reserve(min-h) + 중앙 안내(CLS 방지)", () => {
    // 납작 squash 방지 + 데이터 들어와도 카드 높이 불변(레이아웃 점프 0).
    expect(CAT).toMatch(/min-h-\[180px\]/);
    expect(CAT).toMatch(/items-center justify-center/);
    expect(CAT).toMatch(/발주가 시작되면 카테고리 분포가 표시됩니다/);
  });
  it("empty skeleton = 동일 길이 bar(flex-1) — 가짜 분포(막대별 inline width) 금지", () => {
    // 길이 차등 막대 = 가짜 분포 암시 → 금지(시안 42/25/20/13% 재발 차단). 라벨만 + 동일 길이.
    expect(CAT).not.toMatch(/style=\{\{\s*width/);
    expect(CAT).not.toMatch(/const MOCKUP_CATEGORY/);
  });
});
