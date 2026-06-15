/**
 * §main-dashboard-redesign P2 — 섹션 로드 4상태 + capMs 10s sentinel
 *
 * 정본: docs/plans/PLAN_main-dashboard-redesign.md (P2)
 *
 * 검증:
 *   (A) deriveSectionState 4상태 도출 단위(순수) — loading/error/empty/ready.
 *   (B) 무한 스켈레톤 금지 — capMs 초과(timedOut)·데이터 없음 → error.
 *   (C) capMs 10s(§11.375 라이브 정합) — 2.6s/2600 프로토타입 값 부재.
 *   (D) 훅 계약 — react-query retry 보존 + 카드별 retry(refetch+timeout reset) 노출.
 *   (E) page 미교체(P2 격리) — 훅은 신규, page.tsx 미수정.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  deriveSectionState,
  CAPMS_DEFAULT,
  type SectionStateInput,
} from "@/lib/dashboard/section-state";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const HOOK = "src/hooks/use-dashboard-section.ts";
const PURE = "src/lib/dashboard/section-state.ts";

function base(over: Partial<SectionStateInput> = {}): SectionStateInput {
  return {
    authLoading: false,
    queryLoading: false,
    queryError: false,
    hasData: false,
    isEmpty: false,
    timedOut: false,
    ...over,
  };
}

// ── (A) 4상태 도출 ──────────────────────────────────────────────────────
describe("§main-dashboard-redesign P2 (A) — deriveSectionState 4상태", () => {
  it("authLoading → loading", () => {
    expect(deriveSectionState(base({ authLoading: true }))).toBe("loading");
  });
  it("queryLoading + 데이터 없음 → loading", () => {
    expect(deriveSectionState(base({ queryLoading: true }))).toBe("loading");
  });
  it("데이터 도착 + 빈 → empty (정직, 차트 미렌더)", () => {
    expect(deriveSectionState(base({ hasData: true, isEmpty: true }))).toBe("empty");
  });
  it("데이터 도착 + 비어있지 않음 → ready", () => {
    expect(deriveSectionState(base({ hasData: true, isEmpty: false }))).toBe("ready");
  });
  it("queryError + 데이터 없음 → error (retry 소진)", () => {
    expect(deriveSectionState(base({ queryError: true }))).toBe("error");
  });
});

// ── (B) 무한 스켈레톤 금지 ──────────────────────────────────────────────
describe("§main-dashboard-redesign P2 (B) — 무한 스켈레톤 금지", () => {
  it("capMs 초과(timedOut) + 데이터 없음 → error (스켈레톤 영구 stuck 0)", () => {
    expect(deriveSectionState(base({ queryLoading: true, timedOut: true }))).toBe("error");
  });
  it("데이터 보유 중 재검증 timeout → stale 유지(ready, 깜빡임 0)", () => {
    expect(deriveSectionState(base({ hasData: true, timedOut: true, queryLoading: true }))).toBe("ready");
  });
});

// ── (C) capMs 10s — §11.375 라이브 정합, 2.6s 폐기 ─────────────────────
describe("§main-dashboard-redesign P2 (C) — capMs 10s 정합", () => {
  it("CAPMS_DEFAULT === 10000 (§11.375 콜드스타트 거짓에러 방지)", () => {
    expect(CAPMS_DEFAULT).toBe(10000);
  });
  it("순수모듈·훅에 2.6s/2600 프로토타입 값 부재", () => {
    expect(read(PURE)).not.toMatch(/2600|2\.6\s*s|2_600/);
    expect(read(HOOK)).not.toMatch(/2600|2\.6\s*s|2_600/);
  });
  it("훅 capMs 기본값 = CAPMS_DEFAULT", () => {
    expect(read(HOOK)).toMatch(/capMs\s*=\s*CAPMS_DEFAULT/);
  });
});

// ── (D) 훅 계약 ─────────────────────────────────────────────────────────
describe("§main-dashboard-redesign P2 (D) — 훅 계약(retry 보존 + 카드별 재시도)", () => {
  it("react-query retry 2 + backoff canonical 보존(§11.361/§11.366)", () => {
    const src = read(HOOK);
    expect(src).toMatch(/useQuery/);
    expect(src).toMatch(/retry:\s*2/);
    expect(src).toMatch(/retryDelay/);
  });
  it("!ok throw (return null 금지 — retry 동작, §11.361-1b)", () => {
    expect(read(HOOK)).toMatch(/throw new Error/);
  });
  it("카드별 retry — timeout reset + refetch 노출", () => {
    const src = read(HOOK);
    expect(src).toMatch(/retry:\s*\(\)\s*=>/);
    expect(src).toMatch(/setTimedOut\(false\)/);
    expect(src).toMatch(/refetch\(\)/);
  });
  it("deriveSectionState 합성(상태 로컬 재정의 0)", () => {
    expect(read(HOOK)).toMatch(/deriveSectionState\(/);
  });
});

// ── (E) P3-B1 진화 — page 가 훅 소비 시작(GlobalEmpty 배선) ──────────────
//   P2 격리(page 미소비)는 P3-B1(globalempty-wire)에서 종료. page 가 useDashboardSection
//   을 소비하되, 비차단·무회귀(기존 stats/로딩게이트/ExecutiveSummary 보존)는
//   dashboard-globalempty-wire-p3b.test.ts (B/C) 가 검증. 여기선 소비 시작만 확인.
describe("§main-dashboard-redesign P2→P3-B1 (E) — page 훅 소비 시작(GlobalEmpty 배선)", () => {
  it("dashboard page 가 useDashboardSection 소비(P3-B1 GlobalEmpty 배선 완료)", () => {
    expect(read("src/app/dashboard/page.tsx")).toMatch(/useDashboardSection/);
  });
});
