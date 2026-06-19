/**
 * §quote-management P3b (PLAN_quote-management Phase 3) — 테이블 흡수(최소 diff)
 *
 * 호영님 결정(2026-06-19):
 *   - 회신 컬럼 = C 하이브리드: 공급사 실명 아바타(vendorRequests canonical) + 기존
 *     responseCount/itemCount progressbar 유지. 익명 점 폐기(§05).
 *   - price 정렬 추가. (우선순위 정렬·우선순위 단일화·칩 교체는 P4 — 본 sentinel 회귀 보호.)
 *   - responses(legacy QuoteResponse)와 vendorRequests(RFQ canonical)는 독립 모델 →
 *     회신 셀이 vendorRequests로 바뀌었으므로 회신 정렬도 vendorRequests 회신수로 재정렬(sort↔cell 정합).
 *
 * Truth lock: 현 테이블은 9컬럼 동적 시스템(columnPrefs). greenfield 8컬럼 아님.
 *   교체 대상 회신 셀은 익명 점이 아니라 sentinel-보호 progressbar → 하이브리드로 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PAGE = readFileSync(
  join(__dirname, "..", "..", "app/dashboard/quotes/page.tsx"),
  "utf8",
);

describe("§quote-management P3b — 회신 셀 공급사 실명 아바타(C 하이브리드)", () => {
  it("SupplierAvatars + toSuppliers import", () => {
    expect(PAGE).toMatch(/import \{ SupplierAvatars, toSuppliers \} from "@\/components\/quotes\/supplier-avatars"/);
  });
  it("회신 셀에 SupplierAvatars(vendorRequests canonical) 렌더", () => {
    expect(PAGE).toMatch(/<SupplierAvatars suppliers=\{toSuppliers\(quote\.vendorRequests\)\}/);
  });
  it("기존 회신 progressbar 보존(aria-valuenow=responseCount) — sentinel 회귀 0", () => {
    expect(PAGE).toMatch(/aria-valuenow=\{responseCount\}/);
  });
});

describe("§quote-management P3b — 정렬 재정렬 + price 정렬 추가", () => {
  it("회신 정렬 = vendorRequests 회신수 기준(responses legacy 폐기)", () => {
    expect(PAGE).toMatch(/respondedAt != null \|\| v\.status === "RESPONDED"/);
    // 구 responses.length 기반 회신 정렬 제거 확인
    expect(PAGE).not.toMatch(/cmp = \(a\.responses\?\.length \?\? 0\) - \(b\.responses\?\.length/);
  });
  it("price 정렬 키 — type union / validKeys / isSortable / comparator", () => {
    expect(PAGE).toMatch(/"responseCount" \| "price" \| "createdAt"/);
    expect(PAGE).toMatch(/"responseCount",\s+"price",/);
    expect(PAGE).toMatch(/key === "price"/);
    expect(PAGE).toMatch(/sortState\.key === "price"/);
  });
});

describe("§quote-management P3b — 회귀 0(P4 선점 금지·기존 보존)", () => {
  it("우선순위 단일화 — priorityLevel=computePriority(P4-core-B 도입), deriveRailState는 status 전용 유지", () => {
    // §quote-management-p4-core-b: P3b가 P4 까지 보류했던 computePriority 를 P4 가 도입(우선순위 단일 진실).
    //   이중화 방지 의도는 보존 — priorityLevel 이 computePriority 단일 소스, deriveRailState 는 status/rail/게이팅 전용
    //   (별개 축). 컬럼·카드 모두 computePriority 라 이중화 0.
    expect(PAGE).toMatch(/deriveRailState/); // status/rail 축 유지
    expect(PAGE).toMatch(/priorityLevel/);
    expect(PAGE).toMatch(/computePriority\(/); // P4 우선순위 단일 진실 도입
  });
  it("기존 정렬 키 보존(title/status/itemCount/responseCount/createdAt)", () => {
    expect(PAGE).toMatch(/sortState\.key === "title"/);
    expect(PAGE).toMatch(/sortState\.key === "responseCount"/);
    expect(PAGE).toMatch(/sortState\.key === "createdAt"/);
  });
  it("modeChip(빠른필터) 보존 — 칩 교체는 P4", () => {
    expect(PAGE).toMatch(/modeChip/);
  });
  it("퍼널 onStageClick wiring(P2) 보존", () => {
    expect(PAGE).toMatch(/onStageClick=\{/);
  });
});
