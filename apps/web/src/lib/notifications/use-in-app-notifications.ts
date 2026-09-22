"use client";

/**
 * 인앱 알림 단일 출처 — 헤더 종 아이콘과 알림 센터 화면이 **같은 함수**로 읽는다.
 *
 * §notifications-single-source (2026-09-22 · 호영님 P0)
 *   알림 센터(/dashboard/notifications)는 코드에 박힌 가짜 알림 20건(재고 부족 FBS · 권한 승격 ·
 *   구독 결제 완료 등)을 띄우고 있었고, 헤더 종은 이 API 를 읽어 0 을 보였다 — 같은 개념의 출처가 둘이었다.
 *   §11.209d 가 헤더의 mock 을 걷어낼 때 알림 센터는 형제 슬롯으로 남았다.
 *   → 두 화면이 이 훅 하나를 부른다. 화면이 보여주는 수와 종의 뱃지가 **같은 함수**에서 나온다.
 *
 * ⚠️ 이 엔드포인트(`/api/notifications`)는 2026-09-22 현재 **라우트가 없다(404)**. 그래서 두 화면 모두
 *    지금은 0건이다. 404 처리는 별건(호영님 지시: 이 변경과 분리)이다.
 */
import { useQuery } from "@tanstack/react-query";
import type { NotificationItem } from "@/lib/notifications/notification-query";

export const IN_APP_NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;

export interface InAppNotificationsResponse {
  notifications: NotificationItem[];
  unreadCount: number;
  limit: number;
  offset: number;
}

// §11.209d-notification-inapp-web-bell-ui — actionType=IN_APP 만(EMAIL_DRAFT / QUEUE_ITEM 별도) · 1분 폴링.
export function useInAppNotifications() {
  return useQuery({
    queryKey: IN_APP_NOTIFICATIONS_QUERY_KEY,
    queryFn: async (): Promise<InAppNotificationsResponse> => {
      const res = await fetch("/api/notifications?actionType=IN_APP&limit=20");
      if (!res.ok) throw new Error("알림 조회 실패");
      return (await res.json()) as InAppNotificationsResponse;
    },
    refetchInterval: 60_000,
  });
}
