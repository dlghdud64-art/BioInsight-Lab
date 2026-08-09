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
const COMP = root("components/products/product-completeness.tsx");
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
  it("100%면 배지 숨김 + computeCompleteness 사용", () => {
    expect(COMP).toMatch(/export function ProductCompleteness/);
    expect(COMP).toMatch(/computeCompleteness/);
    expect(COMP).toMatch(/if \(pct >= 100\) return null/);
  });
  it("미등록 = 역할별 액션 그리드 + 정보 요청(실 라우트 /support, dead button 0)", () => {
    // §product-detail-refinement Phase 3(3a7f6e01) — 1줄 축약(missingLabels.join) 폐기,
    //   resolveCompletenessActions 파생 그리드로 재작성. pd-b 를 그 설계로 진화(2026-07-26).
    expect(COMP).toMatch(/resolveCompletenessActions/);
    expect(COMP).toMatch(/href/);
    expect(COMP).toMatch(/정보 요청/);
  });
  it("§0-B amber-hex 완성도(빨강 0, amber/orange 클래스 0 — app-wide 가드 정합)", () => {
    // §product-detail-refinement §0-B(3a7f6e01) — arbitrary 클래스 bg-[#fbf0db] 폐기,
    //   style={{backgroundColor:"#fffbeb"}} 등 §0-B 8토큰으로 전환. refinement 계약⑦(구 hex 잔존 0)과 정합.
    //   CEO 2026-06-21 §11.302 hex 예외는 승계(클래스 금지·빨강 금지 불변).
    expect(COMP).toMatch(/#fffbeb|#92400e/);
    expect(COMP).not.toMatch(/bg-\[#fbf0db\]|#fbf0db/);
    expect(COMP).not.toMatch(/-amber-\d|-orange-\d/);
    expect(COMP).not.toMatch(/bg-red-|text-red-|border-red-/);
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
