/**
 * §krw-calc-single-source (2026-09-17 · 릴레이 지시 3) · **원화 계산은 원통화가 KRW 인 행만 쓴다.**
 *
 * ── 왜 ──
 * `ProductVendor.priceInKRW` 는 환율로 계산된 값이 아니었다(prod 가격 행 9개 전부 시드 리터럴 ·
 * 원화/원통화 비율 USD 1368.4~1384.6 제각각 · EUR 1540.5 · 2026-09-17 실측). 표시는 72f55383 에서
 * 원통화로 바꿨지만, 비교 금액·견적 단가·최저가 계산은 여전히 그 열을 원화로 읽었다.
 * 시드 가격 행 9개를 지운 지금(2026-09-17 D안 · 잔존 가격 행 0) 입력이 0이라 옮기기 가장 안전하다.
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① 옮긴 파일(아래 CONVERTED)은 priceInKRW 를 직접 읽지 않고 krwAmount 를 거친다.
 *   ② priceInKRW 를 **직접 읽는 파일 집합**을 고정한다 — 새 직접 읽기가 생기면 RED, 옮기면 목록에서 지운다.
 *   ③ 남은 목록에는 소유자와 만료일이 있다(CLAUDE.md §예외 목록에는 만료일과 소유자).
 *
 * ── 이 파일이 안 보는 것 (자기 한계) ──
 *   1. 타입 선언·orderBy 키(`priceInKRW: "asc"`)·API 응답 필드 전달 — 읽기가 아니라 모양이라 세지 않는다.
 *   2. 문자열 키 접근(`v["priceInKRW"]`) · 구조 분해(`const { priceInKRW } = v`). 2026-09-17 grep 기준 0.
 *   3. 계산 결과가 맞는지(런타임) — 오늘 가격 행 0 이라 실측 불가.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");
const code = (rel: string) => stripComments(readFileSync(join(SRC, rel), "utf8"));
/** 멤버 접근으로 읽는가 — `v.priceInKRW` · `v?.priceInKRW` (타입 선언·객체 키는 제외) */
const READS = /[?.]\s*priceInKRW\b/;

const CONVERTED = [
  "app/_workbench/search/page.tsx",
  "app/_workbench/_components/compare-review-work-window.tsx",
  "app/_workbench/_components/share-actions-card.tsx",
  "app/_workbench/_components/candidate-products-card.tsx",
  "app/_workbench/_components/sourcing-spec-compare-section.tsx",
  "lib/api/quotes.ts",
  "app/api/protocol/bom/route.ts",
];

/**
 * 아직 priceInKRW 를 직접 읽는 파일 — 2026-09-17 전수(주석 제거 · 멤버 접근 기준 23 = 아래 22 + 규칙 모듈).
 * 🛑 소유자·만료일이 있는 **줄어드는 목록**이다. 늘리지 말 것. 옮기면 지우고 커밋에 적는다.
 * 소유자: operator §krw-calc-single-source 2차 · 만료: 2026-10-17 (지나면 ③ RED)
 * 🔑 견적 흐름 위에 있는 것부터: add-product-to-quote(견적 담기 단가) · markPurchased(구매 기록 금액 폴백) ·
 *    request-assembly-work-window(요청 조립 금액).
 */
const REMAINING = [
  "app/_workbench/_components/search-result-item.tsx", // 렌더 도달 불가(importer 0)
  "app/api/cart/route.ts",
  "app/api/inventory/reorder-recommendations/route.ts",
  "app/api/products/[id]/alternatives/route.ts", // 응답에 price·currency 동반(72f55383) · 유사도 minPrice 계산
  "app/api/products/search/route.ts", // 가격 정렬 비교
  "app/api/quotes/[id]/markPurchased.ts",
  "app/api/quotes/cost-optimization/route.ts",
  "app/api/quotes/optimize-combination/route.ts",
  "app/api/shared-lists/route.ts",
  "app/dashboard/supplier/page.tsx",
  "components/inventory/reorder-recommendations.tsx",
  "components/products/personalized-recommendations.tsx",
  "components/sourcing/request-assembly-work-window.tsx",
  "lib/ai/builders.ts",
  "lib/ai/collaborative-filtering.ts",
  "lib/ai/inventory-restock-detector.ts",
  "lib/ai/optimized-recommendations.ts",
  "lib/ai/suggestion-engine.ts",
  "lib/catalog/bom-product-match.ts",
  "lib/compare-workspace/compare-engine.ts",
  "lib/quote/add-product-to-quote.ts",
  "lib/utils/export-comparison.ts",
];
const REMAINING_EXPIRES = "2026-10-17";

function walk(): string[] {
  const out: string[] = [];
  const visit = (abs: string) => {
    for (const name of readdirSync(abs)) {
      if (name === "__tests__" || name === "node_modules" || name === "generated") continue;
      const p = join(abs, name);
      if (statSync(p).isDirectory()) visit(p);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(relative(SRC, p).split("\\").join("/"));
    }
  };
  visit(SRC);
  return out;
}

describe("§krw-calc-single-source · 원화 계산 단일 규칙", () => {
  it("① 옮긴 파일은 priceInKRW 를 직접 읽지 않고 krwAmount 를 거친다", () => {
    for (const rel of CONVERTED) {
      const src = code(rel);
      expect(READS.test(src), `${rel} · priceInKRW 직접 읽기`).toBe(false);
      expect(src, `${rel} · krwAmount 미사용`).toMatch(/krwAmount\s*\(/);
    }
  });

  it("② priceInKRW 를 직접 읽는 파일 집합이 고정돼 있다 (규칙 모듈 + 남은 목록)", () => {
    const readers = walk().filter((rel) => READS.test(code(rel))).sort();
    expect(readers).toEqual(["lib/pricing/display-price.ts", ...REMAINING].sort());
  });

  it("③ 남은 목록은 만료 전이다", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(today <= REMAINING_EXPIRES, `남은 목록 만료(${REMAINING_EXPIRES}) · 옮기거나 재승인`).toBe(true);
  });
});
