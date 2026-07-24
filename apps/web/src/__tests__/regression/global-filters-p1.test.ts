/**
 * §global-filters P1 #contract-sentinel — 전역 필터 통일: 공용 컴포넌트 계약 + 파일럿(audit 데스크톱)
 *
 * 정본: docs/plans/PLAN_global-filters.md (P0 완료 `30cb59c5` — 필터화면 14 인벤토리·예외9·
 *   프로토타입 부재(잠정계약)·컴포넌트 초안·sentinel 충돌 0·P2 스코프 정정).
 *
 * 원칙(호영님 확정): 전 화면·전 뷰포트 필터 통일 · 단일 ≤7 = 드롭다운 / 8+·멀티 = 바텀시트 ·
 *   필터 트리거는 공용 컴포넌트(화면별 중복 구현 금지) · 공용은 표시 계층만(controlled, 상태는 화면 소유).
 *
 * 인터페이스 = inventory 레퍼런스(데스크 Select + 모바일 Sheet, 값 "all"=비활성) 수용:
 *   FilterDef = { key, label, options, mode: "dropdown"|"sheet", allValue? }.
 *
 * ⚠️ Phase 1 RED sentinel — P2(공용 구현 + audit 데스크톱 파일럿) 전 실패가 정상.
 * ⚠️ P2 스코프: 파일럿 = audit 데스크톱 블록만. 모바일 칩행(log-filter-row P3 존)은 무접촉 —
 *   (f) 가드가 이를 강제(모바일 통일은 진화 상신 후 별도 커밋).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const p = (rel: string) => join(REPO_ROOT, rel);
const readSafe = (rel: string) => (existsSync(p(rel)) ? readFileSync(p(rel), "utf8") : "");

const BAR = "src/components/ui/filter-bar.tsx";
const CHIP = "src/components/ui/filter-chip-row.tsx";
const SHEET = "src/components/ui/filter-sheet.tsx";
const AUDIT = "src/app/dashboard/audit/page.tsx";

describe("§global-filters P1 계약 — 공용 컴포넌트 (P2 구현 후 GREEN)", () => {
  it("(a) 공용 3파일 실재 — filter-bar · filter-chip-row · filter-sheet", () => {
    expect(existsSync(p(BAR))).toBe(true);
    expect(existsSync(p(CHIP))).toBe(true);
    expect(existsSync(p(SHEET))).toBe(true);
  });

  it("(b) FilterDef mode 정의 계층 — 'dropdown' | 'sheet' 타입 유니온(코드, 주석 아님)", () => {
    const src = readSafe(BAR);
    // 표시 모드 판정을 정의가 소유 — 단일·≤7 → dropdown / 멀티·8+ → sheet (P0 판정표 1:1).
    expect(src).toMatch(/"dropdown"\s*\|\s*"sheet"|'dropdown'\s*\|\s*'sheet'/);
    expect(src).toMatch(/mode\b/);
  });

  it("(c) 공용이 select.tsx 소비 — 자체 트리거 스타일 재발명 0", () => {
    const src = readSafe(BAR);
    expect(src).toMatch(/from ["']@\/components\/ui\/select["']/);
    expect(src).toMatch(/SelectTrigger/);
  });

  it("(e) 파일럿 — audit page 가 filter-bar import(데스크톱 인라인 트리거 이식)", () => {
    const src = readSafe(AUDIT);
    expect(src).toMatch(/from ["']@\/components\/ui\/filter-bar["']/);
  });
});

describe("§global-filters P1 가드 — controlled + 파일럿 P3 존 보존", () => {
  it("(d) controlled — 공용 3파일이 필터 상태 useState 소유 0 (표시 계층·props 주입만)", () => {
    // 필터 값 상태는 화면 소유. 공용은 open 등 표시 로컬 UI 상태만 가능하되 필터 값 useState 금지.
    for (const rel of [BAR, CHIP, SHEET]) {
      const src = readSafe(rel);
      expect(src).not.toMatch(/useState[^\n]*[Ff]ilter/);
      expect(src).not.toMatch(/useState[^\n]*\bvalues?\b/);
    }
  });

  it("(f) 파일럿 가드 — audit 모바일 필터 한 줄(log-filter-row) + 세부 시트 원문 보존(P3 무접촉)", () => {
    const src = readSafe(AUDIT);
    expect(src).toMatch(/data-testid="log-filter-row"/);
    expect(src).toMatch(/data-testid="log-filter-sheet"/);
    expect(src).toMatch(/data-testid="log-domain-chip-all"/);
  });
});
