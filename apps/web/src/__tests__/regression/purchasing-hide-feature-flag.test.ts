/**
 * §purchasing-hide — 발주/구매 라이브 표면 숨김(hide, not delete) sentinel
 *
 * 호영님 P1 (2026-06-23): 발주/구매 도메인 canonical truth 미정의(구매담당자 ≠ 직접구매자
 *   미반영) → 라이브 진입점만 feature flag(ENABLE_PURCHASING=false default)로 차단.
 *   DB/orders/procurement/API 라우트는 존치. 되살리기 = flag flip 또는 env override.
 *
 * 검증 2축:
 *   (A) 게이트 강제 — 각 표면이 ENABLE_PURCHASING 으로 분기하는지.
 *   (B) 회귀 0(삭제 아님) — 발주/구매 소스 문자열·라우트가 보존되는지(렌더 게이트만).
 *       → 기존 readFileSync sentinel(mobile-surface-372 / dashboard-top-modules-p3 등)
 *         이 GREEN 유지되는 근거.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§purchasing-hide — flag 정의", () => {
  it("feature-flags.ts — ENABLE_PURCHASING 정의 + 기본 false(숨김)", () => {
    const src = read("src/lib/feature-flags.ts");
    expect(src).toMatch(/ENABLE_PURCHASING:\s*boolean/);
    expect(src).toMatch(/ENABLE_PURCHASING:\s*false/); // DEFAULT_FLAGS
    expect(src).toMatch(/NEXT_PUBLIC_FF_PURCHASING/); // env override 경로
  });
});

describe("§purchasing-hide — 게이트 강제(A)", () => {
  it("bottom-nav — 구매 탭을 입고로 스왑(ENABLE_PURCHASING 분기)", () => {
    const src = read("src/components/layout/bottom-nav.tsx");
    expect(src).toMatch(/getFlag\("ENABLE_PURCHASING"\)/);
    expect(src).toMatch(/RECEIVING_TAB/);
    expect(src).toMatch(/\/dashboard\/receiving/);
  });

  it("bottom-nav-more-sheet — 발주 진입점 렌더 필터", () => {
    const src = read("src/components/layout/bottom-nav-more-sheet.tsx");
    expect(src).toMatch(/getFlag\("ENABLE_PURCHASING"\)/);
    expect(src).toMatch(/PURCHASING_HREFS/);
  });

  it("pipeline — 발주(po) stage 렌더 필터", () => {
    const src = read("src/components/dashboard/pipeline.tsx");
    expect(src).toMatch(/getFlag\("ENABLE_PURCHASING"\)/);
    expect(src).toMatch(/s\.key !== "po"/);
  });

  it("stat-line — 확정 발주액 KPI 렌더 필터", () => {
    const src = read("src/components/dashboard/stat-line.tsx");
    expect(src).toMatch(/getFlag\("ENABLE_PURCHASING"\)/);
    expect(src).toMatch(/it\.key !== "confirmed"/);
  });

  it("dashboard/page — 파이프라인 subtitle 발주 단계 조건부", () => {
    const src = read("src/app/dashboard/page.tsx");
    expect(src).toMatch(/getFlag\("ENABLE_PURCHASING"\)/);
    expect(src).toMatch(/견적 → 입고 → 재고/); // off 라벨
  });
});

describe("§purchasing-hide — 회귀 0(삭제 아님, 소스/라우트 보존)(B)", () => {
  it("bottom-nav — 구매 탭 정의 보존", () => {
    const src = read("src/components/layout/bottom-nav.tsx");
    expect(src).toMatch(/label: "구매"/);
    expect(src).toMatch(/\/dashboard\/purchases/);
  });

  it("pipeline — 발주 stage 객체 보존", () => {
    const src = read("src/components/dashboard/pipeline.tsx");
    expect(src).toMatch(/label: "발주"/);
    expect(src).toMatch(/\/dashboard\/purchase-orders/);
  });

  it("stat-line — 확정 발주액 item 보존", () => {
    const src = read("src/components/dashboard/stat-line.tsx");
    expect(src).toMatch(/확정 발주액/);
    expect(src).toMatch(/po\.confirmedAmount/);
  });

  it("more-sheet — 발주 라우트 보존", () => {
    const src = read("src/components/layout/bottom-nav-more-sheet.tsx");
    expect(src).toMatch(/label: "발주"/);
    expect(src).toMatch(/\/dashboard\/purchase-orders/);
  });

  it("dashboard/page — 발주 단계 라벨 문자열 보존(되살리기용)", () => {
    const src = read("src/app/dashboard/page.tsx");
    expect(src).toMatch(/견적 → 발주 → 입고 → 재고/);
  });
});
