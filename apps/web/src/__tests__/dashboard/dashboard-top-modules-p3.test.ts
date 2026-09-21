/**
 * §main-dashboard-redesign P3 — 상단 모듈(StatLine·GlobalEmpty) sentinel
 *
 * 정본: docs/plans/PLAN_main-dashboard-redesign.md (P3 상단 모듈, 가드①②)
 *
 * 검증:
 *   (A) StatLine — summary 단일 진실 KPI3 + 4상태 + §11.311 컴팩트 + 0건 회색.
 *   (B) GlobalEmpty — 정직한 빈 + CTA, 목업/예시/차트 0(가드①②).
 *   (C) 가드② — 두 모듈 어디에도 hardcode 분포/mock 0.
 *   (D) P3 격리 — page.tsx 미배선(고립 빌드, 탑재는 별도 커밋).
 */

import { readFileSync } from "node:fs";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const STAT = "src/components/dashboard/stat-line.tsx";
const EMPTY = "src/components/dashboard/global-empty.tsx";
const PAGE = "src/app/dashboard/page.tsx";

// ── (A) StatLine ────────────────────────────────────────────────────────
describe("§main-dashboard-redesign P3 (A) — StatLine summary 단일 진실 KPI3", () => {
  it("KPI3 라벨 — 이번달 지출 / 잔여 예산 / 확정 발주액", () => {
    const src = read(STAT);
    expect(src).toMatch(/이번달 지출/);
    expect(src).toMatch(/잔여 예산/);
    expect(src).toMatch(/확정 발주액/);
  });
  it("summary 소스 — spend.thisMonth · budget.remaining · po.confirmedAmount (store derive 0)", () => {
    const src = read(STAT);
    expect(src).toMatch(/spend\.thisMonth/);
    expect(src).toMatch(/budget\.remaining/);
    expect(src).toMatch(/po\.confirmedAmount/);
    expect(src).toMatch(/from "@\/lib\/dashboard\/summary-derive"/);
  });
  it("won() 포맷 사용(원화 단일 helper)", () => {
    expect(read(STAT)).toMatch(/won\(/);
  });
  it("4상태 — loading 스켈레톤 / error 재시도(onRetry) / 값 표시", () => {
    const src = read(STAT);
    expect(src).toMatch(/state === "loading"/);
    expect(src).toMatch(/animate-pulse/);
    expect(src).toMatch(/state === "error"/);
    expect(src).toMatch(/onRetry/);
    expect(src).toMatch(/재시도/);
  });
  it("§11.311 컴팩트 — grid-cols-3 / p-3 md:p-4 / text-lg md:text-xl", () => {
    const src = read(STAT);
    expect(src).toMatch(/grid-cols-3/);
    expect(src).toMatch(/p-3 md:p-4/);
    expect(src).toMatch(/text-lg md:text-xl/);
  });
  it("0건 회색 비활성 톤(§11.311) — bg-gray-50 + text-gray-400", () => {
    const src = read(STAT);
    // 🛑 §comment-axis (2026-09-21 · 릴레이 판정) — 이 단언은 **주석에만** 걸려 통과하고 있었다.
    //    stat-line.tsx:202 · pipeline.tsx:183 이 "de-emphasis 는 bg-gray-50 유지" 라고 **적어 두었을 뿐**,
    //    살아 있는 0건 배경은 `bg-slate-50` 이다. 주석 제거본에 걸어 무효를 막고 실제 토큰을 문다.
    //    ⚠️ 조항 충돌 상신 중 — CLAUDE.md §Mobile Patterns 4 는 0건 톤을 `bg-gray-50` 으로 적고 있다.
    //    판정이 gray-50 이면 **구현**을 고치고 이 단언도 그쪽으로 되돌린다(토큰 갱신으로 덮지 말 것).
    expect(stripComments(src)).toMatch(/bg-slate-50/);
    expect(src).toMatch(/text-gray-400/);
  });
  it("터치 영역 ≥44px", () => {
    expect(read(STAT)).toMatch(/min-h-\[44px\]/);
  });
});

// ── (B) GlobalEmpty ─────────────────────────────────────────────────────
describe("§main-dashboard-redesign P3 (B) — GlobalEmpty 정직한 빈 + CTA", () => {
  it("§dashboard-shifan-polish B4 — 시작 CTA = 첫 견적 단독(예산 CTA는 배너로 이관)", () => {
    const src = read(EMPTY);
    expect(src).toMatch(/quoteHref/);
    // B4: budgetHref/예산 설정 CTA 제거 — 빈 계정 예산 동선은 NextStepBanner 단독(중복 3→1).
    expect(src).not.toMatch(/budgetHref/);
    expect(src).toMatch(/첫 견적 시작/);
  });
  it("정직 문구 — 데이터 쌓이면 채워짐(빈 상태 명시)", () => {
    expect(read(EMPTY)).toMatch(/채워집니다|빈 상태/);
  });
});

// ── (C) 가드② 가짜 분포/mock 0 ──────────────────────────────────────────
describe("§main-dashboard-redesign P3 (C) — 가드② mock/예시 0", () => {
  it("StatLine·GlobalEmpty 에 mockup/예시 데이터·차트 0", () => {
    for (const p of [STAT, EMPTY]) {
      const src = read(p);
      expect(src).not.toMatch(/MOCKUP|mockup/);
      expect(src).not.toMatch(/예시 데이터/);
      expect(src).not.toMatch(/recharts|AreaChart/);
    }
  });
});

// ── (D) 탑재 단계 — GlobalEmpty(P3-B1) + StatLine(P3-B2) 배선 완료 ───────
describe("§main-dashboard-redesign P3 (D) — 모듈 탑재 단계", () => {
  it("page.tsx 가 GlobalEmpty 배선(P3-B1)", () => {
    expect(read(PAGE)).toMatch(/global-empty|GlobalEmpty/);
  });
  it("page.tsx 가 StatLine 배선(P3-B2 — 재무 KPI 이전)", () => {
    expect(read(PAGE)).toMatch(/stat-line|StatLine/);
  });
});
