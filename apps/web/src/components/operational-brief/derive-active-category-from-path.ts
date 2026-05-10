/**
 * #operational-brief-context-aware-category — Phase 2 GREEN
 *
 * pathname → InboxSourceModule 자동 매핑. popup open 시 호출되어
 * 현재 surface 기준 카테고리 선택 모달 skip 후 작업 큐 바로 진입.
 *
 * canonical truth lock:
 *   - 4 InboxSourceModule canonical (popup.tsx CATEGORIES) 와 1:1.
 *   - prefix 매칭 (sub-route 호환): /dashboard/quotes/123 도 'quote'.
 *   - query string 무시.
 *   - dashboard 메인 / settings / analytics → null (기존 category grid fallback).
 *   - graceful null fallback (undefined / null / empty).
 *
 * 매핑 정합 (호영님 ontology):
 *   - /dashboard/quotes      → quote
 *   - /dashboard/purchases   → quote (§11.209 — 구매 운영 = 견적 비교 surface)
 *   - /dashboard/purchase-orders → po
 *   - /dashboard/receiving   → receiving
 *   - /dashboard/inventory   → stock_risk
 *
 * Out of scope:
 *   - /dashboard 메인 / analytics / settings / 운영 지원 / 활동 로그 — 의도적
 *     매핑 X (해당 surface 는 cross-category overview 라 grid 가 자연스러움).
 */

import type { InboxSourceModule } from "@/lib/ops-console/inbox-adapter";

/**
 * pathname 의 query string 이전 부분만 비교 (sub-route prefix 매칭).
 * undefined / null / empty 는 graceful null fallback.
 */
export function deriveActiveCategoryFromPath(
  pathname: string | null | undefined,
): InboxSourceModule | null {
  if (!pathname) return null;

  // query string + hash 제거.
  const path = pathname.split("?")[0].split("#")[0];

  // 1:1 prefix 매칭 (순서 = 우선순위).
  if (path === "/dashboard/quotes" || path.startsWith("/dashboard/quotes/")) {
    return "quote";
  }
  if (path === "/dashboard/purchases" || path.startsWith("/dashboard/purchases/")) {
    // §11.209 — 구매 운영 surface 도 견적 비교 카테고리.
    return "quote";
  }
  if (
    path === "/dashboard/purchase-orders" ||
    path.startsWith("/dashboard/purchase-orders/")
  ) {
    return "po";
  }
  if (path === "/dashboard/receiving" || path.startsWith("/dashboard/receiving/")) {
    return "receiving";
  }
  if (path === "/dashboard/inventory" || path.startsWith("/dashboard/inventory/")) {
    return "stock_risk";
  }

  return null;
}
