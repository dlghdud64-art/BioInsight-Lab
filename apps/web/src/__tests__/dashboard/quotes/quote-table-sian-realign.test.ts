/**
 * §quote-table-sian P2 — 견적 테이블 시안 A 컬럼 셋 재정의 (CEO 2026-06-21)
 *
 * 시안 A 8컬럼: 견적케이스(title) · 공급사(supplier 아바타) · 단계(status) · 회신(responseCount 바) ·
 *   우선순위(priority) · 예상금액(price always) · 마감(dueDate) · 다음단계(actions).
 * 제거: 품목(itemCount) · 등록(createdAt) · 납기(delivery).
 *
 * canonical truth lock:
 *   - 운영 wiring(배치선택·정렬·키보드·sticky·columnPrefs·dispatch·send-cta) 보존 — 셀/컬럼만 시안.
 *   - quote.responses / vendorRequests / computePriority 변경 0.
 *   - dead button / no-op / fake handoff 0.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§quote-table-sian P2 — ColumnKey 8 셋 (제거 키 부재)", () => {
  it("ColumnKey union 에 supplier 추가", () => {
    expect(page).toMatch(/\|\s*"supplier"/);
  });

  it("DEFAULT_COLUMN_PREFS order = 7컬럼 순서 고정 (§quote-management-redesign P1b — 마감 제거)", () => {
    expect(page).toMatch(
      /order:\s*\[\s*"title",\s*"supplier",\s*"status",\s*"responseCount",\s*"priority",\s*"price",\s*"actions"\s*\]/,
    );
  });

  it("widths/visibility supplier 정의(망라성)", () => {
    expect(page).toMatch(/supplier:\s*\d+,/); // widths
    expect(page).toMatch(/supplier:\s*true,/); // visibility
  });

  it("제거 컬럼 키 부재 — tbody render 분기 0 (sort comparator sortState.key 는 보존·제외)", () => {
    // tighten(meta-rule, 약화 아님): sortState.key === "X"(sort comparator, 게이트#2 보존 대상,
    //   앞에 '.')는 제외하고 bare render 분기(if (key === "X"))만 검출. lookbehind (?<!\.)로 한정.
    expect(page).not.toMatch(/(?<!\.)key === "itemCount"/);
    expect(page).not.toMatch(/(?<!\.)key === "createdAt"/);
    expect(page).not.toMatch(/(?<!\.)key === "delivery"/);
    // §quote-management-redesign P1b — 마감 tbody 분기 제거(sort comparator는 비대상).
    expect(page).not.toMatch(/(?<!\.)key === "dueDate"/);
  });

  it("제거 컬럼 라벨 부재 — COLUMN_LABEL 품목/등록/납기/마감 0", () => {
    expect(page).not.toMatch(/itemCount:\s*"품목"/);
    expect(page).not.toMatch(/createdAt:\s*"등록"/);
    expect(page).not.toMatch(/delivery:\s*"납기"/);
    expect(page).not.toMatch(/dueDate:\s*"마감"/);
  });
});

describe("§quote-table-sian P2 — COLUMN_LABEL 시안 라벨", () => {
  const cases: Array<[string, string]> = [
    ["title", "견적케이스"],
    ["supplier", "공급사"],
    ["status", "단계"],
    ["responseCount", "회신"],
    ["priority", "우선순위"],
    ["price", "예상금액"],
    ["actions", "다음단계"],
  ];
  for (const [key, label] of cases) {
    it(`${key} = "${label}"`, () => {
      expect(page).toMatch(new RegExp(`${key}:\\s*"${label}"`));
    });
  }
});

describe("§quote-table-sian P2 — 셀 정합", () => {
  it("공급사 셀 — SupplierAvatars 전용(회신에서 분리)", () => {
    expect(page).toMatch(
      /key === "supplier"[\s\S]{0,400}<SupplierAvatars suppliers=\{toSuppliers\(quote\.vendorRequests\)\}/,
    );
  });

  it("회신 셀 — 진행 바만(아바타 미포함, progressbar 보존)", () => {
    // responseCount 셀 안에 SupplierAvatars 없음 + progressbar 잔존.
    const start = page.indexOf('if (key === "responseCount")');
    const end = page.indexOf('if (key === "price")', start);
    const cell = page.slice(start, end);
    expect(cell).not.toMatch(/SupplierAvatars/);
    expect(cell).toMatch(/aria-valuenow=\{responseCount\}/);
  });

  it("예상금액 — always 노출 + 컬럼 설정 보호", () => {
    expect(page).toMatch(/key\s*===\s*"price"\)\s*return true/);
    expect(page).toMatch(/isProtected\s*=\s*key\s*===\s*"price"/);
  });

  it("§11.302 신호색 — supplier 셀 amber/orange 0", () => {
    const start = page.indexOf('if (key === "supplier")');
    const end = page.indexOf('if (key === "responseCount")', start);
    const cell = page.slice(start, end);
    expect(cell).not.toMatch(/-amber-|-orange-/);
  });
});

describe("§quote-table-sian P3 — 셀 re-skin (시안 시각 정합)", () => {
  it("견적케이스 — quoteRef(ref mono) + 품목명 2단", () => {
    expect(page).toMatch(/const quoteRef = quoteDisplayRef\(quote\)/);
    // tbody 렌더 분기(if) 앵커 — 헤더 isSortable/width occurrence 회피 + P3 verbose 주석 거리 수용.
    expect(page).toMatch(/if \(key === "title"\)[\s\S]{0,1000}font-mono[\s\S]{0,80}\{quoteRef\}/);
  });

  it("단계 — 색 dot(stageDot) + rounded-full 칩(§11.302 신호색)", () => {
    // §quote-screen-sian P6 — 단계칩 §12 색 정합 주석(P6.1) 추가로 거리 확대 → if(key==="status") 렌더 앵커 +
    //   한도 확대. stageDot(L2845, 703자)·outer 칩 rounded-full text-[10px](L2853)→dot ${stageDot}(L2860) 실재.
    expect(page).toMatch(/if \(key === "status"\)[\s\S]{0,900}const stageDot\s*=/);
    expect(page).toMatch(/if \(key === "status"\)[\s\S]{0,1600}rounded-full text-\[10px\][\s\S]{0,1200}stageDot/);
  });

  it("우선순위 — pill + 사유(priorityResult.reason 재사용), dot 색 패턴 보존", () => {
    expect(page).toMatch(/const priorityReason = priorityResult\?\.reason/);
    expect(page).toMatch(/key === "priority"[\s\S]{0,800}priorityReason/);
    expect(page).toMatch(/priorityLevel === "critical" \? "bg-red-500" : "bg-yellow-500"/);
  });

  it("예상금액 — hybrid(실값 ₩range / 없으면 '견적 대기')", () => {
    expect(page).toMatch(/if \(key === "price"\)[\s\S]{0,700}prices\.length === 0[\s\S]{0,150}견적 대기/);
    expect(page).toMatch(/if \(key === "price"\)[\s\S]{0,1000}₩\{minPrice/);
  });

  it("다음단계 — rounded-full pill + send-cta wiring 보존", () => {
    expect(page).toMatch(/if \(key === "actions"\)[\s\S]{0,2600}rounded-full text-\[11px\]/);
    expect(page).toMatch(/data-testid=\{signals\.ctaLabel === "견적 요청 발송" \? "quote-table-direct-send-cta" : undefined\}/);
    expect(page).toMatch(/handleQuoteCardSelect\(quote\.id, signals\.ctaLabel\)/);
  });
});

describe("§quote-table-sian P2 — 운영 wiring 무회귀(셀만 시안·골격 유지)", () => {
  it("send-cta data-testid 보존", () => {
    expect(page).toMatch(
      /data-testid=\{signals\.ctaLabel === "견적 요청 발송" \? "quote-table-direct-send-cta" : undefined\}/,
    );
  });

  it("handleQuoteCardSelect 분기 보존", () => {
    expect(page).toMatch(/handleQuoteCardSelect\(quote\.id, signals\.ctaLabel\)/);
  });

  it("배치선택 / 정렬 / sticky / columnPrefs 보존", () => {
    expect(page).toMatch(/selectedQuoteIds/);
    expect(page).toMatch(/handleSortColumn/);
    expect(page).toMatch(/sticky right-0/);
    expect(page).toMatch(/const visibleColumns = useMemo<ColumnKey\[\]>/);
  });

  it("우선순위 dot 보존(p4-core-B)", () => {
    expect(page).toMatch(/priorityLevel === "critical" \? "bg-red-500"/);
  });
});
