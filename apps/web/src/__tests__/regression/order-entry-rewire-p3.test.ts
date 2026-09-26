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

/* 🛑 은퇴 §order-entry-removed (2026-09-25 · 호영님 판정) — ①②(발주 경로 직결 · 주문 접수 다이얼로그).
 *    이 두 describe 는 **주문 접수 경로가 있다**는 전제 위에 서 있었다.
 *    그 경로를 지웠다 — 성공 토스트가 「주문 내역에서 확인하세요」 였는데 그 화면이 없다.
 *    명제 원문: ① 발주 경로는 브리핑 rail 을 경유하지 않고 행 CTA 가 작업창으로 직행한다 ·
 *      po_conversion 중 브리핑 미노출(2곳) · ② 견적 관리 안에 예산 선택 축이 있다.
 *    🔑 살아 남은 명제는 **브리핑이 작업창을 가리지 않는다** 로, 그 가드(2곳)는
 *       안정적이므로 아래 ③ 에 남겨 둔다. 나머지는 §order-entry-removed 가 역계약으로 든다. */

describe("③ 브리핑은 작업창을 가리지 않는다 (유지)", () => {
  /* 승계 §quote-brief-rail-removed (2026-09-26 · 호영님 판정) — 원 단언은 레일·모바일 시트 2곳의 가드를 셌다.
     두 표면이 삭제돼 가드도 사라졌다. 명제(브리핑이 작업창을 가리지 않는다)는 「브리핑 표면 자체가 없다」 로 더 강하게 성립한다 —
     정본 단언은 regression/quote-brief-rail-removed.test.ts ②. 여기서는 그 표면이 없다는 사실만 교차 확인한다. */
  it("po_conversion 중에는 브리핑 rail·모바일 sheet 가 뜨지 않는다 (표면 0)", () => {
    const code = stripComments(read(QUOTES_WB));
    expect(code).not.toMatch(/MobileOperationalBriefSheet/);
    expect(code).not.toMatch(/min-\[1200px\]:fixed/);
    expect(code).not.toMatch(/activeWorkWindow !== "request_send" && activeWorkWindow !== "po_conversion" && selectedQuote/);
  });
});

/* ⚠️ ③④ 는 P3-4(이월) 대상 — 현재 RED 가 정상이다.
 * 기능 대조(계획서 §10-a) 실측: /quotes/[id] 에만 있는 기능 6건(회신 입력·벤더 확정·
 * 메모·구매 요청·상태 전이·공유 링크)이 레일에 없다. 6건 이식이 선행 조건이라
 * 호영님 판정(2026-08-22)으로 별도 슬라이스 이월. 이 단언들은 그때 GREEN 이 된다 —
 * 지우지 말 것: 지우면 "리다이렉트로 갈아끼운다"는 결정 자체가 무잠금이 된다. */
describe.skip("③ /quotes/[id] — §11.39 리다이렉트 흡수 (P3-4 이월 · 착수 시 skip 해제)", () => {
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

describe.skip("④ 경로 C 은퇴 — draft 재유입 0 (P3-4 이월 · 착수 시 skip 해제)", () => {
  it("purchase-orders/new 가 /api/orders/draft 를 부르지 않는다", () => {
    expect(stripComments(read(PO_NEW))).not.toMatch(/orders\/draft/);
  });
});

describe("⑤-b admin 취소 경로도 발주 예약을 해제한다 — 두 번째 CANCELLED 진입점", () => {
  /* 승계 대조(budget-lifecycle-wiring W4)가 드러낸 간극: admin status route 는
   * 경로 A(releasePOVoided)만 알고 order_released(⑪)를 모른다 — 관리자 취소 시
   * 발주 예약이 고아로 남는다. 두 CANCELLED 진입점(owner PATCH·admin status)이
   * 같은 해제 계약을 이행해야 한다. */
  it("두 CANCELLED 진입점이 같은 해제 서비스를 부른다 (복붙 금지 · 한쪽만 고쳐지는 형태 차단)", () => {
    /* 재조준(P3-3): 옛 축은 admin route 안의 ORDER_RELEASED 문자열을 요구했다.
     * 구현은 서비스 단일점(releaseOrderReservation)으로 갔고, 그게 더 강한 계약이다 —
     * 문자열 대조는 복붙된 두 벌도 통과시키지만 이 단언은 그러지 못한다. */
    const admin = stripComments(read("src/app/api/admin/orders/[id]/status/route.ts"));
    const owner = stripComments(read("src/app/api/orders/[id]/route.ts"));
    expect(admin).toMatch(/releaseOrderReservation\(tx, \{ orderId/);
    expect(owner).toMatch(/releaseOrderReservation\(tx, \{ orderId/);
  });

  it("🛑 admin 해제는 purchaseRequest 조건 밖이다 — 견적→주문 예약엔 구매요청이 없다", () => {
    /* 이 간극이 정확히 결함이었다: releasePOVoided(경로 A)는 purchaseRequest 필수라
     * 같은 if 에 넣으면 ⑪ 예약이 고아로 남는다. */
    const admin = stripComments(read("src/app/api/admin/orders/[id]/status/route.ts"));
    const m = admin.match(/if \(newStatus === "CANCELLED"\) \{([\s\S]{0,200}?)releaseOrderReservation/);
    expect(m).not.toBeNull();
    /* 🛑 검출력 보강 (로컬 세션 프로브 2026-08-22): 위 단언만으로는 앵커와 호출 사이에
     * purchaseRequest 가드를 **중첩**하는 형태를 못 잡는다 — 앵커는 그대로 남고 호출도
     * 200자 안에 있어서 GREEN 이 뜬다. 그런데 그 중첩이 정확히 원 결함의 형태다.
     * 앵커↔호출 사이 구간에 조건이 끼어들지 않았음을 직접 단언한다. */
    expect(m![1]).not.toMatch(/purchaseRequest/);
    expect(m![1]).not.toMatch(/\bif\s*\(/);
  });
});

describe("⑤ 취소 CTA — release 의 UI 진입점", () => {
  it("/my/orders 에 주문 취소 진입이 있다 (ORDERED 한정 · CANCELLED PATCH)", () => {
    const src = read(MY_ORDERS);
    expect(src).toMatch(/주문 취소/);
    expect(src).toMatch(/status: "CANCELLED"/);
    /* 누르면 실패할 것을 눌리게 두지 않는다 — ORDERED 한정 (dead button 금지) */
    expect(src).toMatch(/order\.status === "ORDERED"/);
    /* 되돌릴 수 없는 전이라 확인을 거친다 · csrfFetch 경유 */
    expect(src).toMatch(/ConfirmDialog/);
    expect(src).toMatch(/csrfFetch\(/);
  });
});
