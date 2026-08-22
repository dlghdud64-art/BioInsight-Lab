/**
 * §order-entry-rewire P1 — 진입점 재배선 sentinel (PLAN_order-entry-rewire · P3 대상 · 현재 RED)
 *
 * 판정(호영님 2026-08-22): 운영 브리핑 dock 삭제 · /quotes/[id] 은퇴(§11.39 리다이렉트
 * 흡수) · 견적 관리 행 "발주 준비" → 주문 접수 다이얼로그 직접 · 경로 C 은퇴.
 * 이 파일은 P3 완료 시점의 사실을 미리 잠근다 — P3 전까지 RED 가 정상이다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");

const QUOTES_WB = "src/app/dashboard/quotes/page.tsx";
const LEGACY_DETAIL = "src/app/quotes/[id]/page.tsx";
const PO_NEW = "src/app/dashboard/purchase-orders/new/page.tsx";
const MY_ORDERS = "src/app/my/orders/page.tsx";

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

describe("① 운영 브리핑 은퇴 — 재유입 0", () => {
  it("브리핑 진입 버튼·발주 실행 검토 CTA 가 없다", () => {
    const code = stripComments(read(QUOTES_WB));
    expect(code).not.toMatch(/운영 브리핑 열기/);
    expect(code).not.toMatch(/발주 실행 검토/);
  });
});

describe("② 행 CTA → 주문 접수 다이얼로그 직접", () => {
  it("견적 관리 안에 주문 접수 다이얼로그(예산 선택 축)가 있다", () => {
    const src = read(QUOTES_WB);
    expect(src).toMatch(/주문 접수/);
    expect(src).toMatch(/결제할 과제/);
    /* 금액 축 — vendorRequestId 없이 보내면 totalAmount 0 (금일 실측). 이식 필수 축 */
    expect(src).toMatch(/vendorRequestId/);
  });
});

describe("③ /quotes/[id] — §11.39 리다이렉트 흡수", () => {
  it("페이지가 서버 리다이렉트 스텁이다 — 구 페이지 코드 재유입 0", () => {
    const src = read(LEGACY_DETAIL);
    expect(src).toMatch(/redirect\(/);
    /* 공유 URL 착지 보존 — same-canvas selected 파라미터로 */
    expect(src).toMatch(/dashboard\/quotes\?selected=/);
    const code = stripComments(src);
    expect(code).not.toMatch(/주문 접수 요청/);
    expect(code).not.toMatch(/createOrderMutation/);
  });
});

describe("④ 경로 C 은퇴 — draft 재유입 0", () => {
  it("purchase-orders/new 가 /api/orders/draft 를 부르지 않는다", () => {
    expect(stripComments(read(PO_NEW))).not.toMatch(/orders\/draft/);
  });
});

describe("⑤ 취소 CTA — release 의 UI 진입점", () => {
  it("/my/orders 에 주문 취소 진입이 있다 (ORDERED 한정 · CANCELLED PATCH)", () => {
    const src = read(MY_ORDERS);
    expect(src).toMatch(/주문 취소/);
    expect(src).toMatch(/CANCELLED/);
  });
});
