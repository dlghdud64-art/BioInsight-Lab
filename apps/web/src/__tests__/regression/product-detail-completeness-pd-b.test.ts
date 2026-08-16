/**
 * §product-detail PD-B (§04·§05) — 완성도(8필드 고정) + 미등록 1줄 축약(정직)
 *
 * 호영님 확정: 완성도 % = 채워진 8필드 / 8 × 100, 분모 8 고정(필드 골라 조작 금지).
 *   8필드: catalogNumber·specification·regulatoryCompliance·grade·manufacturer·
 *          usageDescription·storageCondition·msdsUrl.
 *   100%면 배지 숨김. §11.302 yellow(빨강 금지). 미등록 1줄 + 정보 요청(/support 실 이동).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = (rel: string) => readFileSync(join(__dirname, "..", "..", rel), "utf8");
const LIB = root("lib/product-detail/completeness.ts");
const PAGE = root("app/products/[id]/page.tsx");

describe("§product-detail PD-B(§04) — 완성도 엔진(8필드 고정 분모)", () => {
  it("산정 8필드 고정(정직 — 어려운 필드 포함)", () => {
    for (const k of [
      "catalogNumber", "specification", "regulatoryCompliance", "grade",
      "manufacturer", "usageDescription", "storageCondition", "msdsUrl",
    ]) {
      expect(LIB).toMatch(new RegExp(`key: "${k}"`));
    }
  });
  it("분모 = 카테고리 적용 필드(§completeness-category-denominator 교체) + isEmpty 정직", () => {
    // CEO 결정 교체(2026-07-26): 분모 8 고정 → applicableFields(category).length.
    //   부풀리기 방지는 universal 하한(5)·null→8 폴백으로 계승(§denominator 계약③).
    expect(LIB).toMatch(/applicableFields\(/);
    expect(LIB).toMatch(/known \/ total/);
    expect(LIB).toMatch(/toLowerCase\(\) === "null"/);
  });
});

describe("§product-detail PD-B(§04·§05) — 완성도 바 + 미등록 축약", () => {
  it("산정 계층을 컴포넌트가 직접 쓴다(자체 계산 0)", () => {
  });
});

describe("§product-detail PD-B — page 삽입", () => {
  /* 🔁 은퇴→승계 (§product-detail-sourcing-v21 §1, 호영님 승인 2026-08-09)
   *    완성도 게이지(%+체크리스트)는 buyer 화면에서 은퇴 — 행동 불가한 내부 데이터 품질 정보가 상단을 점유했다.
   *    완성도 관리는 공급사/관리자 콘솔 몫. 산정 계층(위 LIB 단언)은 그 콘솔용으로 **전량 존치**.
   *    buyer 표면 승계자 = PendingInfoRow(미등록 접힌 1줄 + 탭 시 목록, 액션 0). */
  it("PendingInfoRow import + 렌더(구 ProductCompleteness 승계)", () => {
    expect(PAGE).toMatch(/import \{ PendingInfoRow \}/);
    expect(PAGE).toMatch(/<PendingInfoRow[\s\S]{0,200}?product=\{product\}/);
  });
});
