import { Sentry } from "./sentry";

/**
 * Analytics Event Logger
 * 모든 하드웨어 액션과 주요 비즈니스 이벤트를 로깅합니다.
 * Sentry breadcrumb로 기록하며, 향후 전용 analytics SDK(Amplitude, Mixpanel 등)로 확장 가능합니다.
 */

type AnalyticsEvent =
  // QR/바코드 스캔
  | "qr_scan_started"
  | "qr_scan_success"
  | "qr_scan_unmatched"
  | "qr_scan_failed"
  | "qr_action_selected"
  // 푸시 알림
  | "push_opened"
  | "push_deeplink_success"
  | "push_deeplink_failed"
  | "push_permission_granted"
  | "push_permission_denied"
  // 사진 첨부
  | "photo_attached"
  | "photo_upload_success"
  | "photo_upload_failed"
  | "photo_retry_clicked"
  | "photo_permission_denied"
  // 일반 작업
  | "screen_viewed"
  | "action_completed";

type AnalyticsData = Record<string, string | number | boolean | null | undefined>;

export function logEvent(event: AnalyticsEvent, data?: AnalyticsData): void {
  // 1) Sentry breadcrumb (프로덕션에서 에러 추적 시 컨텍스트 제공)
  Sentry.addBreadcrumb({
    category: "analytics",
    message: event,
    data: data as Record<string, string>,
    level: "info",
  });

  // 2) 개발 모드에서는 콘솔에도 출력
  if (__DEV__) {
    console.log(`[Analytics] ${event}`, data ?? "");
  }

  // 3) 향후 전용 analytics SDK 연동 포인트
  // Amplitude.logEvent(event, data);
  // Mixpanel.track(event, data);
}
