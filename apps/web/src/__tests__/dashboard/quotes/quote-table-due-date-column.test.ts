/**
 * §quote-management-redesign P1b — 마감(D-day) 컬럼 제거 (호영님 시안 정합)
 *
 * ★ §quote-flat Q3(마감 컬럼 신규) 역전: 시안 README "마감(D-day) 열 제거(우선순위 중심 운영)".
 *   - 컬럼 정의(ColumnKey/order/widths/visibility/COLUMN_LABEL) + tbody dueDate 셀 렌더 제거.
 *   - dd 파생(computePriority.dd)은 **저장/제거 아님** — 빠른필터(deadline_soon)·정렬에서 계속 사용(컬럼 비의존).
 *   - 회귀 0: 기존 컬럼(예상금액/다음단계)·SupplierAvatars·우선순위 dot·send-cta·정렬 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§quote-management-redesign P1b — 마감 컬럼 제거", () => {
  it("ColumnKey union 에 dueDate 부재", () => {
    expect(page).not.toMatch(/\|\s*"dueDate"/);
  });
  it("COLUMN_LABEL 에 dueDate '마감' 부재", () => {
    expect(page).not.toMatch(/dueDate:\s*"마감"/);
  });
  it("order 에 dueDate 부재 — price 다음 actions(마감 빠짐)", () => {
    expect(page).toMatch(/"price",\s*"actions"/);
    expect(page).not.toMatch(/"price",\s*"dueDate"/);
  });
  it("widths/visibility dueDate 키 부재", () => {
    expect(page).not.toMatch(/dueDate:\s*\d+,/);
    expect(page).not.toMatch(/dueDate:\s*true,/);
  });
  it("tbody key === 'dueDate' 분기 제거", () => {
    expect(page).not.toMatch(/if \(key === "dueDate"\)/);
  });
});

describe("§quote-management-redesign P1b — dd 파생 보존(저장/제거 아님)", () => {
  it("computePriority.dd 빠른필터(deadline_soon)에서 계속 사용", () => {
    expect(page).toMatch(/computePriority\(c\)\.dd/);
    expect(page).toMatch(/deadline_soon/);
  });
});

describe("§quote-management-redesign P1b — 회귀 0(기존 컬럼·셀·정렬 보존)", () => {
  it("기존 컬럼 라벨 보존(예상금액/다음단계)", () => {
    expect(page).toMatch(/price:\s*"예상금액"/);
    expect(page).toMatch(/actions:\s*"다음단계"/);
  });
  it("SupplierAvatars 공급사 셀 + 회신 진행바 보존", () => {
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
