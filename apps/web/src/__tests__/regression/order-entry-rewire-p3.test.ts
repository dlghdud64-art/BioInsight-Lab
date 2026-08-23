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

describe("① 발주 경로는 운영 브리핑을 경유하지 않는다 (호영님 판정 2026-08-22 · 범위 정정)", () => {
  /* 🛑 P1 단언 재조준. 옛 축: 브리핑 전면 은퇴("운영 브리핑 열기" 문자열 0)를 요구했다.
   * P3-2 착수 실측이 전제를 뒤집었다 — 브리핑 rail(542줄)+모바일 sheet(195줄)은
   * 발주 전용이 아니라 다른 5개 상태(발송·회신·재요청·비교·조건확인·승인)의 CTA 가
   * 워크윈도우로 가는 유일한 경유지였다. 전면 삭제는 그 5개를 dead 로 만든다.
   * 호영님 판정: 발주 경로만 직결 · rail 은 다른 상태에서 무손상 유지.
   * → "운영 브리핑 열기"(모바일 브리핑 진입 · 다른 상태용) 단언 은퇴.
   * 대체 잠금(아래 3건): 발주 경로가 rail 을 경유하지 않는다는 사실을 직접 잠근다. */
  it("행 CTA '발주 실행 준비' 는 rail 을 거치지 않고 주문 접수 창으로 직행한다", () => {
    const code = stripComments(read(QUOTES_WB));
    expect(code).toMatch(/ctaLabel === "발주 실행 준비"[\s\S]{0,200}?setActiveWorkWindow\("po_conversion"\)/);
  });

  it("po_conversion 중에는 브리핑 rail·모바일 sheet 가 뜨지 않는다 (2곳 모두)", () => {
    const code = stripComments(read(QUOTES_WB));
    const guarded = code.match(/activeWorkWindow !== "request_send" && activeWorkWindow !== "po_conversion"/g) ?? [];
    expect(guarded.length).toBe(2);
  });

  it("⛔ '발주 실행 검토' 재유입 0 — 그 창의 이름은 이제 주문 접수다", () => {
    const code = stripComments(read(QUOTES_WB));
    expect(code).not.toMatch(/발주 실행 검토/);
    expect(code).toMatch(/railCtaLabel: "주문 접수"/);
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

describe("⑤-b admin 취소 경로도 발주 예약을 해제한다 — 두 번째 CANCELLED 진입점", () => {
  /* 승계 대조(budget-lifecycle-wiring W4)가 드러낸 간극: admin status route 는
   * 경로 A(releasePOVoided)만 알고 order_released(⑪)를 모른다 — 관리자 취소 시
   * 발주 예약이 고아로 남는다. 두 CANCELLED 진입점(owner PATCH·admin status)이
   * 같은 해제 계약을 이행해야 한다. */
  it("admin/orders/[id]/status CANCELLED 분기에 ORDER_RELEASED 배선", () => {
    expect(read("src/app/api/admin/orders/[id]/status/route.ts")).toMatch(/ORDER_RELEASED/);
  });
});

describe("⑤ 취소 CTA — release 의 UI 진입점", () => {
  it("/my/orders 에 주문 취소 진입이 있다 (ORDERED 한정 · CANCELLED PATCH)", () => {
    const src = read(MY_ORDERS);
    expect(src).toMatch(/주문 취소/);
    expect(src).toMatch(/CANCELLED/);
  });
});
