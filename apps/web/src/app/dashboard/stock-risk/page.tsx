/**
 * §stock-risk-consolidation P4 (호영님 2026-07-03) — stock-risk 페이지 폐기·재고 관리 통합.
 *
 * 결정: /dashboard/stock-risk = 재고 관리(안전재고 미달/재주문 후보)의 중복 표면 →
 *   page-per-feature 회귀 제거. 고유요소(차단 사유=RFQ 진행·예산 초과)는 P2에서 재고 카드로
 *   흡수 완료(canonical /reorder-recommendations blocked/blockReasons). 재고 부족 판정은
 *   P3에서 canonical isReorderNeeded 단일화. 생애주기 서술은 재고 필터 칩이 대신(생략).
 *
 * 잔여 ops-console 어댑터 handoff route(nextRoute/returnRoute/targetRoute/entityRoute 등)를
 *   서버 redirect로 커버 → 전 진입 경로 dead-link 0. UI 링크는 P1에서 inventory 필터로 재배선.
 */
import { redirect } from "next/navigation";

export default function StockRiskConsolidatedRedirect() {
  // 재고 관리 '부족'(안전재고 미달·재주문 후보) 필터로 진입. same-canvas, 신규 페이지 이탈 0.
  redirect("/dashboard/inventory?filter=low");
}
