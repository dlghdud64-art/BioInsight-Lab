/**
 * §quote-flat Q3 — 견적 테이블 마감(D-day) 컬럼 신규 (시안 A 정합)
 *
 * 지시문 §04 + 시안 테이블 "마감" 컬럼. CEO 2026-06-21 결정: 신규 컬럼 추가(등록=createdAt 유지).
 *   - canonical: priorityResult.dd = daysUntil(computeDue) 재사용(별도 compute 0, 저장 0).
 *   - soon(D-2 이하·지남) = red 강조(지시문 §04). 마감 미정(null) = "—" 약화(가짜 마감 금지 §11.242 #8).
 *   - 컬럼프리퍼런스 시스템(ColumnKey/order/widths/visibility/COLUMN_LABEL) 정합 추가.
 *
 * 회귀 0 lock: 기존 컬럼·정렬·SupplierAvatars·우선순위 dot·액션 send-cta wiring 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§quote-flat Q3 — 마감(D-day) 컬럼 정의", () => {
  it("ColumnKey union 에 dueDate 추가", () => {
    expect(page).toMatch(/\|\s*"dueDate"/);
  });
  it('COLUMN_LABEL dueDate = "마감"', () => {
    expect(page).toMatch(/dueDate:\s*"마감"/);
  });
  it("DEFAULT_COLUMN_PREFS order 에 dueDate 포함(컬럼프리퍼런스 정합)", () => {
    expect(page).toMatch(/"createdAt",\s*"dueDate",\s*"actions"/);
  });
  it("widths/visibility dueDate 정의(망라성)", () => {
    expect(page).toMatch(/dueDate:\s*\d+,/); // widths
    expect(page).toMatch(/dueDate:\s*true,/); // visibility
  });
});

describe("§quote-flat Q3 — 마감 셀 렌더(canonical 재사용·가짜 마감 금지)", () => {
  it('tbody key === "dueDate" 분기', () => {
    expect(page).toMatch(/if \(key === "dueDate"\)/);
  });
  it("priorityResult.dd canonical 재사용(별도 compute 0)", () => {
    expect(page).toMatch(/key === "dueDate"[\s\S]{0,400}priorityResult\?\.dd/);
  });
  it("soon(D-2 이하) red 강조 + 마감 미정 '—' 약화", () => {
    expect(page).toMatch(/key === "dueDate"[\s\S]{0,700}dd <= 2/);
    expect(page).toMatch(/key === "dueDate"[\s\S]{0,1400}text-red-600/);
    expect(page).toMatch(/key === "dueDate"[\s\S]{0,900}dd == null \? "—"/);
  });
  it("§11.302 — 마감 셀 amber/orange 0", () => {
    const cell = page.slice(page.indexOf('if (key === "dueDate")'), page.indexOf('if (key === "actions")'));
    expect(cell).not.toMatch(/-amber-|-orange-/);
  });
});

describe("§quote-flat Q3 — 회귀 0(기존 컬럼·정렬·셀 보존)", () => {
  it("기존 컬럼 정의 보존(createdAt/actions)", () => {
    expect(page).toMatch(/createdAt:\s*"등록"/);
    expect(page).toMatch(/actions:\s*"액션"/);
  });
  it("SupplierAvatars 회신 셀 보존(§05·P3b)", () => {
    expect(page).toMatch(/<SupplierAvatars suppliers=\{toSuppliers\(quote\.vendorRequests\)\}/);
    expect(page).toMatch(/aria-valuenow=\{responseCount\}/);
  });
  it("우선순위 dot 보존(p4-core-B)", () => {
    expect(page).toMatch(/priorityLevel === "critical" \? "bg-red-500"/);
  });
  it("액션 send-cta wiring 보존(§11.279d-2)", () => {
    expect(page).toMatch(/data-testid=\{signals\.ctaLabel === "견적 요청 발송" \? "quote-table-direct-send-cta" : undefined\}/);
  });
  it("정렬 키 보존(price/createdAt)", () => {
    expect(page).toMatch(/sortState\.key === "price"/);
    expect(page).toMatch(/sortState\.key === "createdAt"/);
  });
});
