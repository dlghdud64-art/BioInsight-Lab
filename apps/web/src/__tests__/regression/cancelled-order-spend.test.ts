/**
 * §cancelled-order-spend (2026-09-16 · 릴레이 P1) · **취소된 발주는 지출 합계에 들어가지 않는다.**
 *
 * ── 왜 ──
 * `/api/dashboard/stats` 의 `totalPurchaseAmount` 가 발주를 **상태 필터 없이** 합산했다.
 *   prod 실측 2026-09-16(로컬 operator-shell → Supabase xhid… · SELECT only):
 *     Order 2행이 둘 다 CANCELLED(각 ₩850,000)인데 총 구매액이 ₩1,700,000 으로 떴다.
 *     취소 제외 시 0 — 즉 화면에 뜬 지출 전액이 취소분이었다.
 * 예산 소진율·지출 분석이 이 값을 딛고 서므로, 취소분 포함은 근거 없는 지출이다.
 * 같은 데이터를 보는 `/api/dashboard/summary` 의 확정 발주액은 이미 상태를 가리고 있었다 —
 * **같은 명제를 한 화면에서만 지키면 형제 슬롯이 남는다**(CLAUDE.md §형제 슬롯 전수).
 *
 * ── 이 파일이 안 보는 것 (자기 한계) ──
 *   1. 런타임 값(소스 형태만 본다) · 2. 다른 금액 축(예산 이벤트·PurchaseRecord 원장) ·
 *   3. 보관(archivedAt) 발주 — 취소와 다른 축이라 의도적으로 포함을 유지한다 ·
 *   4. 발주(Order)와 지출 원장(PurchaseRecord)이 서로 참조하지 않는 구조 자체(별건 큐).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");
const code = (rel: string) => stripComments(readFileSync(join(SRC, rel), "utf8"));

const STATS = "app/api/dashboard/stats/route.ts";
const SUMMARY = "app/api/dashboard/summary/route.ts";

/**
 * 선언 시작 ↔ **문장 끝**(깊이 0 의 세미콜론)으로 창을 연다.
 * 고정 폭 슬라이스 금지(CLAUDE.md 4원칙 ⑤) · 첫 닫는 괄호로 끊으면 `(orders as T[])` 같은
 * 캐스트에서 창이 조기 종료된다(2026-09-16 실측 — 이 검사를 쓰다 그 자리에서 밟았다).
 */
function declBlock(src: string, decl: string): string {
  const start = src.indexOf(decl);
  expect(start, `선언을 찾지 못함: ${decl}`).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    else if (c === ";" && depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`문장 끝을 찾지 못함: ${decl}`);
}

describe("§cancelled-order-spend · 취소 발주는 지출이 아니다", () => {
  it("① totalPurchaseAmount 산식이 CANCELLED 를 가른다", () => {
    const block = declBlock(code(STATS), "const totalPurchaseAmount =");
    expect(block).toMatch(/CANCELLED/);
    expect(block).toMatch(/order\.totalAmount/);
  });

  it("② 취소 발주도 건수 통계에는 남는다 (지출만 빼고 운영 현황은 보존)", () => {
    const src = code(STATS);
    expect(src).toMatch(/const ordersByStatus = orders\.reduce\(/);
  });

  it("③ 형제 슬롯 · summary 의 확정 발주액은 상태 집합을 리터럴로 고정한다", () => {
    const block = declBlock(code(SUMMARY), "const confirmedAmount =");
    for (const s of ["CONFIRMED", "SHIPPING", "DELIVERED"]) expect(block).toContain(s);
    expect(block).not.toContain("CANCELLED");
  });

  it("④ 지출 합계 키는 payload 에 남아 있다 (키 삭제·개명으로 '고쳤다' 하지 않는다)", () => {
    // 응답 객체의 **키 자리**를 본다 — 값 참조(`x: totalPurchaseAmount`)는 키 보존이 아니다.
    expect(code(STATS)).toMatch(/^\s*totalPurchaseAmount,\s*$/m);
  });
});
