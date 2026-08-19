/**
 * §order-amount-from-reply — 발주 금액이 공급사 회신 단가를 소비하는지 sentinel
 * (2026-08-18 프로덕션 실측 회귀)
 *
 * 실측: 회신 단가 850,000 이 도착했는데 주문 접수는 400(INVALID_AMOUNT).
 *       주문 다이얼로그도 "주문 금액 -₩0". 단가가 QuoteVendorResponseItem 에만 있고
 *       QuoteListItem.unitPrice/lineTotal 은 0 이라 서버 합산이 항상 0 이었다.
 *
 * 정정 기록: 이 자리는 "회신 선택 정의가 없다"가 아니었다. 선택 축은 이미 있고
 *       (구매 처리 경로가 vendorRequestId 로 소비 중) 주문 경로에만 배선이 없었다.
 *       그래서 새 정의를 만들지 않고 같은 축을 이었다.
 *
 * 잠그는 것: 서버가 회신을 조회해 금액에 반영 · quoteId 소속 재검증 · 0원 창작 금지
 *            · 헤더 총액과 라인 단가가 같은 출처 · 클라이언트가 선택 축을 전달.
 * 잠그지 못하는 것: 실 DB 금액 · 예산 모델(UserBudget vs Budget) 문제(별도 카드) · 실브라우저.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const API = "app/api/orders/route.ts";
const PAGE = "app/quotes/[id]/page.tsx";
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const read = (rel: string) => strip(readFileSync(join(ROOT, rel), "utf8"));

describe("§order-amount-from-reply — 서버", () => {
  const s = read(API);

  it("주문 body 에서 vendorRequestId 를 받는다", () => {
    expect(s).toMatch(/const \{[^}]*vendorRequestId[^}]*\} = body;/);
  });

  it("🛑 회신 조회에 quoteId 소속 검증이 있다 — 타 견적 가격 주입 차단", () => {
    expect(s).toMatch(/quoteVendorResponseItem\.findMany\(\{[\s\S]{0,200}?vendorRequest: \{ quoteId: quote\.id \}/);
  });

  it("🛑 0원 창작 금지 — 단가 0 은 맵에 넣지 않고, 합계 0 이면 종전 경로", () => {
    expect(s).toMatch(/if \(unit > 0\) replyPriceByItemId\.set/);
    expect(s).toMatch(/const totalAmount = replyTotal > 0/);
    expect(s).toMatch(/if \(totalAmount <= 0\) \{[\s\S]{0,80}?INVALID_AMOUNT/);
  });

  it("헤더 총액과 라인 단가가 같은 출처 — 발주서 자기모순 금지", () => {
    expect(s).toMatch(/unitPrice: replyPriceByItemId\.get\(item\.id\)/);
    expect(s).toMatch(/lineTotal: replyPriceByItemId\.has\(item\.id\)/);
  });
});

describe("§order-amount-from-reply — 클라이언트", () => {
  const s = read(PAGE);

  it("주문 생성이 선택 축(effectiveVrId)을 전달한다", () => {
    expect(s).toMatch(/vendorRequestId: effectiveVrId \|\| undefined/);
  });

  it("🛑 주문 다이얼로그 금액이 quoteTotal 이 아니라 purchaseTotal 이다", () => {
    expect(s).toMatch(/주문 금액[\s\S]{0,160}?purchaseTotal\.toLocaleString/);
    expect(s).toMatch(/const expectedRemaining = selectedBudget \? \(selectedBudget\.remainingAmount \?\? 0\) - purchaseTotal/);
  });
});
