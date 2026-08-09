/**
 * §product-detail PD-E (§05) — 히어로 키 팩트(아는 값만)
 *
 * 지시문 §05 원칙2(아는 것을 위로). 등급·제조사를 히어로 상단에 노출(빈 값 숨김).
 *   분류는 기존 태그, Cat.No·완성도는 본문 — 중복 0. 가짜 채움 0(있을 때만).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DETAIL = readFileSync(
  join(__dirname, "..", "..", "app/products/[id]/page.tsx"),
  "utf8",
);

describe("§product-detail PD-E(§05) — 히어로 키 팩트", () => {
  /* 🔁 은퇴→승계 (§product-detail-sourcing-v21 §2, 호영님 승인 2026-08-09)
   *    ⛔ 결정 반전: 2026-06-20 "시안대로 내부 등급 노출" 재결정을 **철회**한다.
   *       출처(대장) · 내부 등급 = 내부 용어 메타로 buyer 구매 판단과 무관 → 히어로 팩트 행 자체를 폐기.
   *       안전 위험도는 안전·규제 카드로 단일화(히어로 이중 표기 제거).
   *       분류는 Badge 칩 1개로 충분 — 팩트 행이 사라지며 모바일 4열 flex 붕괴도 동반 해소.
   *    존치: product.grade 직접 렌더 0 가드(§sourcing-product-surface 정합)는 아래에서 계속 잠근다. */
  it("히어로 내부 용어 메타 0 — 출처·내부 등급·팩트 행 폐기", () => {
    expect(DETAIL).not.toMatch(/label: "출처"/);
    expect(DETAIL).not.toMatch(/label: "내부 등급"/);
    expect(DETAIL).not.toMatch(/label: "안전 위험도"/);
    expect(DETAIL).not.toMatch(/\{product\.grade\}/); // §sourcing-product-surface 정합 유지
  });
  it("PD-M 히어로 통합 — Cat.No 배지 보존 + 미등록 1줄 승계", () => {
    expect(DETAIL).toMatch(/<span className="text-\[11px\] text-slate-500">Cat\.No<\/span>/);
    expect(DETAIL).toMatch(/<PendingInfoRow[\s\S]{0,200}?product=\{product\}/);
    expect(DETAIL).not.toMatch(/실험\/제품 정보<\/CardTitle>/); // "실험/제품 정보" 제목 제거(시안 정합)
  });
  it("회귀 0 — 분류 태그 보존 · 중복 제품 사양 카드 폐기", () => {
    expect(DETAIL).toMatch(/PRODUCT_CATEGORIES\[product\.category/);
    // §v21 §2 — "제품 사양" 통합 카드(PD-J) 삭제: Cat.No·분류는 히어로가 canonical, 추가 스펙은 내부 용어.
    expect(DETAIL).not.toMatch(/Cat\.No \(카탈로그 번호\)/);
  });
});
