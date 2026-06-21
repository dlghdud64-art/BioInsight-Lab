/**
 * §11.248d #quote-table-fade-hint — 호영님 P0 견적 관리 #4 견적 테이블 반응형 (scope 축소)
 *
 * 호영님 spec (scope 축소 - (1) + (3) 우선 land):
 *   (1) "제목" 컬럼 min-width 240px 이상 확보
 *   (3) 가로 스크롤 존재 시 좌우 fade 힌트 또는 스크롤 인디케이터
 *
 * Scope 축소 결정 — (2) viewport-aware 자동 column hide + (4) expand row 별도 §11.248d-2 백로그
 *
 * 현재 상태 (Phase 0 audit):
 *   - DEFAULT_COLUMN_PREFS.widths.title = 280 (이미 240 이상 충족)
 *   - 외부 컨테이너: `<div className="overflow-x-auto bg-pn rounded-xl border border-bd/80">`
 *     (가로 스크롤 적용 / fade hint 없음)
 *
 * canonical truth lock:
 *   - DEFAULT_COLUMN_PREFS / COLUMN_LABEL / visibleColumns 시스템 모두 보존
 *   - columnPrefs localStorage 동작 보존 (§11.230b)
 *   - thead/tbody dynamic visibleColumns.map() 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.248d #1 — 제목 컬럼 min-width 240 보장", () => {
  it("DEFAULT_COLUMN_PREFS.widths.title >= 240 (호영님 spec 정합)", () => {
    expect(page).toMatch(/title:\s*(240|2[4-9]\d|[3-9]\d{2}|\d{4,})/);
  });

  it("§11.248d trace marker — title min-width 240 명시", () => {
    expect(page).toMatch(/§11\.248d[\s\S]{0,400}(min-width|240|fade|hint|스크롤|반응형)/i);
  });
});

describe("§11.248d #2 — 가로 스크롤 fade hint (좌우 gradient overlay)", () => {
  it("외부 wrapper relative + 가로 스크롤 영역 wrap", () => {
    // 호영님 spec: 가로 스크롤 fade hint
    // 패턴: <div className="relative"> <div className="overflow-x-auto ...">...</div> <fade overlay> </div>
    expect(page).toMatch(/relative[\s\S]{0,500}overflow-x-auto bg-pn rounded-xl border border-bd\/80/);
  });

  it("좌측 fade overlay — absolute left-0 + bg-gradient-to-r", () => {
    expect(page).toMatch(/absolute\s+left-0[\s\S]{0,200}bg-gradient-to-r/);
  });

  it("우측 fade overlay — absolute right-0 + bg-gradient-to-l", () => {
    expect(page).toMatch(/absolute\s+right-0[\s\S]{0,200}bg-gradient-to-l/);
  });

  it("fade overlay pointer-events-none (테이블 상호작용 방해 0)", () => {
    expect(page).toMatch(/(absolute\s+left-0|absolute\s+right-0)[\s\S]{0,300}pointer-events-none/);
  });
});

describe("§11.248d #3 — invariant 보존", () => {
  it("DEFAULT_COLUMN_PREFS 8 컬럼 보존 (§quote-table-sian P2 — itemCount/delivery/createdAt 제거·supplier 추가, 상대 순서 보존)", () => {
    // §quote-table-sian P2 — 시안 A 8컬럼. 보호 의도(컬럼 손실·임의 재배열 방지)는 불변:
    //   order 는 견적케이스→공급사→단계→회신→우선순위→예상금액→마감→다음단계 고정.
    expect(page).toMatch(/title:\s*\d+,\s*[\s\S]{0,80}supplier:\s*\d+,\s*[\s\S]{0,80}status/);
    expect(page).toMatch(/order:\s*\[\s*"title",\s*"supplier",\s*"status",\s*"responseCount",\s*"priority",\s*"price",\s*"dueDate",\s*"actions"\s*\]/);
  });

  it("COLUMN_LABEL 매핑 보존 (견적케이스/공급사/단계/회신/우선순위/예상금액/마감/다음단계)", () => {
    expect(page).toMatch(/COLUMN_LABEL:\s*Record<ColumnKey,\s*string>/);
  });

  it("§11.230b columnPrefs localStorage 보존", () => {
    expect(page).toMatch(/COLUMN_PREFS_LS_KEY/);
  });

  it("visibleColumns dynamic visibility 보존", () => {
    expect(page).toMatch(/const visibleColumns = useMemo<ColumnKey\[\]>/);
  });

  it("외부 컨테이너 `<div className=.overflow-x-auto bg-pn rounded-xl border border-bd\\/80.>` 보존 (within relative wrapper)", () => {
    expect(page).toMatch(/overflow-x-auto bg-pn rounded-xl border border-bd\/80/);
  });
});
