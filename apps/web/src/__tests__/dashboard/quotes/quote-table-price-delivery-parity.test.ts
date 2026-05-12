/**
 * #quote-table-price-delivery-parity — 호영님 §11.223 카드 spec parity
 *
 * 호영님 spec gap (§11.223 카드 뷰 land 후 audit 결과):
 *   - 카드 뷰: ₩X ~ ₩Y (N건 수신) / 견적 미수신 / 납기 상대 일수
 *   - 테이블 뷰: 회신 progress bar 만 — 가격 / 납기 컬럼 자체 없음
 *
 * 본 cluster 가 테이블 뷰에 가격/납기 2 컬럼 추가하여 카드↔테이블 consistency
 * 정합. 같은 데이터 (filteredQuotes) 다른 layout — 운영자가 토글 후에도
 * 같은 정보 식별 가능.
 *
 * canonical truth lock:
 *   - quote.responses[].totalPrice / quote.deliveryDate 변경 0
 *   - RelativeDeliveryText helper reuse (§11.223 lineage)
 *   - 기존 7 컬럼 (제목/상태/품목/회신/우선순위/등록/액션) 보존 + 2 추가
 *   - §11.217 Phase 6 viewMode toggle invariant 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("#quote-table-price-delivery-parity — thead 가격/납기 컬럼 추가", () => {
  it("thead 안 <th>가격</th> 추가 (text-right 가격 정렬)", () => {
    expect(page).toMatch(/<th[^>]{0,80}>가격<\/th>/);
  });

  it("thead 안 <th>납기</th> 추가", () => {
    expect(page).toMatch(/<th[^>]{0,80}>납기<\/th>/);
  });
});

describe("#quote-table-price-delivery-parity — tbody 가격 분기 (§11.223 mirror)", () => {
  it("테이블 분기 안 minPrice / maxPrice 변수 (range 계산)", () => {
    // 테이블 분기 (viewMode === 'table') 안에서 prices / minPrice / maxPrice
    // 변수 사용 (이미 카드 분기와 같은 변수명 — block scope 명확화 필요)
    expect(page).toMatch(/viewMode === "table"[\s\S]*?prices[\s\S]*?Math\.min[\s\S]*?Math\.max/);
  });

  it("미수신 시 '미수신' 또는 '—' fallback (slate-400/500 텍스트)", () => {
    // 테이블 분기 안 responseCount === 0 또는 prices.length === 0 시
    // "미수신" 텍스트 노출
    expect(page).toMatch(/viewMode === "table"[\s\S]*?(responseCount === 0|prices\.length === 0)[\s\S]*?미수신/);
  });

  it("수신 + range — minPrice === maxPrice 시 단일가, 다르면 range (~ 문자)", () => {
    // 테이블 분기 안 ₩ + 가격 + ~ 패턴
    expect(page).toMatch(/viewMode === "table"[\s\S]*?minPrice === maxPrice/);
    expect(page).toMatch(/viewMode === "table"[\s\S]*?₩\{minPrice[\s\S]{0,80}toLocaleString/);
  });
});

describe("#quote-table-price-delivery-parity — tbody 납기 (RelativeDeliveryText reuse)", () => {
  it("테이블 분기 안 RelativeDeliveryText 사용 (§11.223 helper reuse)", () => {
    expect(page).toMatch(/viewMode === "table"[\s\S]*?<RelativeDeliveryText[\s\S]{0,200}iso=\{quote\.deliveryDate\}/);
  });

  it("quote.deliveryDate null 시 '—' placeholder (테이블 분기 안)", () => {
    // 테이블 분기 안 quote.deliveryDate 분기 (null 시 — / 있을 시 RelativeDeliveryText)
    expect(page).toMatch(/viewMode === "table"[\s\S]*?quote\.deliveryDate\s*\?[\s\S]{0,500}RelativeDeliveryText|viewMode === "table"[\s\S]*?\{quote\.deliveryDate &&/);
  });
});

describe("#quote-table-price-delivery-parity — 기존 7 컬럼 invariant 보존", () => {
  it("§11.217 Phase 6 — 7 기존 컬럼 thead 보존 (§11.230b dynamic 후 COLUMN_LABEL 매핑)", () => {
    // §11.230b dynamic refactor 후 thead 가 visibleColumns.map() + COLUMN_LABEL 매핑.
    // 라벨 string 자체는 module-scope COLUMN_LABEL 안에 잔존.
    expect(page).toMatch(/"제목"/);
    expect(page).toMatch(/"상태"/);
    expect(page).toMatch(/"품목"/);
    expect(page).toMatch(/"회신"/);
    expect(page).toMatch(/"우선순위"/);
    expect(page).toMatch(/"등록"/);
    expect(page).toMatch(/"액션"/);
  });

  it("회신 progress bar tbody 보존 (responseCount/itemCount)", () => {
    expect(page).toMatch(/aria-valuenow=\{responseCount\}/);
  });

  it("등록 RelativeTimeText (§11.212) 보존", () => {
    expect(page).toMatch(/<RelativeTimeText iso=\{quote\.createdAt\}/);
  });

  it("viewMode toggle button + localStorage persist 보존", () => {
    expect(page).toMatch(/aria-pressed=\{viewMode === "table"\}/);
    expect(page).toMatch(/labaxis-quote-view-mode/);
  });

  it("cluster trace marker (§11.224)", () => {
    expect(page).toMatch(/#quote-table-price-delivery-parity|§11\.224|테이블 뷰 가격\/납기 parity/);
  });
});
