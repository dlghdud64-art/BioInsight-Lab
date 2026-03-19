/**
 * Timeline / Activity Feed 운영 로그 계약
 *
 * Timeline = 엔티티 단위 상태 변화 이력 (상세 페이지용)
 * Activity Feed = 여러 엔티티 활동 요약 (대시보드/허브용)
 * 두 개념을 같은 UI/카피로 재사용하지 않는다.
 */

// ═══════════════════════════════════════════════════
// Event Importance Level
// ═══════════════════════════════════════════════════

export type EventImportance = "critical" | "standard" | "minor";

/** 이벤트 중요도 결정 규칙 */
export function resolveEventImportance(eventType: string): EventImportance {
  const CRITICAL_EVENTS = new Set([
    "approval_granted",
    "approval_rejected",
    "quote_draft_submission_requested",
    "review_item_approved",
    "compare_selection_confirmed",
    "budget_override_requested",
    "manual_override",
  ]);

  const MINOR_EVENTS = new Set([
    "review_item_updated",
    "quote_draft_item_updated",
    "document_parsed",
    "bulk_action_executed",
  ]);

  if (CRITICAL_EVENTS.has(eventType)) return "critical";
  if (MINOR_EVENTS.has(eventType)) return "minor";
  return "standard";
}

// ═══════════════════════════════════════════════════
// Timeline Item ViewModel (엔티티 상세용)
// ═══════════════════════════════════════════════════

export interface TimelineItemViewModel {
  id: string;
  importance: EventImportance;
  actorLabel: string;          // "운영 담당자" / "시스템"
  actorType: "user" | "system" | "assistant";
  actionPhrase: string;        // "승인 요청을 등록했습니다"
  timestamp: string;           // ISO
  timeFormatted: string;       // "2시간 전" / "2026-03-19 14:24"
  stateChange?: {
    from: string;              // "검토 대기"
    to: string;                // "승인 완료"
  };
  relatedHref?: string;        // 관련 문서/상세 링크
  relatedLabel?: string;       // "승인 요청 보기"
  metadata?: string;           // 보조 설명
}

// ═══════════════════════════════════════════════════
// Activity Feed Item ViewModel (대시보드/허브용)
// ═══════════════════════════════════════════════════

export interface ActivityFeedItemViewModel {
  id: string;
  importance: EventImportance;
  actorLabel: string;
  actionPhrase: string;
  entityLabel?: string;        // "견적 요청 #Q-1024"
  entityHref?: string;
  timestamp: string;
  timeFormatted: string;
  badge?: {
    label: string;
    tone: "green" | "amber" | "red" | "blue" | "slate";
  };
}

// ═══════════════════════════════════════════════════
// Event → Human-readable Action Phrase Mapping
// ═══════════════════════════════════════════════════

const ACTION_PHRASES: Record<string, string> = {
  // Step 1
  review_item_created: "검토 큐에 항목을 추가했습니다",
  review_item_updated: "검토 항목을 수정했습니다",
  review_item_status_changed: "검토 항목의 상태를 변경했습니다",
  review_item_approved: "검토 항목을 승인했습니다",
  review_item_excluded: "검토 항목을 제외했습니다",
  review_item_restored: "제외된 항목을 복구했습니다",
  review_item_sent_to_compare: "비교 큐로 전송했습니다",
  review_item_sent_to_quote_draft: "견적 초안으로 전송했습니다",

  // Step 2
  compare_item_created: "비교 큐에 항목을 추가했습니다",
  compare_candidate_selected: "후보 제품을 선택했습니다",
  compare_selection_confirmed: "후보 선택을 확정했습니다",
  compare_selection_cleared: "후보 선택을 초기화했습니다",
  compare_item_removed: "비교 항목을 제거했습니다",
  compare_item_sent_to_quote_draft: "견적 초안으로 전송했습니다",

  // Step 3
  quote_draft_item_created: "견적 초안에 항목을 추가했습니다",
  quote_draft_item_updated: "견적 초안 항목을 수정했습니다",
  quote_draft_status_changed: "견적 초안 상태를 변경했습니다",
  quote_draft_item_removed: "견적 초안 항목을 제거했습니다",
  quote_draft_submission_requested: "견적 요청 제출을 요청했습니다",
  quote_draft_submission_ready: "견적 초안이 제출 가능 상태로 변경되었습니다",
  quote_draft_submission_blocked: "견적 초안 제출이 차단되었습니다",

  // Upload
  document_uploaded: "문서를 업로드했습니다",
  document_parsed: "문서 분석이 완료되었습니다",
  excel_mapping_confirmed: "엑셀 컬럼 매핑을 확정했습니다",
  protocol_evidence_linked: "프로토콜 근거를 연결했습니다",

  // Approval
  approval_requested: "승인을 요청했습니다",
  approval_granted: "승인을 완료했습니다",
  approval_rejected: "승인을 반려했습니다",

  // Override
  manual_override: "수동으로 판단을 변경했습니다",
  budget_override_requested: "예산 경고를 무시하고 진행을 요청했습니다",
  inventory_warning_acknowledged: "재고 중복 경고를 확인했습니다",

  // Organization
  member_invited: "멤버를 초대했습니다",
  member_role_changed: "멤버 역할을 변경했습니다",
  member_removed: "멤버를 제거했습니다",

  // Bulk
  bulk_action_executed: "일괄 작업을 실행했습니다",
};

/** 이벤트 타입 → 사람 읽기 가능 문구 */
export function getActionPhrase(eventType: string): string {
  return ACTION_PHRASES[eventType] ?? `${eventType} 이벤트가 발생했습니다`;
}

// ═══════════════════════════════════════════════════
// State Change Label Mapping
// ═══════════════════════════════════════════════════

const STATE_LABELS: Record<string, string> = {
  confirmed: "확정 가능",
  needs_review: "검토 필요",
  match_failed: "매칭 실패",
  compare_needed: "비교 필요",
  approved: "승인 완료",
  excluded: "제외됨",
  pending_comparison: "비교 대기",
  selection_needed: "선택 필요",
  selection_confirmed: "선택 확정",
  removed: "제거됨",
  draft_ready: "제출 가능",
  missing_required_fields: "필수 정보 누락",
  awaiting_review: "검토 대기",
  pending_approval: "승인 대기",
  rejected: "반려됨",
};

/** 상태 코드 → 사용자 라벨 */
export function getStateLabel(state: string): string {
  return STATE_LABELS[state] ?? state;
}

// ═══════════════════════════════════════════════════
// Time Formatting
// ═══════════════════════════════════════════════════

/** 상대 시간 포맷 */
export function formatRelativeTime(isoTimestamp: string): string {
  const now = Date.now();
  const target = new Date(isoTimestamp).getTime();
  const diffMs = now - target;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  return new Date(isoTimestamp).toLocaleDateString("ko-KR");
}

// ═══════════════════════════════════════════════════
// Feed Filtering / Grouping
// ═══════════════════════════════════════════════════

/** 중요 이벤트만 필터 */
export function filterCriticalEvents<T extends { importance: EventImportance }>(items: T[]): T[] {
  return items.filter((i) => i.importance === "critical");
}

/** 오늘 이벤트만 필터 */
export function filterTodayEvents<T extends { timestamp: string }>(items: T[]): T[] {
  const today = new Date().toISOString().slice(0, 10);
  return items.filter((i) => i.timestamp.startsWith(today));
}
