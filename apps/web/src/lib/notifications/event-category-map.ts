/**
 * §11.209d-notification-inapp-web-bell-ui — eventType → UI 카테고리 매핑.
 *
 * canonical truth: NotificationEvent.eventType (15 type — 12 기본 + 3
 * 결재 lifecycle) → 7 UI 카테고리. Header.tsx 의 CATEGORY_CONFIG (이미
 * land — stock_alert / quote_arrived / delivery_complete / approval_pending
 * / expiry_warning / safety_alert / system) 와 정합.
 *
 * dead button 0 — fallback "system" 으로 모든 알림 visible 보장.
 *
 * 후속 Batch C (mobile 알림) 가 동일 helper 재사용.
 */

import type { NotificationItem } from "./notification-query";

// ── 7 카테고리 (Header.tsx CATEGORY_CONFIG 와 정합) ──

export type NotificationCategory =
  | "stock_alert"
  | "quote_arrived"
  | "delivery_complete"
  | "approval_pending"
  | "expiry_warning"
  | "safety_alert"
  | "system";

// ── eventType → category ──

/**
 * NotificationEvent.eventType 을 UI 카테고리로 매핑.
 * 알 수 없는 eventType 은 "system" fallback (dead notification 0).
 */
export function eventTypeToCategory(eventType: string): NotificationCategory {
  switch (eventType) {
    // 결재 lifecycle (3 신규 + APPROVAL_NEEDED generic)
    case "PURCHASE_APPROVAL_REQUESTED":
    case "PURCHASE_APPROVED":
    case "PURCHASE_REJECTED":
    case "APPROVAL_NEEDED":
      return "approval_pending";

    // 재고
    case "INVENTORY_LOW":
      return "stock_alert";
    case "INVENTORY_EXPIRING":
      return "expiry_warning";
    case "INVENTORY_RECEIVED":
      return "delivery_complete";

    // 견적 (요청 / 수신 / 만료 / 공급사 응답 / Fast-Track)
    case "QUOTE_REQUESTED":
    case "QUOTE_RECEIVED":
    case "QUOTE_EXPIRED":
    case "VENDOR_REPLIED":
    case "FAST_TRACK_ELIGIBLE":
      return "quote_arrived";

    // 주문 — 배송 완료만 delivery_complete, 나머지는 system (place/ship 은 진행 중)
    case "ORDER_DELIVERED":
      return "delivery_complete";
    case "ORDER_PLACED":
    case "ORDER_SHIPPED":
      return "system";

    // 비교·에스컬레이션·예산
    case "COMPARE_COMPLETED":
      return "system";
    case "ESCALATION_TRIGGERED":
      return "safety_alert";
    case "BUDGET_WARNING":
      return "system";

    // 알 수 없는 → fallback (dead notification 0 보장)
    default:
      return "system";
  }
}

// ── notification text 빌더 ──

/**
 * NotificationItem 으로부터 사용자에게 보일 한국어 텍스트 생성.
 * metadata 에서 quoteTitle / rejectionReason / itemName 등 추출.
 */
export function buildNotificationText(item: NotificationItem): string {
  const meta = (item.event.metadata ?? {}) as Record<string, unknown>;
  const eventType = item.event.eventType;

  // 결재 lifecycle — quoteTitle + 결과 명시
  if (eventType === "PURCHASE_APPROVAL_REQUESTED") {
    const title = (meta.quoteTitle as string | undefined) ?? "견적";
    return `결재 요청 도착 — ${title}`;
  }
  if (eventType === "PURCHASE_APPROVED") {
    const title = (meta.quoteTitle as string | undefined) ?? "견적";
    return `결재 승인 완료 — ${title}`;
  }
  if (eventType === "PURCHASE_REJECTED") {
    const reason = (meta.rejectionReason as string | undefined) ?? "사유 미명시";
    return `결재 반려 — ${reason}`;
  }

  // 견적
  if (eventType === "QUOTE_RECEIVED") {
    const vendor = (meta.vendorName as string | undefined) ?? "공급사";
    return `견적서 수신 — ${vendor}`;
  }
  if (eventType === "QUOTE_REQUESTED") return "견적 요청 접수";
  if (eventType === "QUOTE_EXPIRED") return "견적 만료";
  if (eventType === "VENDOR_REPLIED") return "공급사 응답 도착";
  if (eventType === "FAST_TRACK_ELIGIBLE") return "즉시 승인 가능 권장";

  // 재고
  if (eventType === "INVENTORY_LOW") {
    const name = (meta.itemName as string | undefined) ?? "재고";
    return `재고 부족 — ${name}`;
  }
  if (eventType === "INVENTORY_EXPIRING") {
    const name = (meta.itemName as string | undefined) ?? "재고";
    return `유효기한 임박 — ${name}`;
  }
  if (eventType === "INVENTORY_RECEIVED") {
    const name = (meta.itemName as string | undefined) ?? "재고";
    return `입고 완료 — ${name}`;
  }

  // 주문
  if (eventType === "ORDER_PLACED") return "주문 생성";
  if (eventType === "ORDER_SHIPPED") return "주문 배송 시작";
  if (eventType === "ORDER_DELIVERED") return "주문 배송 완료";

  // 비교·에스컬레이션·예산·일반 승인
  if (eventType === "COMPARE_COMPLETED") return "비교 분석 완료";
  if (eventType === "APPROVAL_NEEDED") return "승인 요청 도착";
  if (eventType === "ESCALATION_TRIGGERED") return "에스컬레이션 발생";
  if (eventType === "BUDGET_WARNING") {
    const cat = (meta.categoryDisplayName as string | undefined) ?? "예산";
    return `예산 경고 — ${cat}`;
  }

  // payload.label fallback (action-executor 가 채운 경우)
  const payload = (item.payload ?? {}) as Record<string, unknown>;
  const label = payload.label as string | undefined;
  if (label && label.length > 0) return label;

  // 최종 fallback — eventType 한글 라벨 가공
  return `알림 — ${eventType}`;
}

// ── notification href 빌더 ──

/**
 * NotificationItem.entityType + metadata 로부터 click destination URL 생성.
 * dead button 0 — entityType 모르면 /dashboard/notifications fallback.
 */
export function buildNotificationHref(item: NotificationItem): string {
  const meta = (item.event.metadata ?? {}) as Record<string, unknown>;

  switch (item.entityType) {
    case "PURCHASE_REQUEST": {
      const quoteId = meta.quoteId as string | undefined;
      if (quoteId) {
        return `/dashboard/quotes?focus=${encodeURIComponent(quoteId)}`;
      }
      return "/dashboard/purchases";
    }
    case "QUOTE":
      return `/dashboard/quotes?focus=${encodeURIComponent(item.entityId)}`;
    case "INVENTORY":
      return "/dashboard/inventory";
    case "ORDER":
      return "/dashboard/purchases";
    case "COMPARE":
      return `/dashboard/analytics`;
    case "APPROVAL":
      return "/dashboard/purchases";
    case "ESCALATION":
      return "/dashboard/notifications";
    case "BUDGET":
      return "/dashboard/budget";
    default:
      return "/dashboard/notifications";
  }
}

// ── 시간 포맷터 ──

/**
 * createdAt 으로부터 사용자 친화 한국어 상대 시간 표시.
 * "방금 전" / "N분 전" / "N시간 전" / "어제" / "N일 전".
 */
export function formatNotificationTime(createdAt: Date | string): string {
  const ts = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  const diffMs = Date.now() - ts.getTime();

  if (diffMs < 60_000) return "방금 전";
  if (diffMs < 3_600_000) {
    const min = Math.floor(diffMs / 60_000);
    return `${min}분 전`;
  }
  if (diffMs < 86_400_000) {
    const hr = Math.floor(diffMs / 3_600_000);
    return `${hr}시간 전`;
  }
  if (diffMs < 86_400_000 * 2) return "어제";
  const days = Math.floor(diffMs / 86_400_000);
  return `${days}일 전`;
}
