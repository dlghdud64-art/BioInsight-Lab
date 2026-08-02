/**
 * §bottom-nav-badge P1 — 하단 내비 재고 탭 뱃지 (2a-6, F8=(a) 후속)
 *
 * 정본: docs/plans/PLAN_bottom-nav-badge.md (P0 확정 아키텍처).
 *
 * F8 금지 경로 재확인:
 *   ❌ ops-store seed 경유(가짜 카운트) ❌ BottomNav 의 heavy stats fetch ❌ 파생 규칙 중복 구현.
 * P0-확정: `isReorderNeeded` 는 이미 `lib/inventory/reorder-need.ts` 공유 lib(§stock-risk-consolidation
 *   P3 단일화) → 신규 count 라우트는 **동일 함수 재사용**(SQL 번역 금지 — 규칙 이원화 방지). stats 무접촉.
 *
 * ⚠️ Phase 1 RED sentinel — 구현 전 실패가 정상.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const p = (rel: string) => join(REPO_ROOT, rel);
const read = (rel: string) => readFileSync(p(rel), "utf8");

const ROUTE = "src/app/api/inventory/alert-count/route.ts";
const NAV = "src/components/layout/bottom-nav.tsx";

describe("§bottom-nav-badge P1 — count 라우트 계약", () => {
  it("라우트 존재 + 공유 isReorderNeeded 재사용 (규칙 이원화 0)", () => {
    expect(existsSync(p(ROUTE))).toBe(true);
    const src = read(ROUTE);
    expect(src).toMatch(/from "@\/lib\/inventory\/reorder-need"/);
    expect(src).toMatch(/isReorderNeeded/);
  });

  it("최소 필드 select (overfetch 0) + 인증·조직 스코프", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/select:/);
    expect(src).toMatch(/organizationId/);
  });

  it("SQL 번역 규칙 중복 0 — where 절에 임계 비교 인라인 금지", () => {
    const src = read(ROUTE);
    expect(src).not.toMatch(/lte:\s*.*safetyStock|currentQuantity:\s*\{\s*lte/);
  });
});

describe("§bottom-nav-badge P1 — BottomNav 뱃지", () => {
  it("재고 탭 뱃지 — canonical 훅 파생 (seed/ops-store 경유 0)", () => {
    const src = read(NAV);
    expect(src).toMatch(/useInventoryAlertCount/);
    expect(src).not.toMatch(/useOpsStore|ALL_STOCK_POSITIONS|seed-data/);
  });

  it("§11.311-6 스펙 — red 뱃지 min-w-[15px] · 9.5px bold · 아이콘 우상단", () => {
    const src = read(NAV);
    expect(src).toMatch(/min-w-\[15px\]/);
    expect(src).toMatch(/text-\[9\.5px\] font-bold/);
    expect(src).toMatch(/bg-red-500|bg-red-600/);
  });

  it("0건·로딩·에러 = 뱃지 미렌더 (가짜/고정 카운트 0)", () => {
    const src = read(NAV);
    expect(src).toMatch(/count > 0 &&|count != null && count > 0/);
  });

  it("heavy stats fetch 부재 (dashboard-stats 직접 호출 0)", () => {
    const src = read(NAV);
    expect(src).not.toMatch(/dashboard-stats|\/api\/dashboard\/stats/);
  });
});

describe("§bottom-nav-badge P1 — 회귀 0 (BottomNav 기존 계약)", () => {
  it("4탭 + 더보기 구조 보존", () => {
    const src = read(NAV);
    expect(src).toMatch(/label: "대시보드"/);
    expect(src).toMatch(/label: "재고"/);
    expect(src).toMatch(/더보기/);
  });

  it("§purchasing-hide 탭 스왑 게이트 보존", () => {
    const src = read(NAV);
    expect(src).toMatch(/ENABLE_PURCHASING/);
    expect(src).toMatch(/RECEIVING_TAB/);
  });

  it("stats route 무접촉 전제 — reorder-need lib 단일화 주석 보존", () => {
    const stats = read("src/app/api/dashboard/stats/route.ts");
    expect(stats).toMatch(/import \{ isReorderNeeded \} from "@\/lib\/inventory\/reorder-need"/);
  });
});
