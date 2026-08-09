/**
 * §product-detail PD-J (§05 레이아웃) — "제품 사양" 카드 통합
 *
 * 시안: 흩어진 독립 Cat.No 블록 + "추가 스펙 정보" 카드를 하나의 "제품 사양" 카드로 통합
 *   (카탈로그 번호 + 분류 + 추가 스펙(출처 등, §03 매핑·grade 숨김)).
 *   §125 "상세 스펙 (Specifications)"(규격/규제) 그리드는 별도 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DETAIL = readFileSync(
  join(__dirname, "..", "..", "app/products/[id]/page.tsx"),
  "utf8",
);

describe("§product-detail PD-J(§05) — 제품 사양 카드 (은퇴)", () => {
  /* 🔁 은퇴 (§product-detail-sourcing-v21 §2, 호영님 승인 2026-08-09)
   *    PD-J 는 "흩어진 Cat.No 블록 + 추가 스펙 카드를 하나로 통합" 이 목적이었다.
   *    v21 §2 에서 그 통합 카드 자체가 **히어로와 100% 중복**(Cat.No·분류)이고 나머지(출처·내부 등급)는
   *    내부 용어 메타로 판정되어 표면에서 삭제됐다 → 통합 대상이 사라졌으므로 계약 소멸.
   *    PD-J 가 실제로 막던 회귀(Cat.No 중복 표기 · '추가 스펙 정보' 별도 카드 부활)는 아래 두 it 이 계속 잠근다. */
  it("Cat.No 중복 표기 0 — 히어로 단독 canonical", () => {
    expect((DETAIL.match(/Cat\.No \(카탈로그 번호\)/g) || []).length).toBe(0);
    expect(DETAIL).toMatch(/text-\[13px\] font-mono font-semibold text-slate-900">\{product\.catalogNumber\}/);
  });
  it("분류는 히어로 Badge 로 보존(정보 손실 0)", () => {
    expect(DETAIL).toMatch(/PRODUCT_CATEGORIES\[product\.category/);
  });
  it("'추가 스펙 정보' 별도 카드 폐기 + 독립 Cat.No 블록 폐기", () => {
    expect(DETAIL).not.toMatch(/추가 스펙 정보/);
    expect(DETAIL).not.toMatch(/<h3 className="font-semibold text-sm">Cat\.No/);
  });
  it("회귀 0 — §125 상세 스펙(규격/규제) 그리드 보존", () => {
    expect(DETAIL).toMatch(/상세 스펙 \(Specifications\)/);
    expect(DETAIL).toMatch(/등록된 상세 스펙이 없습니다/);
  });
});
