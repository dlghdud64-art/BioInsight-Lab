/**
 * §11.209d-notification-inapp-web-bell-ui Phase 1 — RED test
 *
 * lib/notifications/event-category-map.ts 가 4 helper export:
 *   - eventTypeToCategory(eventType) → NotificationCategory (7 enum)
 *   - buildNotificationText(item) → string (한국어 라벨)
 *   - buildNotificationHref(item) → string (entity → URL)
 *   - formatNotificationTime(createdAt) → string ("10분 전" / "어제")
 *
 * canonical truth: NotificationEvent.eventType (15 type) → 7 카테고리 매핑.
 * Header.tsx 의 CATEGORY_CONFIG 7 카테고리와 정합 (drift 차단).
 */

import { describe, it, expect } from "vitest";
import {
  eventTypeToCategory,
  buildNotificationText,
  buildNotificationHref,
  formatNotificationTime,
} from "@/lib/notifications/event-category-map";

describe("§11.209d-notification-inapp-web-bell-ui — eventTypeToCategory", () => {
  it("결재 lifecycle 3 type → approval_pending", () => {
    expect(eventTypeToCategory("PURCHASE_APPROVAL_REQUESTED")).toBe("approval_pending");
    expect(eventTypeToCategory("PURCHASE_APPROVED")).toBe("approval_pending");
    expect(eventTypeToCategory("PURCHASE_REJECTED")).toBe("approval_pending");
    expect(eventTypeToCategory("APPROVAL_NEEDED")).toBe("approval_pending");
  });

  it("재고 type → stock_alert / expiry_warning / delivery_complete", () => {
    expect(eventTypeToCategory("INVENTORY_LOW")).toBe("stock_alert");
    expect(eventTypeToCategory("INVENTORY_EXPIRING")).toBe("expiry_warning");
    expect(eventTypeToCategory("INVENTORY_RECEIVED")).toBe("delivery_complete");
  });

  it("견적 type → quote_arrived", () => {
    expect(eventTypeToCategory("QUOTE_RECEIVED")).toBe("quote_arrived");
    expect(eventTypeToCategory("QUOTE_REQUESTED")).toBe("quote_arrived");
    expect(eventTypeToCategory("VENDOR_REPLIED")).toBe("quote_arrived");
    expect(eventTypeToCategory("FAST_TRACK_ELIGIBLE")).toBe("quote_arrived");
  });

  it("주문 type → delivery_complete (DELIVERED) / system (PLACED/SHIPPED)", () => {
    expect(eventTypeToCategory("ORDER_DELIVERED")).toBe("delivery_complete");
    expect(eventTypeToCategory("ORDER_PLACED")).toBe("system");
    expect(eventTypeToCategory("ORDER_SHIPPED")).toBe("system");
  });

  it("escalation / budget → safety_alert / system", () => {
    expect(eventTypeToCategory("ESCALATION_TRIGGERED")).toBe("safety_alert");
    expect(eventTypeToCategory("BUDGET_WARNING")).toBe("system");
  });

  it("unknown eventType → system fallback", () => {
    expect(eventTypeToCategory("UNKNOWN_EVENT_XYZ")).toBe("system");
  });
});

describe("§11.209d-notification-inapp-web-bell-ui — buildNotificationText", () => {
  const baseItem = {
    id: "n1",
    actionType: "IN_APP",
    status: "SENT",
    payload: null,
    entityType: "PURCHASE_REQUEST",
    entityId: "pr1",
    recipientId: "u1",
    recipientEmail: null,
    createdAt: new Date(),
    readAt: null,
    sentAt: null,
    event: {
      id: "e1",
      eventType: "PURCHASE_APPROVAL_REQUESTED",
      triggeredBy: "u2",
      metadata: { quoteTitle: "PCR 시약 견적", totalAmount: 500000 },
      createdAt: new Date(),
    },
  };

  it("PURCHASE_APPROVAL_REQUESTED — 결재 요청 + quoteTitle 포함", () => {
    const text = buildNotificationText(baseItem);
    expect(text).toContain("결재 요청");
    expect(text).toContain("PCR 시약 견적");
  });

  it("PURCHASE_APPROVED — 결재 승인 + quoteTitle 포함", () => {
    const item = { ...baseItem, event: { ...baseItem.event, eventType: "PURCHASE_APPROVED" } };
    const text = buildNotificationText(item);
    expect(text).toContain("결재 승인");
    expect(text).toContain("PCR 시약 견적");
  });

  it("PURCHASE_REJECTED — 반려 + rejectionReason 포함", () => {
    const item = {
      ...baseItem,
      event: {
        ...baseItem.event,
        eventType: "PURCHASE_REJECTED",
        metadata: { quoteTitle: "PCR 시약 견적", rejectionReason: "예산 초과" },
      },
    };
    const text = buildNotificationText(item);
    expect(text).toContain("반려");
    expect(text).toContain("예산 초과");
  });

  it("metadata 없는 케이스 — fallback 한국어", () => {
    const item = {
      ...baseItem,
      event: { ...baseItem.event, eventType: "INVENTORY_LOW", metadata: null },
    };
    const text = buildNotificationText(item);
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toMatch(/undefined|null/);
  });
});

describe("§11.209d-notification-inapp-web-bell-ui — buildNotificationHref", () => {
  const baseItem = {
    id: "n1",
    actionType: "IN_APP",
    status: "SENT",
    payload: null,
    entityType: "PURCHASE_REQUEST",
    entityId: "pr1",
    recipientId: "u1",
    recipientEmail: null,
    createdAt: new Date(),
    readAt: null,
    sentAt: null,
    event: {
      id: "e1",
      eventType: "PURCHASE_APPROVAL_REQUESTED",
      triggeredBy: "u2",
      metadata: { quoteId: "q42" },
      createdAt: new Date(),
    },
  };

  it("PURCHASE_REQUEST entityType + quoteId metadata → /dashboard/quotes?focus=", () => {
    const href = buildNotificationHref(baseItem);
    expect(href).toContain("/dashboard/quotes");
    expect(href).toContain("focus=q42");
  });

  it("PURCHASE_REQUEST entityType + quoteId 없음 → /dashboard/purchases fallback", () => {
    const item = { ...baseItem, event: { ...baseItem.event, metadata: null } };
    expect(buildNotificationHref(item)).toBe("/dashboard/purchases");
  });

  it("QUOTE entityType → /dashboard/quotes?focus=entityId", () => {
    const item = { ...baseItem, entityType: "QUOTE", entityId: "q123" };
    const href = buildNotificationHref(item);
    expect(href).toContain("/dashboard/quotes");
    expect(href).toContain("focus=q123");
  });

  it("INVENTORY entityType → /dashboard/inventory", () => {
    const item = { ...baseItem, entityType: "INVENTORY" };
    expect(buildNotificationHref(item)).toBe("/dashboard/inventory");
  });

  it("ORDER entityType → /dashboard/purchases", () => {
    const item = { ...baseItem, entityType: "ORDER" };
    expect(buildNotificationHref(item)).toBe("/dashboard/purchases");
  });

  it("unknown entityType → /dashboard/notifications fallback", () => {
    const item = { ...baseItem, entityType: "UNKNOWN_DOMAIN" };
    expect(buildNotificationHref(item)).toBe("/dashboard/notifications");
  });
});

describe("§11.209d-notification-inapp-web-bell-ui — formatNotificationTime", () => {
  it("1분 미만 → '방금 전'", () => {
    expect(formatNotificationTime(new Date())).toBe("방금 전");
  });

  it("10분 전 → 'N분 전'", () => {
    const d = new Date(Date.now() - 10 * 60 * 1000);
    expect(formatNotificationTime(d)).toMatch(/\d+분 전/);
  });

  it("3시간 전 → 'N시간 전'", () => {
    const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
    expect(formatNotificationTime(d)).toMatch(/\d+시간 전/);
  });

  it("24-48시간 전 → '어제'", () => {
    const d = new Date(Date.now() - 30 * 60 * 60 * 1000);
    expect(formatNotificationTime(d)).toBe("어제");
  });

  it("3일 전 → 'N일 전'", () => {
    const d = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    expect(formatNotificationTime(d)).toMatch(/\d+일 전/);
  });
});
