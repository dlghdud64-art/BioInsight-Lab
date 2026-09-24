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
 *
 * 🛑 문제: 알림 센터에 「주문 생성」 이 2건인데 제목이 **글자까지 똑같아** 어느 주문인지 구분되지 않았다
 *    (라이브 실측: 「주문 생성 · 30일 전」 · 「주문 생성 · 32일 전」). 재고 알림이 `productName` 을
 *    안 읽어 전량 「… 재고」 로만 보이던 것(§notifications-route)과 **같은 형태**다.
 *
 * prod 실측 2026-09-24 (읽기 전용 SELECT · ref xhid…dhsw · userCount 3 / orgCount 2 대조):
 *   NotificationEvent.metadata = { quoteId, orderNumber, totalAmount }   (2건 전부)
 *   NotificationAction.payload = { label, quoteId, eventType, actionType, orderNumber, totalAmount }
 *   🔑 두 건에서 **갈리는 필드는 `orderNumber` 하나**다 — ORD-20260824-SKSQ · ORD-20260822-C3PN.
 *      `quoteId` 는 두 건이 **같은 값**이라 식별자가 되지 못한다. 대표 품목 필드는 payload 에 없다.
 *
 * metadata 를 먼저 보고 없으면 payload 를 본다 — 두 자리 모두에 있는 것을 실측했고,
 * 어느 한쪽만 채우는 생산자가 나중에 생겨도 제목이 비지 않게 한다.
 */
function orderNumberOf(item: NotificationItem): string | null {
  const meta = (item.event.metadata ?? {}) as Record<string, unknown>;
  const payload = (item.payload ?? {}) as Record<string, unknown>;
  const v = meta.orderNumber ?? payload.orderNumber;
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

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

  // 견적
  if (eventType === "QUOTE_RECEIVED") {
    const vendor = (meta.vendorName as string | undefined) ?? "공급사";
    return `견적서 수신 · ${vendor}`;
  }
  if (eventType === "QUOTE_REQUESTED") return "견적 요청 접수";
  if (eventType === "QUOTE_EXPIRED") return "견적 만료";
  if (eventType === "VENDOR_REPLIED") return "공급사 응답 도착";
  if (eventType === "FAST_TRACK_ELIGIBLE") return "즉시 승인 가능 권장";

  // 재고
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

  // 주문 — §order-notif-identifier: 식별자(주문번호)를 제목에 넣는다. 형제 슬롯 3개 전부.
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

  // 비교·에스컬레이션·예산·일반 승인
  if (eventType === "COMPARE_COMPLETED") return "비교 분석 완료";
  if (eventType === "APPROVAL_NEEDED") return "승인 요청 도착";
  if (eventType === "ESCALATION_TRIGGERED") return "에스컬레이션 발생";
  if (eventType === "BUDGET_WARNING") {
    const cat = (meta.categoryDisplayName as string | undefined) ?? "예산";
    return `예산 경고 · ${cat}`;
  }

  // payload.label fallback (action-executor 가 채운 경우)
  const payload = (item.payload ?? {}) as Record<string, unknown>;
  const label = payload.label as string | undefined;
  if (label && label.length > 0) return label;

  // 최종 fallback — eventType 한글 라벨 가공
  return "새 알림";
}

// ── notification href 빌더 ──

/**
 * NotificationItem.entityType + metadata 로부터 click destination URL 생성.
 * dead button 0 — entityType 모르면 /dashboard/notifications fallback.
 */
export function buildNotificationHref(item: NotificationItem): string {
  const meta = (item.event.metadata ?? {}) as Record<string, unknown>;

  switch (item.entityType) {
    /* §purchases-ui-removed (2026-09-24 · 호영님 판정) — 목적지였던 구매 운영 화면이 삭제됐다. 세 자리(결재 요청 fallback · 주문 · 승인)를 옮긴다.
     * 🛑 같은 자리에서 **죽은 파라미터**도 함께 고친다: 견적 화면이 읽는 것은 `selected` 와 `prepare` 이고
     *    `focus` 를 읽는 곳은 **소스 전체에 0곳**이다(실측). 지금까지 이 링크들은 상세를 열지 못하고
     *    목록에만 떨어뜨렸다 — 형제 슬롯이라 함께 고친다(CLAUDE.md §형제 슬롯 전수). */
    case "PURCHASE_REQUEST": {
      const quoteId = meta.quoteId as string | undefined;
      if (quoteId) {
        return `/dashboard/quotes?selected=${encodeURIComponent(quoteId)}`;
      }
      return "/dashboard/quotes";
    }
    case "QUOTE":
      return `/dashboard/quotes?selected=${encodeURIComponent(item.entityId)}`;
    case "INVENTORY":
      return "/dashboard/inventory";
    case "ORDER": {
      /* 주문을 볼 화면이 없으므로 **주문의 출발점**인 견적 상세로 보낸다(호영님).
       * prod 실측: ORDER 알림 metadata 에 quoteId 가 있다(2건 전부). */
      const quoteId = meta.quoteId as string | undefined;
      if (quoteId) {
        return `/dashboard/quotes?selected=${encodeURIComponent(quoteId)}`;
      }
      return "/dashboard/quotes";
    }
    case "COMPARE":
      return `/dashboard/analytics`;
    case "APPROVAL":
      return "/dashboard/quotes";
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
