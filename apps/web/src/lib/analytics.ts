/**
 * Analytics 이벤트 추적 유틸리티
 * PRD 14.4 이벤트(Analytics) 설계 초안 기반
 */

export type AnalyticsEvent =
  // Core Events (P0)
  | "search_run"
  | "result_add_to_compare"
  | "result_add_to_list"
  | "compare_open"
  | "compare_remove_item"
  | "list_open"
  | "list_update_qty"
  | "list_update_note"
  | "list_export_tsv"
  | "list_export_csv"
  | "list_export_xlsx"
  | "protocol_paste"
  | "protocol_extract_run"
  | "protocol_extract_accept_item"
  | "protocol_extract_edit_item"
  // P1 Events
  | "list_save"
  | "list_load"
  | "list_version_create"
  | "share_link_create"
  | "share_link_open"
  | "rfq_create"
  | "rfq_send_template_copy"
  | "rfq_reply_submit_form"
  | "rfq_reply_upload_file"
  | "rfq_reply_paste_table"
  | "budget_set"
  | "budget_view";

export interface AnalyticsEventProperties {
  // search_run
  query?: string;
  category?: string;
  vendor_filter_count?: number;
  
  // result_add_to_compare, result_add_to_list
  product_id?: string;
  vendor?: string;
  
  // list_update_qty, list_update_note
  item_id?: string;
  quantity?: number;
  note?: string;
  
  // list_export_*
  item_count?: number;
  total_amount?: number;
  
  // protocol_extract_*
  extracted_item_count?: number;
  accepted_item_count?: number;
  edited_item_count?: number;
  
  // list_save, list_load
  list_id?: string;
  list_item_count?: number;
  
  // share_link_*
  share_link_id?: string;
  is_expired?: boolean;
  
  // rfq_*
  rfq_id?: string;
  vendor_count?: number;
  item_count?: number;
  
  // budget_*
  budget_id?: string;
  budget_amount?: number;
  usage_rate?: number;
  
  // 공통
  user_id?: string;
  session_id?: string;
  timestamp?: string;
  [key: string]: any; // 추가 속성 허용
}

/**
 * Analytics 이벤트 추적 함수
 * 클라이언트 사이드에서 호출하여 이벤트를 서버로 전송
 */
export async function trackEvent(
  event: AnalyticsEvent,
  properties?: AnalyticsEventProperties
): Promise<void> {
  try {
    // 클라이언트 사이드에서만 실행
    if (typeof window === "undefined") return;

    // 기본 속성 추가
    const eventData = {
      event,
      properties: {
        ...properties,
        timestamp: new Date().toISOString(),
        session_id: getSessionId(),
        url: window.location.href,
        path: window.location.pathname,
      },
    };

    // 서버로 이벤트 전송 (비동기, 에러 무시)
    fetch("/api/analytics/track", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventData),
    }).catch((error) => {
      // 에러는 조용히 무시 (Analytics는 앱 동작에 영향을 주지 않아야 함)
      console.debug("Analytics tracking error:", error);
    });

    // 개발 환경에서는 콘솔에 로그 출력
    if (process.env.NODE_ENV === "development") {
      console.log("[Analytics]", event, properties);
    }
  } catch (error) {
    // Analytics 에러는 앱 동작에 영향을 주지 않아야 함
    console.debug("Analytics tracking error:", error);
  }
}

/**
 * 세션 ID 생성/조회
 * 브라우저 세션 동안 유지되는 ID
 */
function getSessionId(): string {
  if (typeof window === "undefined") return "";

  const key = "analytics_session_id";
  let sessionId = sessionStorage.getItem(key);

  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem(key, sessionId);
  }

  return sessionId;
}

/**
 * 사용자 ID 설정 (로그인 시)
 */
export function setUserId(userId: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem("analytics_user_id", userId);
}

/**
 * 사용자 ID 조회
 */
export function getUserId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("analytics_user_id");
}

/**
 * React Hook for tracking events
 */
export function useAnalytics() {
  return {
    track: trackEvent,
    setUserId,
    getUserId,
  };
}









