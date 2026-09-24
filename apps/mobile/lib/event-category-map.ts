/**
 * 재고 알림의 품목명 — 생산자(inventory/[id]/use · smart-receiving · restock-detector)는 전부
 * `productName` 에 쓴다. `itemName` 을 쓰는 생산자는 0 이다(§notifications-route 2026-09-22 실측 ·
 * 그 전에는 prod 재고 알림 전량이 「… 재고」 로만 보였다).
 */
function productNameOf(meta: Record<string, unknown>): string | null {
  const v = meta.productName ?? meta.itemName;
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

/**
 * §order-notif-identifier (2026-09-24 · 호영님 P1) — 주문 알림의 식별자.
 * 웹 canonical 과 **같은 형태**로 유지한다(이 파일 헤더의 drift 차단 lock).
 *
 * prod 실측 2026-09-24(읽기 전용): metadata·payload 양쪽에 `orderNumber` 가 있고,
 * 2건에서 **갈리는 필드는 그것 하나**다(`quoteId` 는 두 건이 같은 값이라 식별자가 못 된다).
 * 대표 품목 필드는 payload 에 없다.
 */
function orderNumberOf(item: NotificationItem): string | null {
  const meta = (item.event.metadata ?? {}) as Record<string, unknown>;
  const payload = (item.payload ?? {}) as Record<string, unknown>;
  const v = meta.orderNumber ?? payload.orderNumber;
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

/**
 * §11.209d-notification-inapp-mobile-screen — eventType → UI 카테고리 매핑.
 *
 * canonical truth (§11.209d-notification-inapp-web-bell-ui):
 *   apps/web/src/lib/notifications/event-category-map.ts (동일 source)
 *
 * 본 file 은 그 web helper 의 mobile 복제 — monorepo packages 부재로
 * 별도 file 필요. drift 차단 lock — web 측 변경 시 mobile 도 동시 변경.
 *
 * 향후 monorepo packages/shared/notifications 추출 별도 batch.
 *
 * 7 카테고리는 web Header.tsx CATEGORY_CONFIG 와 정합 (drift 차단).
 * 알 수 없는 eventType 은 "system" fallback (dead notification 0).
 */

import type { NotificationItem } from "../types";

// ── 7 카테고리 (web 과 정합) ──

export type NotificationCategory =
  | "stock_alert"
  | "quote_arrived"
  | "delivery_complete"
  | "approval_pending"
  | "expiry_warning"
  | "safety_alert"
  | "system";

// ── eventType → category ──

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

    // 견적
    case "QUOTE_REQUESTED":
    case "QUOTE_RECEIVED":
    case "QUOTE_EXPIRED":
    case "VENDOR_REPLIED":
    case "FAST_TRACK_ELIGIBLE":
      return "quote_arrived";

    // 주문
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

    default:
      return "system";
  }
}

// ── notification text 빌더 ──

export function buildNotificationText(item: NotificationItem): string {
  const meta = (item.event.metadata ?? {}) as Record<string, unknown>;
  const eventType = item.event.eventType;

  if (eventType === "PURCHASE_APPROVAL_REQUESTED") {
    const title = (meta.quoteTitle as string | undefined) ?? "견적";
    return `결재 요청 도착 · ${title}`;
  }
  if (eventType === "PURCHASE_APPROVED") {
    const title = (meta.quoteTitle as string | undefined) ?? "견적";
    return `결재 승인 완료 · ${title}`;
  }
  if (eventType === "PURCHASE_REJECTED") {
    const reason = (meta.rejectionReason as string | undefined) ?? "사유 미명시";
    return `결재 반려 · ${reason}`;
  }

  if (eventType === "QUOTE_RECEIVED") {
    const vendor = (meta.vendorName as string | undefined) ?? "공급사";
    return `견적서 수신 · ${vendor}`;
  }
  if (eventType === "QUOTE_REQUESTED") return "견적 요청 접수";
  if (eventType === "QUOTE_EXPIRED") return "견적 만료";
  if (eventType === "VENDOR_REPLIED") return "공급사 응답 도착";
  if (eventType === "FAST_TRACK_ELIGIBLE") return "즉시 승인 가능 권장";

  if (eventType === "INVENTORY_LOW") {
    const name = productNameOf(meta);
    return name ? `재고 부족 · ${name}` : "재고 부족";
  }
  if (eventType === "INVENTORY_EXPIRING") {
    const name = productNameOf(meta);
    return name ? `유효기한 임박 · ${name}` : "유효기한 임박";
  }
  if (eventType === "INVENTORY_RECEIVED") {
    const name = productNameOf(meta);
    if (name) return `입고 완료 · ${name}`;
    const lines = typeof meta.lineCount === "number" ? meta.lineCount : null;
    return lines ? `입고 완료 · ${lines}개 품목` : "입고 완료";
  }

  // §order-notif-identifier — 식별자(주문번호)를 제목에 넣는다. 형제 슬롯 3개 전부.
  if (eventType === "ORDER_PLACED") {
    const no = orderNumberOf(item);
    return no ? `주문 생성 · ${no}` : "주문 생성";
  }
  if (eventType === "ORDER_SHIPPED") {
    const no = orderNumberOf(item);
    return no ? `주문 배송 시작 · ${no}` : "주문 배송 시작";
  }
  if (eventType === "ORDER_DELIVERED") {
    const no = orderNumberOf(item);
    return no ? `주문 배송 완료 · ${no}` : "주문 배송 완료";
  }

  if (eventType === "COMPARE_COMPLETED") return "비교 분석 완료";
  if (eventType === "APPROVAL_NEEDED") return "승인 요청 도착";
  if (eventType === "ESCALATION_TRIGGERED") return "에스컬레이션 발생";
  if (eventType === "BUDGET_WARNING") {
    const cat = (meta.categoryDisplayName as string | undefined) ?? "예산";
    return `예산 경고 · ${cat}`;
  }

  const payload = (item.payload ?? {}) as Record<string, unknown>;
  const label = payload.label as string | undefined;
  if (label && label.length > 0) return label;

  return "새 알림";
}

// ── notification href 빌더 (mobile router path) ──

/**
 * mobile 라우터 경로 — web 의 /dashboard/quotes 대신 /quotes/[id] 사용.
 * router.push(href) 로 navigation 시 expo-router 가 처리.
 */
export function buildNotificationHref(item: NotificationItem): string {
  const meta = (item.event.metadata ?? {}) as Record<string, unknown>;

  switch (item.entityType) {
    case "PURCHASE_REQUEST": {
      const quoteId = meta.quoteId as string | undefined;
      if (quoteId) {
        return `/quotes/${encodeURIComponent(quoteId)}`;
      }
      return "/(tabs)/purchases";
    }
    case "QUOTE":
      return `/quotes/${encodeURIComponent(item.entityId)}`;
    case "INVENTORY":
      return "/(tabs)/inventory";
    case "ORDER":
      return "/(tabs)/purchases";
    case "COMPARE":
      return "/(tabs)/index";
    case "APPROVAL":
      return "/(tabs)/purchases";
    case "ESCALATION":
      return "/notifications";
    case "BUDGET":
      return "/(tabs)/index";
    default:
      return "/notifications";
  }
}

// ── 시간 포맷터 (web 동일) ──

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
