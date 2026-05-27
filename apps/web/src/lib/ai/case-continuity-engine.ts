/**
 * Case Continuity Engine — domain 이동/복귀 시 의미 일관성 보장
 *
 * 전제: PolicyApprovalConflictPayload가 고정된 상태.
 * 이 엔진은 case 이동/복귀/stale 시 같은 설명과 같은 승인 경로를 유지.
 *
 * CONTINUITY RULES:
 * 1. domain 이동 시 case context (conflictPayload) 유지
 * 2. resolution 후 복귀 규칙 결정
 * 3. right rail persistence scope
 * 4. selected case continuity across views
 * 5. stale refresh → explanation payload 재생성 (UI 재계산 아님)
 * 6. breadcrumb/filter 유지
 */

import type { ApprovalDomain } from "./approval-inbox-projection-v2-engine";
import type { PolicyApprovalConflictPayload } from "./policy-approval-conflict-diagnostics-engine";

// ── Case Context Snapshot ──
export interface CaseContextSnapshot {
  caseId: string;
  currentDomain: ApprovalDomain | null;
  /** 충돌 진단 payload — 이것이 case 전체의 explanation truth */
  conflictPayload: PolicyApprovalConflictPayload | null;
  /** 현재 선택된 inbox item의 source session */
  sourceSessionId: string | null;
  /** rail에 표시할 마지막 유효 explanation */
  lastValidExplanation: PolicyApprovalConflictPayload | null;
  /** 이전 domain (복귀 시 사용) */
  previousDomain: ApprovalDomain | null;
  /** domain stack (breadcrumb 역할) */
  domainStack: ApprovalDomain[];
  /** 마지막 resolution 결과 */
  lastResolutionDecision: string | null;
  /** stale 여부 */
  isStale: boolean;
  staleReason: string;
  /** timestamp */
  contextCreatedAt: string;
  contextLastUpdatedAt: string;
}

// ── Create Context ──
export function createCaseContext(
  caseId: string,
  conflictPayload: PolicyApprovalConflictPayload | null,
): CaseContextSnapshot {
  const now = new Date().toISOString();
  return {
    caseId,
    currentDomain: null,
    conflictPayload,
    sourceSessionId: null,
    lastValidExplanation: conflictPayload,
    previousDomain: null,
    domainStack: [],
    lastResolutionDecision: null,
    isStale: false,
    staleReason: "",
    contextCreatedAt: now,
    contextLastUpdatedAt: now,
  };
}

// ── Domain Navigation ──

export type CaseNavigationEvent =
  | { type: "enter_domain"; domain: ApprovalDomain; sessionId: string }
  | { type: "exit_domain" }
  | { type: "switch_domain"; domain: ApprovalDomain; sessionId: string }
  | { type: "resolution_complete"; decision: string }
  | { type: "refresh_explanation"; payload: PolicyApprovalConflictPayload }
  | { type: "mark_stale"; reason: string }
  | { type: "clear_stale" }
  | { type: "select_case"; caseId: string; payload: PolicyApprovalConflictPayload | null }
  | { type: "deselect_case" };

export function applyCaseNavigation(
  context: CaseContextSnapshot,
  event: CaseNavigationEvent,
): CaseContextSnapshot {
  const now = new Date().toISOString();
  let u = { ...context, contextLastUpdatedAt: now };

  switch (event.type) {
    case "enter_domain":
      u.previousDomain = u.currentDomain;
      u.currentDomain = event.domain;
      u.sourceSessionId = event.sessionId;
      if (!u.domainStack.includes(event.domain)) {
        u.domainStack = [...u.domainStack, event.domain];
      }
      break;

    case "exit_domain":
      u.previousDomain = u.currentDomain;
      u.currentDomain = null;
      u.sourceSessionId = null;
      break;

    case "switch_domain":
      // domain 이동 — explanation payload 유지 (재계산 없이)
      u.previousDomain = u.currentDomain;
      u.currentDomain = event.domain;
      u.sourceSessionId = event.sessionId;
      if (!u.domainStack.includes(event.domain)) {
        u.domainStack = [...u.domainStack, event.domain];
      }
      // conflict payload는 유지 — 같은 case의 설명은 domain이 바뀌어도 같음
      break;

    case "resolution_complete":
      u.lastResolutionDecision = event.decision;
      // domain stack에서 현재 domain 제거 (처리 완료)
      if (u.currentDomain) {
        u.domainStack = u.domainStack.filter(d => d !== u.currentDomain);
      }
      break;

    case "refresh_explanation":
      // stale 해소 — engine에서 재생성된 payload로 교체
      u.conflictPayload = event.payload;
      u.lastValidExplanation = event.payload;
      u.isStale = false;
      u.staleReason = "";
      break;

    case "mark_stale":
      u.isStale = true;
      u.staleReason = event.reason;
      // stale이어도 lastValidExplanation은 유지 — "이전 기준" 표시용
      break;

    case "clear_stale":
      u.isStale = false;
      u.staleReason = "";
      break;

    case "select_case":
      u.caseId = event.caseId;
      u.conflictPayload = event.payload;
      u.lastValidExplanation = event.payload;
      u.currentDomain = null;
      u.previousDomain = null;
      u.domainStack = [];
      u.sourceSessionId = null;
      u.lastResolutionDecision = null;
      u.isStale = false;
      u.staleReason = "";
      break;

    case "deselect_case":
      u.currentDomain = null;
      u.previousDomain = null;
      u.sourceSessionId = null;
      u.domainStack = [];
      u.lastResolutionDecision = null;
      break;
  }

  return u;
}

// ── Resolution 후 복귀 규칙 ──
export interface PostResolutionDestination {
  target: "inbox" | "same_case_next_domain" | "same_case_overview" | "dashboard" | "stay";
  domain: ApprovalDomain | null;
  reason: string;
}

export function computePostResolutionDestination(
  context: CaseContextSnapshot,
  decision: string,
  remainingPendingDomains: ApprovalDomain[],
  inboxHasPending: boolean,
): PostResolutionDestination {
  // 같은 case에 남은 pending domain이 있으면 그쪽으로
  if (decision === "approved" && remainingPendingDomains.length > 0) {
    return {
      target: "same_case_next_domain",
      domain: remainingPendingDomains[0],
      reason: `동일 케이스 ${remainingPendingDomains.length}건 추가 승인 대기`,
    };
  }

  // Escalation → inbox escalation view
  if (decision === "escalated") {
    return {
      target: "inbox",
      domain: null,
      reason: "에스컬레이션 완료 — inbox 에스컬레이션 뷰로 이동",
    };
  }

  // Request change → stay on workbench
  if (decision === "request_change") {
    return {
      target: "stay",
      domain: context.currentDomain,
      reason: "수정 요청 전달됨 — 응답 대기",
    };
  }

  // Error → stay
  if (decision === "error") {
    return {
      target: "stay",
      domain: context.currentDomain,
      reason: "오류 발생 — 재시도 가능",
    };
  }

  // Approved/Rejected + inbox has pending → inbox
  if (inboxHasPending) {
    return {
      target: "inbox",
      domain: null,
      reason: "처리 완료 — inbox 대기 건으로 이동",
    };
  }

  // All clear → dashboard
  return {
    target: "dashboard",
    domain: null,
    reason: "모든 대기 건 처리 완료 — 대시보드로 이동",
  };
}

// ── Stale Detection ──
export function detectStale(
  context: CaseContextSnapshot,
  currentPayloadGeneratedAt: string,
): { isStale: boolean; reason: string } {
  if (!context.conflictPayload) {
    return { isStale: false, reason: "" };
  }

  // Payload가 context 생성 이후에 재생성됐으면 stale
  if (currentPayloadGeneratedAt > context.contextLastUpdatedAt) {
    return {
      isStale: true,
      reason: "정책/승인 상태가 변경됨 — 새로고침 필요",
    };
  }

  return { isStale: false, reason: "" };
}

// ── Rail Persistence Scope ──
export interface RailPersistenceScope {
  /** rail은 같은 case 내 domain 이동 시 열림 유지 */
  preserveOnDomainSwitch: boolean;
  /** rail은 case 변경 시 닫힘 (pinned가 아닌 경우) */
  closeOnCaseChange: boolean;
  /** rail은 resolution 후 열림 유지 (결과 표시) */
  preserveOnResolution: boolean;
  /** rail에 표시할 explanation은 항상 lastValidExplanation */
  explanationSource: "current" | "last_valid";
}

export function getRailPersistenceScope(context: CaseContextSnapshot): RailPersistenceScope {
  return {
    preserveOnDomainSwitch: true,
    closeOnCaseChange: true,
    preserveOnResolution: true,
    // stale이면 last_valid를 보여주되 stale 배너 표시
    explanationSource: context.isStale ? "last_valid" : "current",
  };
}

// ══════════════════════════════════════════════
// Continuity Hardening Batch 2
// ══════════════════════════════════════════════

/**
 * NavigationMessage — resolution/stale/redirect 시 operator에게 표시할 메시지
 * 같은 explanation 계열 문법을 사용.
 */
export interface NavigationMessage {
  type: "success" | "info" | "warning" | "error";
  title: string;
  detail: string;
  /** 설명 payload에서 온 것인지 여부 */
  fromExplanationPayload: boolean;
}

/**
 * buildResolutionMessage — resolution 후 "왜 여기로 왔는지" 설명
 */
export function buildResolutionMessage(
  decision: string,
  destination: PostResolutionDestination,
  context: CaseContextSnapshot,
): NavigationMessage {
  switch (destination.target) {
    case "same_case_next_domain":
      return {
        type: "success",
        title: `${decision === "approved" ? "승인" : "처리"} 완료`,
        detail: `동일 케이스에 ${destination.reason}`,
        fromExplanationPayload: false,
      };
    case "inbox":
      return {
        type: decision === "approved" ? "success" : decision === "escalated" ? "warning" : "info",
        title: decision === "approved" ? "승인 완료" : decision === "escalated" ? "에스컬레이션 완료" : "처리 완료",
        detail: destination.reason,
        fromExplanationPayload: false,
      };
    case "dashboard":
      return {
        type: "success",
        title: "모든 대기 건 처리 완료",
        detail: destination.reason,
        fromExplanationPayload: false,
      };
    case "stay":
      return {
        type: decision === "error" ? "error" : "info",
        title: decision === "error" ? "오류 발생" : "대기 중",
        detail: destination.reason,
        fromExplanationPayload: false,
      };
    default:
      return {
        type: "info",
        title: "이동",
        detail: destination.reason,
        fromExplanationPayload: false,
      };
  }
}

/**
 * buildStaleMessage — stale 발생 시 설명
 */
export function buildStaleMessage(
  context: CaseContextSnapshot,
): NavigationMessage {
  return {
    type: "warning",
    title: "상태 변경 감지",
    detail: context.staleReason || "정책 또는 승인 상태가 변경되었습니다. 새로고침 후 최신 상태를 확인하세요.",
    fromExplanationPayload: true,
  };
}

/**
 * buildRedirectMessage — redirect 시 설명
 */
export function buildRedirectMessage(
  reason: string,
  fromRoute: string,
  toRoute: string,
): NavigationMessage {
  return {
    type: "info",
    title: "자동 이동",
    detail: `${reason} (${fromRoute} → ${toRoute})`,
    fromExplanationPayload: false,
  };
}

// ══════════════════════════════════════════════
// Breadcrumb Continuity
// ══════════════════════════════════════════════

/**
 * buildContinuityBreadcrumbs — case context 기반 breadcrumb (filter/state 포함)
 */
export function buildContinuityBreadcrumbs(context: CaseContextSnapshot): Array<{
  label: string;
  href: string;
  active: boolean;
  hasExplanation: boolean;
}> {
  const crumbs: Array<{ label: string; href: string; active: boolean; hasExplanation: boolean }> = [];

  crumbs.push({
    label: "Governance",
    href: "/dashboard/approval",
    active: !context.currentDomain && !context.caseId,
    hasExplanation: false,
  });

  if (context.caseId) {
    crumbs.push({
      label: `Case ${context.caseId.slice(0, 8)}`,
      href: `/dashboard/approval/case/${context.caseId}`,
      active: !context.currentDomain,
      hasExplanation: context.conflictPayload !== null,
    });
  }

  if (context.currentDomain) {
    const DOMAIN_SHORT: Record<string, string> = {
      fire_execution: "발송",
      stock_release: "릴리스",
      exception_resolve: "예외해결",
      exception_return_to_stage: "예외복귀",
    };
    crumbs.push({
      label: DOMAIN_SHORT[context.currentDomain] || context.currentDomain,
      href: `/dashboard/approval/case/${context.caseId}/${context.currentDomain}`,
      active: true,
      hasExplanation: context.conflictPayload !== null,
    });
  }

  if (context.isStale) {
    crumbs.push({
      label: "⚠ Stale",
      href: "#",
      active: false,
      hasExplanation: false,
    });
  }

  return crumbs;
}

// ── Events ──
export type CaseContinuityEventType = "case_context_created" | "domain_entered" | "domain_switched" | "resolution_completed" | "explanation_refreshed" | "stale_detected" | "stale_cleared" | "navigation_message_shown" | "redirect_executed";
export interface CaseContinuityEvent { type: CaseContinuityEventType; caseId: string; domain: ApprovalDomain | null; reason: string; timestamp: string; }
