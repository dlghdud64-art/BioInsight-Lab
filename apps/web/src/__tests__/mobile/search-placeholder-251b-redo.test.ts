/**
 * §11.251b-redo #search-placeholder-shortened — search page 모바일 placeholder 축약
 *   (호영님 P1 spec, §11.251b 원안 재진입, §11.276c 안 명시).
 *
 * 호영님 결정 (2026-05-23): "placeholder 축약만 진행 (P1, minimum-diff)" — BOM/재고/비교
 *   3 카드 재도입은 search-result-triage 4 카드 spec 와 중복 위험 → 취소. placeholder
 *   1 swap minimum.
 *
 * 원 §11.251b spec (§11.251a/b/c batch entry):
 *   "시약명 / CAS / 제조사 / 카탈로그 번호" → "시약명·CAS·제조사"
 *   - 4 항목 → 3 항목 (카탈로그 번호 제거)
 *   - 슬래시 → 중점 분리 (모바일 360px 화면 안 잘림 방지)
 *
 * 현재 source 회귀: `placeholder="제품명, 카탈로그 번호, 브랜드 검색..."` (line 168).
 *
 * Fix (minimum diff, 1 file 1 line swap, byte-level Python swap):
 *   apps/web/src/app/search/page.tsx line 168 placeholder 1 swap.
 *
 * canonical truth 보존:
 *   - Input component / handleKeyDown / setQuery / value={query} 보존
 *   - className (pl-11 h-12 text-slate-900 placeholder:text-slate-400 ...) 보존
 *   - Search icon / Button "검색" + ArrowRight 보존
 *   - search-result-triage section (line 183+) 변경 0
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(
  resolve(__dirname, "../../app/search/page.tsx"),
  "utf8",
);

describe("§11.251b-redo — search page placeholder 축약", () => {
  it("§11.251b-redo trace marker comment 존재", () => {
    expect(PAGE).toMatch(/§11\.251b-redo/);
  });

  it("placeholder 한글 \"시약명·CAS·제조사\" 정확 매칭 (3 항목, 중점 분리)", () => {
    expect(PAGE).toMatch(/placeholder="시약명·CAS·제조사"/);
  });

  it("기존 회귀 placeholder 속성 자체 부재 (comment 안 lineage 단어 허용)", () => {
    // placeholder="제품명, ..." 속성 자체 차단 (trace marker comment 안 lineage 단어 허용)
    expect(PAGE).not.toMatch(/placeholder="제품명, 카탈로그 번호, 브랜드 검색/);
  });

  it("placeholder 안 \"카탈로그 번호\" 텍스트 부재 (원 spec 4 → 3 축약)", () => {
    expect(PAGE).not.toMatch(/placeholder="[^"]*카탈로그 번호/);
  });
});

describe("§11.251b-redo — invariant 보존 (canonical truth)", () => {
  it("Input component value={query} + onChange + onKeyDown 보존", () => {
    expect(PAGE).toMatch(/value=\{query\}/);
    expect(PAGE).toMatch(/onChange=\{\(e\) => setQuery\(e\.target\.value\)\}/);
    expect(PAGE).toMatch(/onKeyDown=\{handleKeyDown\}/);
  });

  it("Search icon (lucide-react) 보존", () => {
    expect(PAGE).toMatch(/<Search className="absolute left-3\.5/);
  });

  it("Input className (pl-11 h-12 + placeholder:text-slate-400) 보존", () => {
    expect(PAGE).toMatch(/pl-11 h-12 text-slate-900 placeholder:text-slate-400/);
  });

  it("검색 Button + ArrowRight icon 보존", () => {
    expect(PAGE).toMatch(/onClick=\{handleSearch\}/);
    expect(PAGE).toMatch(/<ArrowRight className="h-4 w-4"/);
  });

  it("search-result-triage section (다른 spec, §11.251b-redo scope 외) 보존", () => {
    expect(PAGE).toMatch(/data-testid="search-result-triage"/);
  });

  it("setSearchQuery 함수 흐름 (handleSearch / handleKeyDown) 보존", () => {
    expect(PAGE).toMatch(/handleSearch/);
    expect(PAGE).toMatch(/handleKeyDown/);
  });
});
