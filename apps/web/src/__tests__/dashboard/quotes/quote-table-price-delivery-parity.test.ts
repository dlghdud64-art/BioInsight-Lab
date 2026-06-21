/**
 * #quote-table-price-delivery-parity — 호영님 §11.223 카드 spec parity
 *   → §quote-table-sian P2 진화 (CEO 2026-06-21)
 *
 * 원 cluster 의도: 테이블 뷰에 가격/납기 2 컬럼 추가하여 카드↔테이블 consistency.
 *
 * §quote-table-sian P2 supersede (CEO 2026-06-21 "시안으로 맞추자"):
 *   - 예상금액(price): 테이블 유지 + always 노출(min/max range 로직 보존, hasData 게이트 제거).
 *   - 납기(delivery): 시안 A 에서 테이블 컬럼 제거 → 카드↔테이블 delivery parity 의도는 폐기.
 *     (납기 정보는 마감(dueDate) 컬럼 + 카드 뷰가 담당. 테이블 중복 제거가 CEO 결정.)
 *   - 보존되는 의도: 테이블 예상금액 컬럼 존재 + 가격 range/미수신 표기 로직.
 *
 * canonical truth lock:
 *   - quote.responses[].totalPrice 변경 0 (가격 range 로직 그대로)
 *   - §11.217 Phase 6 viewMode toggle invariant 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("#quote-table-price-delivery-parity — thead 예상금액 컬럼(납기 제거)", () => {
  it("예상금액 컬럼 — inline <th> 또는 COLUMN_LABEL price 매핑", () => {
    expect(page).toMatch(/(<th[^>]{0,80}>예상금액<\/th>|COLUMN_LABEL[\s\S]{0,300}price:\s*"예상금액")/);
  });

  it("§quote-table-sian P2 — 납기(delivery) 테이블 컬럼 제거", () => {
    expect(page).not.toMatch(/delivery:\s*"납기"/);
  });
});

describe("#quote-table-price-delivery-parity — tbody 예상금액 분기 (§11.223 mirror 보존)", () => {
  it("테이블 분기 안 minPrice / maxPrice 변수 (range 계산)", () => {
    expect(page).toMatch(/viewMode === "table"[\s\S]*?prices[\s\S]*?Math\.min[\s\S]*?Math\.max/);
  });

  it("실값 없음 시 '견적 대기' fallback (§quote-table-sian P3, 가짜 금액 금지)", () => {
    // P3 hybrid: 미회신·가격 미기재 통합 → "견적 대기"(이전 "미수신"/"가격 미기재").
    expect(page).toMatch(/viewMode === "table"[\s\S]*?prices\.length === 0[\s\S]{0,200}견적 대기/);
  });

  it("수신 + range — minPrice === maxPrice 시 단일가, 다르면 range (~ 문자)", () => {
    expect(page).toMatch(/viewMode === "table"[\s\S]*?minPrice === maxPrice/);
    expect(page).toMatch(/viewMode === "table"[\s\S]*?₩\{minPrice[\s\S]{0,80}toLocaleString/);
  });
});

describe("#quote-table-price-delivery-parity — 시안 P2 컬럼 invariant 보존", () => {
  it("§quote-table-sian P2 — 잔존 컬럼 라벨 보존 (견적케이스/단계/회신/우선순위/예상금액/다음단계/공급사/마감)", () => {
    // 제거: 제목→견적케이스, 상태→단계, 품목/등록/납기 컬럼 삭제, 액션→다음단계, 가격→예상금액.
    expect(page).toMatch(/"견적케이스"/);
    expect(page).toMatch(/"단계"/);
    expect(page).toMatch(/"회신"/);
    expect(page).toMatch(/"우선순위"/);
    expect(page).toMatch(/"예상금액"/);
    expect(page).toMatch(/"다음단계"/);
    expect(page).toMatch(/"공급사"/);
    expect(page).toMatch(/"마감"/);
  });

  it("회신 progress bar tbody 보존 (responseCount)", () => {
    expect(page).toMatch(/aria-valuenow=\{responseCount\}/);
  });

  it("viewMode toggle button + localStorage persist 보존", () => {
    expect(page).toMatch(/aria-pressed=\{viewMode === "table"\}/);
    expect(page).toMatch(/labaxis-quote-view-mode/);
  });

  it("cluster trace marker (§11.224 → sian P2)", () => {
    expect(page).toMatch(/#quote-table-price-delivery-parity|§11\.224|§quote-table-sian/);
  });
});
