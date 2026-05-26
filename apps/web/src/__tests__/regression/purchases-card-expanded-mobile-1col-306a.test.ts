/**
 * §11.306a #purchases-card-mobile-1col — Regression sentinel
 *
 * 구매 운영 (purchases/page.tsx) 카드 펼침 시 모바일에서 좌측 본문 + 우측
 * 사이드 정보가 위→아래 흐름 (1컬럼) 으로 stack 되도록 Tailwind responsive
 * prefix 강제. md (sm) 이상은 좌우 row (2컬럼) 유지.
 *
 * §11.277c (모바일 카드 2단계 접힘/펼침) 보존:
 *   - expandedCardIds Set state 보존
 *   - aria-expanded 속성 보존
 *   - sm:hidden toggle button 보존
 *   - default collapsed 분기 (${isExpanded ? "flex" : "hidden"} sm:flex) 보존
 *
 * 호영님 spec (2026-05-26, 모바일 P1):
 *   - 카드 펼침 시 2컬럼 → 1컬럼 세로 흐름 (반응형, md 이상 2컬럼 유지)
 *   - 모바일 사용성 직접 영향 (호영님 매일 사용 surface)
 *
 * 진짜 root cause (§11.306a Phase 0 sandbox audit):
 *   - line 786 `<div className="flex items-start gap-4">` (horizontal flex)
 *   - line 879 우측 사이드 `min-w-[160px]` + `flex-shrink-0`
 *   - 모바일 360px 펼침 시 좌측 본문 = 360 - 160 - 16(gap) - 32(padding) = 152px 압축
 *
 * Fix:
 *   - line 786: `flex items-start gap-4` → `flex flex-col sm:flex-row sm:items-start gap-4`
 *   - line 879: `... min-w-[160px]` → `... w-full sm:w-auto sm:min-w-[160px]`
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PURCHASES_PAGE_PATH = "src/app/dashboard/purchases/page.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.306a — 카드 본문 컨테이너 (line 786) 모바일 1컬럼 stack", () => {
  it("flex-col sm:flex-row 패턴 적용 (모바일 stack, sm+ row)", () => {
    const src = read(PURCHASES_PAGE_PATH);
    // 본문 컨테이너는 isExpanded 토글 위 바깥 — 카드 안 좌측 본문 + 우측 사이드
    // 정보를 감싸는 flex 컨테이너에 flex-col sm:flex-row 가 들어가야 함.
    expect(src).toMatch(/flex\s+flex-col\s+sm:flex-row\s+sm:items-start\s+gap-4/);
  });

  it("이전 hardcoded 'flex items-start gap-4' 단독 0 occurrence (defense in depth)", () => {
    const src = read(PURCHASES_PAGE_PATH);
    // 카드 본문 영역의 horizontal-only flex 가 남아있으면 안 됨.
    // 'flex items-start gap-4' 직접 매칭 — flex-col / sm:flex-row 가 빠진 상태.
    // 다른 컨텍스트 (resume / metric row 등) 에서 'flex items-start' 는 OK,
    // 정확히 'flex items-start gap-4' 단독 (앞뒤 다른 prefix 0) 만 차단.
    expect(src).not.toMatch(/className="flex items-start gap-4"/);
  });
});

describe("§11.306a — 우측 사이드 정보 (line 879) 모바일 w-full", () => {
  it("w-full sm:w-auto sm:min-w-[160px] 패턴 적용 (모바일 stretch, sm+ 160px)", () => {
    const src = read(PURCHASES_PAGE_PATH);
    expect(src).toMatch(/w-full\s+sm:w-auto\s+sm:min-w-\[160px\]/);
  });

  it("이전 'min-w-[160px]' 단독 (sm prefix 없이) 0 occurrence", () => {
    const src = read(PURCHASES_PAGE_PATH);
    // 우측 사이드 영역에서 모바일에서도 160px 강제하면 압축 회귀.
    // sm:min-w-[160px] 는 OK, 단독 min-w-[160px] 는 차단.
    expect(src).not.toMatch(/(?<!sm:)min-w-\[160px\]/);
  });
});

describe("§11.306a — §11.277c 보존 (회귀 0)", () => {
  it("expandedCardIds Set state 보존", () => {
    const src = read(PURCHASES_PAGE_PATH);
    expect(src).toMatch(/expandedCardIds.{0,40}useState<Set<string>>/);
  });

  it("aria-expanded 속성 보존", () => {
    const src = read(PURCHASES_PAGE_PATH);
    expect(src).toMatch(/aria-expanded=\{isExpanded\}/);
  });

  it("default collapsed 분기 (isExpanded ? flex : hidden) 보존", () => {
    const src = read(PURCHASES_PAGE_PATH);
    expect(src).toMatch(/\$\{isExpanded\s*\?\s*"flex"\s*:\s*"hidden"\}\s+sm:flex/);
  });

  it("모바일 toggle button (sm:hidden) 보존", () => {
    const src = read(PURCHASES_PAGE_PATH);
    expect(src).toMatch(/data-testid="purchases-card-mobile-toggle"/);
    expect(src).toMatch(/sm:hidden\s+w-full\s+mt-3/);
  });

  it("toggleCardExpand 호출 보존", () => {
    const src = read(PURCHASES_PAGE_PATH);
    expect(src).toMatch(/toggleCardExpand\(item\.id\)/);
  });
});

describe("§11.306a — §11.284c 보존 (회귀 0)", () => {
  it("amount + supplier 1줄 표시 (purchases-card-amount-supplier) 보존", () => {
    const src = read(PURCHASES_PAGE_PATH);
    expect(src).toMatch(/data-testid="purchases-card-amount-supplier"/);
  });

  it("막힘/다음단계 grid (sm:grid-cols-2) 보존 — 이미 모바일 1컬럼 정합", () => {
    const src = read(PURCHASES_PAGE_PATH);
    expect(src).toMatch(/grid\s+grid-cols-1\s+sm:grid-cols-2\s+gap-2\.5/);
  });
});

describe("§11.306a — 데스크탑 변화 0 보장", () => {
  it("sm:items-start 보존 (sm+ 좌우 row align)", () => {
    const src = read(PURCHASES_PAGE_PATH);
    expect(src).toMatch(/sm:flex-row\s+sm:items-start/);
  });

  it("sm:flex 우측 사이드 노출 분기 보존", () => {
    const src = read(PURCHASES_PAGE_PATH);
    // sm:flex flex-col items-end gap-2 flex-shrink-0
    expect(src).toMatch(/sm:flex\s+flex-col\s+items-end\s+gap-2\s+flex-shrink-0/);
  });
});
