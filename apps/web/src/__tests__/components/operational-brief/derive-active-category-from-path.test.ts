/**
 * #operational-brief-context-aware-category — Phase 1 RED
 *
 * Goal: 호영님 마찰 — 견적 관리 페이지에서 운영 브리핑 → 카테고리 선택 모달
 *       (또 "뭘 보고 싶어?") 한 단계 불필요. pathname 인식 → 자동 InboxSourceModule
 *       매핑 → 매핑 성공 시 viewMode="list" + selectedCategory 자동 진입.
 *       매핑 실패 (dashboard 메인 / settings 등) 시 기존 category grid fallback.
 *
 * canonical truth lock:
 *   - helper: `deriveActiveCategoryFromPath(pathname)` → InboxSourceModule | null.
 *   - 매핑 1:1 — /dashboard/quotes → quote, /dashboard/purchase-orders → po,
 *     /dashboard/receiving → receiving, /dashboard/inventory → stock_risk.
 *   - sub-route (예: /dashboard/quotes/123) 도 prefix 매칭.
 *   - 다른 path (/dashboard, /dashboard/analytics, /dashboard/settings) → null.
 *   - popup.tsx wiring: useEffect open + pathname → 자동 setSelectedCategory.
 */

import { describe, it, expect } from "vitest";
import {
  deriveActiveCategoryFromPath,
} from "../../../components/operational-brief/derive-active-category-from-path";

describe("#operational-brief-context-aware-category — pathname mapping", () => {
  it("/dashboard/quotes → 'quote'", () => {
    expect(deriveActiveCategoryFromPath("/dashboard/quotes")).toBe("quote");
  });

  it("/dashboard/quotes/123 (sub-route) → 'quote'", () => {
    expect(deriveActiveCategoryFromPath("/dashboard/quotes/abc123")).toBe("quote");
  });

  it("/dashboard/quotes?selected=foo (query string 무시) → 'quote'", () => {
    expect(deriveActiveCategoryFromPath("/dashboard/quotes?selected=foo")).toBe("quote");
  });

  it("/dashboard/purchase-orders → 'po'", () => {
    expect(deriveActiveCategoryFromPath("/dashboard/purchase-orders")).toBe("po");
  });

  it("/dashboard/purchase-orders/PO-2026-0001 → 'po'", () => {
    expect(deriveActiveCategoryFromPath("/dashboard/purchase-orders/PO-2026-0001")).toBe("po");
  });

  it("/dashboard/receiving → 'receiving'", () => {
    expect(deriveActiveCategoryFromPath("/dashboard/receiving")).toBe("receiving");
  });

  it("/dashboard/inventory → 'stock_risk'", () => {
    expect(deriveActiveCategoryFromPath("/dashboard/inventory")).toBe("stock_risk");
  });

  it("/dashboard/inventory/scan → 'stock_risk'", () => {
    expect(deriveActiveCategoryFromPath("/dashboard/inventory/scan")).toBe("stock_risk");
  });

  it("/dashboard/purchases → 'quote' (구매 운영 = 견적 비교 surface)", () => {
    // §11.209 정합 — 구매 운영 surface 가 견적 비교 카테고리로 매핑.
    expect(deriveActiveCategoryFromPath("/dashboard/purchases")).toBe("quote");
  });
});

describe("#operational-brief-context-aware-category — fallback (null)", () => {
  it("/dashboard (메인) → null", () => {
    expect(deriveActiveCategoryFromPath("/dashboard")).toBeNull();
  });

  it("/dashboard/analytics → null", () => {
    expect(deriveActiveCategoryFromPath("/dashboard/analytics")).toBeNull();
  });

  it("/dashboard/settings → null", () => {
    expect(deriveActiveCategoryFromPath("/dashboard/settings")).toBeNull();
  });

  it("/dashboard/settings/suppliers → null", () => {
    expect(deriveActiveCategoryFromPath("/dashboard/settings/suppliers")).toBeNull();
  });

  it("non-dashboard path (예: /pricing) → null", () => {
    expect(deriveActiveCategoryFromPath("/pricing")).toBeNull();
  });

  it("undefined / null / empty → null (graceful)", () => {
    expect(deriveActiveCategoryFromPath(undefined)).toBeNull();
    expect(deriveActiveCategoryFromPath(null)).toBeNull();
    expect(deriveActiveCategoryFromPath("")).toBeNull();
  });
});
