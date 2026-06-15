/**
 * §main-dashboard-redesign P1 — /api/dashboard/summary 단일 진실 계약 sentinel
 *
 * 정본: docs/plans/PLAN_main-dashboard-redesign.md (P1: 데이터 계약 + 가짜 차트 제거)
 *
 * 검증:
 *   (A) 파생 helper 로직 단위 — allEmpty / budTone(§11.302 신호등) / usageRate / won.
 *   (B) summary route shape — MODULES{quote,po,receive,stock} + BUDGET + 파생, 읽기 전용.
 *   (C) 가드②: 목업 분포/가짜 차트 데이터 0 (helper·route 어디에도 hardcode 분포 없음).
 *   (D) 가드③: 전이맵 로컬 재정의 0 (summary 는 카운트 표시만, ALLOWED_*_TRANSITIONS 부재).
 *   (E) 회귀 0: helper 계약(modules/budget/derived) 보존.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  deriveDashboardSummary,
  budTone,
  won,
  type DashboardSummaryInput,
} from "@/lib/dashboard/summary-derive";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const ROUTE = "src/app/api/dashboard/summary/route.ts";
const HELPER = "src/lib/dashboard/summary-derive.ts";

function emptyInput(): DashboardSummaryInput {
  return {
    quote: { total: 0, pending: 0, responded: 0, completed: 0, purchased: 0, pendingAmount: 0 },
    po: { total: 0, ordered: 0, confirmed: 0, shipping: 0, delivered: 0, cancelled: 0, confirmedAmount: 0, thisMonth: 0 },
    receive: { total: 0, pending: 0, partial: 0, completed: 0, issue: 0, expiringCount: 0 },
    stock: { total: 0, reorderNeeded: 0, lowStock: 0, expiringCount: 0, assetValue: 0 },
    budget: null,
    spend: { thisMonth: 0 },
  };
}

// ── (A) 파생 helper 로직 단위 ──────────────────────────────────────────
describe("§main-dashboard-redesign P1 (A) — 파생 helper 로직", () => {
  it("빈 입력 → allEmpty=true, budTone=none, usageRate=0 (가드① 상류 신호)", () => {
    const s = deriveDashboardSummary(emptyInput());
    expect(s.derived.allEmpty).toBe(true);
    expect(s.derived.budTone).toBe("none");
    expect(s.budget.isSet).toBe(false);
    expect(s.budget.usageRate).toBe(0);
  });

  it("모듈 1건+ → allEmpty=false", () => {
    const input = emptyInput();
    input.quote.total = 1;
    expect(deriveDashboardSummary(input).derived.allEmpty).toBe(false);
  });

  it("spend.thisMonth 통과(StatLine 이번달 지출 소스, 실데이터/0)", () => {
    const input = emptyInput();
    input.spend.thisMonth = 1_500_000;
    expect(deriveDashboardSummary(input).spend.thisMonth).toBe(1_500_000);
    expect(deriveDashboardSummary(emptyInput()).spend.thisMonth).toBe(0);
  });

  it("budget 설정 시 usageRate 계산 + isSet=true", () => {
    const input = emptyInput();
    input.budget = { limit: 1_000_000, spent: 500_000, remaining: 500_000 };
    const s = deriveDashboardSummary(input);
    expect(s.budget.isSet).toBe(true);
    expect(s.budget.usageRate).toBe(50);
  });

  it("budTone §11.302 신호등 임계 — <80 ok / 80–<100 warn / >=100 danger / 미설정 none", () => {
    expect(budTone(false, 0)).toBe("none");
    expect(budTone(true, 50)).toBe("ok");
    expect(budTone(true, 79.9)).toBe("ok");
    expect(budTone(true, 80)).toBe("warn");
    expect(budTone(true, 99.9)).toBe("warn");
    expect(budTone(true, 100)).toBe("danger");
    expect(budTone(true, 130)).toBe("danger");
  });

  it("won 포맷 — 원화 천단위 + 음수/소수 안전", () => {
    expect(won(1_234_567)).toBe("₩1,234,567");
    expect(won(0)).toBe("₩0");
    expect(won(-5000)).toBe("₩-5,000");
    expect(won(1234.6)).toBe("₩1,235");
  });
});

// ── (B) summary route shape ────────────────────────────────────────────
describe("§main-dashboard-redesign P1 (B) — summary route 계약", () => {
  it("GET handler + auth 가드 + 읽기 전용(force-dynamic)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/export\s+async\s+function\s+GET/);
    expect(src).toMatch(/await auth\(\)/);
    expect(src).toMatch(/Unauthorized/);
    expect(src).toMatch(/export const dynamic = "force-dynamic"/);
  });

  it("deriveDashboardSummary 로 단일 진실 반환 (분포 가공 없이 helper 위임)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/deriveDashboardSummary\(/);
    expect(src).toMatch(/NextResponse\.json\(deriveDashboardSummary\(/);
  });

  it("MODULES 4종 + BUDGET 입력 구성", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/quote:\s*\{/);
    expect(src).toMatch(/po:\s*\{/);
    expect(src).toMatch(/receive:\s*\{/);
    expect(src).toMatch(/stock:\s*\{/);
    expect(src).toMatch(/budget:\s*budgetInput/);
    expect(src).toMatch(/spend:\s*\{\s*thisMonth:\s*thisMonthSpend/);
  });

  it("prod write 0 — mutation 메서드 부재(읽기 endpoint)", () => {
    const src = read(ROUTE);
    expect(src).not.toMatch(/export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)/);
  });
});

// ── (C) 가드② 가짜 분포 0 ──────────────────────────────────────────────
describe("§main-dashboard-redesign P1 (C) — 가드② 가짜 차트/분포 0", () => {
  it("helper 에 hardcode 월별/분포 mock 배열 없음", () => {
    const src = read(HELPER);
    expect(src).not.toMatch(/MOCKUP/);
    expect(src).not.toMatch(/\d{1,2}월"?\s*,\s*amount/);
  });
  it("route 에 hardcode 분포 mock 없음", () => {
    const src = read(ROUTE);
    expect(src).not.toMatch(/MOCKUP/);
  });
});

// ── (D) 가드③ 전이맵 로컬 재정의 0 ─────────────────────────────────────
describe("§main-dashboard-redesign P1 (D) — 가드③ Pipeline 전이 로컬 재정의 0", () => {
  it("summary route/helper 에 ALLOWED_*_TRANSITIONS 로컬 정의 없음", () => {
    expect(read(ROUTE)).not.toMatch(/ALLOWED_\w+_TRANSITIONS/);
    expect(read(HELPER)).not.toMatch(/ALLOWED_\w+_TRANSITIONS/);
  });
});

// ── (E) 회귀 0 — helper 계약 보존 ──────────────────────────────────────
describe("§main-dashboard-redesign P1 (E) — helper 계약 회귀 0", () => {
  it("출력 구조 modules/budget/spend/derived 보존", () => {
    const s = deriveDashboardSummary(emptyInput());
    expect(Object.keys(s).sort()).toEqual(["budget", "derived", "modules", "spend"]);
    expect(Object.keys(s.modules).sort()).toEqual(["po", "quote", "receive", "stock"]);
    expect(Object.keys(s.budget).sort()).toEqual(["isSet", "limit", "remaining", "spent", "usageRate"]);
    expect(Object.keys(s.derived).sort()).toEqual(["allEmpty", "budTone"]);
  });
});
