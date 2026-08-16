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
  it("산정 계층을 컴포넌트가 직접 쓴다(자체 계산 0)", () => {
    // 🛑 은퇴 예정 (b) 정책 계약 — 재조준 완료 — dead file(product-completeness.tsx, importer 0) 대상.
    //    재조준 완료 → succession (b-4) 산정 계층 단일 출처
    //    삭제는 §0-B-succession 다음 배치. 이 주석이 있는 동안 통과해도 방어력 0.
    expect(COMP).toMatch(/computeCompleteness/);
  });
  // 🔁 (d) 결정 은퇴 — v21 §1(2026-08-09 호영님 승인)이 이 계약을 뒤집었다.
  //    위 it 과 한 블록이었으나 (b)/(d) 혼재라 분리했다 — skip 은 it 단위라 섞이면 못 가른다.
  //    삭제하지 않는다: 이력이고, §0-B-succession b-5 의 근거다.
  it.skip("100%면 배지 숨김 (게이지 은퇴 — 승계 조건은 succession b-5)", () => {
    expect(COMP).toMatch(/if \(pct >= 100\) return null/);
  });
  // 🔁 (d) 결정 은퇴 — v21 §1(2026-08-09 호영님 승인)이 이 계약을 뒤집었다.
  //    삭제하지 않는다: 이력이고, §0-B-succession b-5·b-6 의 근거다.
  //    skip 인 이유 — dead file 대상이라 통과해도 방어력 0. 정책은 succession 이 라이브로 진다.
  it.skip("미등록 = 역할별 액션 그리드 + 정보 요청(실 라우트 /support, dead button 0)", () => {
    // §product-detail-refinement Phase 3(3a7f6e01) — 1줄 축약(missingLabels.join) 폐기,
    //   resolveCompletenessActions 파생 그리드로 재작성. pd-b 를 그 설계로 진화(2026-07-26).
    // 🛑 은퇴 예정 (d) 결정 은퇴 — 3분류 밖(신설) — dead file(product-completeness.tsx, importer 0) 대상.
    //    결정 은퇴 — v21 §1 이 buyer 액션 0 으로 뒤집음. 역방향 잠금은 succession (b-6)
    //    삭제는 §0-B-succession 다음 배치. 이 주석이 있는 동안 통과해도 방어력 0.
    expect(COMP).toMatch(/resolveCompletenessActions/);
    // 🛑 은퇴 예정 (d) 결정 은퇴 — 3분류 밖(신설) — dead file(product-completeness.tsx, importer 0) 대상.
    //    결정 은퇴 — 동상. buyer 에게 링크 미생성이 현행 정책(dead link 0)
    //    삭제는 §0-B-succession 다음 배치. 이 주석이 있는 동안 통과해도 방어력 0.
    expect(COMP).toMatch(/href/);
    // 🛑 은퇴 예정 (d) 결정 은퇴 — 3분류 밖(신설) — dead file(product-completeness.tsx, importer 0) 대상.
    //    결정 은퇴 — 동상. 요청 링크도 buyer 미생성
    //    삭제는 §0-B-succession 다음 배치. 이 주석이 있는 동안 통과해도 방어력 0.
    expect(COMP).toMatch(/정보 요청/);
  });
  it("빨강 0 (§0-B 토큰 단언 2건은 ratchet 승계·클래스 단언은 302d6d2 중복으로 삭제됨)", () => {
    // §product-detail-refinement §0-B(3a7f6e01) — arbitrary 클래스 bg-[#fbf0db] 폐기,
    //   style={{backgroundColor:"#fffbeb"}} 등 §0-B 8토큰으로 전환. refinement 계약⑦(구 hex 잔존 0)과 정합.
    //   CEO 2026-06-21 §11.302 hex 예외는 승계(클래스 금지·빨강 금지 불변).
    // 🛑 은퇴 예정 (b) 정책 계약 — 재조준 완료 — dead file(product-completeness.tsx, importer 0) 대상.
    //    재조준 완료 → succession (b-2) 미등록 표면 red 0
    //    삭제는 §0-B-succession 다음 배치. 이 주석이 있는 동안 통과해도 방어력 0.
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
