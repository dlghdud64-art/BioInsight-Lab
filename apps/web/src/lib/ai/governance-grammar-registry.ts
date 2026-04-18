/**
 * Governance Grammar Registry — 운영 체인 전체 언어 고정
 *
 * 13-stage procurement chain의 모든 stage/status/action/panel/severity/blocker 언어를
 * 단일 registry에 고정.
 *
 * PURPOSE:
 * - 같은 개념을 다른 이름으로 부르는 문제 제거
 * - operator가 보는 UI 문구와 코드 타입명을 1:1 매핑
 * - hard blocker / soft blocker / info의 행동 계약을 formal spec으로 고정
 * - 새 domain 추가 시 이 registry에 맞춰야 하는 immutable naming rules 확립
 *
 * IMMUTABLE NAMING RULES:
 * 1. status 이름은 "현재 무엇인가"로 — 동사형 금지 (evaluating 허용은 진행상태 예외)
 * 2. action 이름은 "무엇을 하라"로 — 명사형 금지
 * 3. panel 이름은 "무엇이 막혀있다/대기중이다"로 — 과거형 금지
 * 4. severity는 3단계만: info / warning / critical — "error"는 severity가 아님
 * 5. blocker severity는 2단계만: hard / soft — hard이면 irreversible action 잠금
 * 6. 국문 label은 operator 관점 — 개발자 용어 금지
 * 7. terminal status는 각 domain별로 명시적 배열로 관리
 * 8. "ready" prefix는 "다음 단계 진입 가능"을 의미 — 완료(completed)와 구분
 */

import type { GovernanceDomain } from "./governance-event-bus";
import type { QuoteChainStage } from "./quote-approval-governance-engine";

// ══════════════════════════════════════════════════════
// 1. Chain Stage Grammar — 13단계 확정
// ══════════════════════════════════════════════════════

export interface StageGrammar {
  /** Code-level identifier */
  stage: QuoteChainStage;
  /** Operator-facing short label (≤4자) */
  shortLabel: string;
  /** Operator-facing full label */
  fullLabel: string;
  /** Which governance domain owns this stage */
  domain: GovernanceDomain;
  /** Phase grouping for UI strip */
  phase: "sourcing" | "approval" | "dispatch" | "fulfillment" | "inventory";
  /** 0-based order in chain */
  order: number;
  /**
   * Visibility policy — label grammar와 분리.
   * pilot: 파일럿에서만 노출, ga: 정식 노출, hidden: 숨김.
   * UI strip은 이 필드로 display gating — label 존재와 노출 여부는 별개.
   */
  visibility: "ga" | "pilot" | "hidden";
}

export const CHAIN_STAGE_GRAMMAR: readonly StageGrammar[] = [
  // ── Phase: Sourcing ──
  { stage: "quote_review",       shortLabel: "검토",    fullLabel: "견적 검토",       domain: "quote_chain",          phase: "sourcing",    order: 0,  visibility: "ga" },
  { stage: "quote_shortlist",    shortLabel: "선정",    fullLabel: "견적 후보 선정",   domain: "quote_chain",          phase: "sourcing",    order: 1,  visibility: "ga" },
  // ── Phase: Approval ──
  { stage: "quote_approval",     shortLabel: "견적승인", fullLabel: "견적 승인",       domain: "quote_chain",          phase: "approval",    order: 2,  visibility: "ga" },
  { stage: "po_conversion",      shortLabel: "PO전환",   fullLabel: "발주서 전환",     domain: "quote_chain",          phase: "approval",    order: 3,  visibility: "ga" },
  { stage: "po_approval",        shortLabel: "PO승인",   fullLabel: "발주서 승인",     domain: "quote_chain",          phase: "approval",    order: 4,  visibility: "ga" },
  // ── Phase: Dispatch ──
  { stage: "po_send_readiness",  shortLabel: "발송준비", fullLabel: "발송 준비 검증",   domain: "dispatch_prep",        phase: "dispatch",    order: 5,  visibility: "ga" },
  { stage: "po_created",         shortLabel: "PO생성",   fullLabel: "발주서 생성 완료", domain: "dispatch_prep",        phase: "dispatch",    order: 6,  visibility: "ga" },
  { stage: "dispatch_prep",      shortLabel: "발송검증", fullLabel: "발송 전 최종 검증", domain: "dispatch_prep",        phase: "dispatch",    order: 7,  visibility: "ga" },
  { stage: "sent",               shortLabel: "발송완료", fullLabel: "공급사 발송 완료",  domain: "dispatch_execution",   phase: "dispatch",    order: 8,  visibility: "ga" },
  // ── Phase: Fulfillment ──
  { stage: "supplier_confirmed", shortLabel: "공급확인", fullLabel: "공급사 확인",      domain: "supplier_confirmation", phase: "fulfillment", order: 9,  visibility: "ga" },
  { stage: "receiving_prep",     shortLabel: "입고준비", fullLabel: "입고 준비",         domain: "receiving_prep",       phase: "fulfillment", order: 10, visibility: "ga" },
  // ── Phase: Inventory ──
  { stage: "stock_release",      shortLabel: "릴리즈",   fullLabel: "재고 릴리즈",      domain: "stock_release",        phase: "inventory",   order: 11, visibility: "ga" },
  { stage: "reorder_decision",   shortLabel: "재주문",   fullLabel: "재주문 판단",      domain: "reorder_decision",     phase: "inventory",   order: 12, visibility: "ga" },
] as const;

// ══════════════════════════════════════════════════════
// 2. Unified Status Grammar — domain별 상태 정의
// ══════════════════════════════════════════════════════

/**
 * 전체 상태 카테고리 — domain별 상태가 이 중 하나에 속함.
 *
 * not_started: 아직 시작 안 됨
 * in_progress: 진행 중 (평가/검증/처리 중)
 * waiting: 외부 입력 대기 (supplier 응답, 입고 등)
 * blocked: 차단 조건 존재 — action 필요
 * ready: 다음 단계 진입 가능
 * completed: 이 단계 종료 (terminal 또는 handoff 완료)
 * cancelled: 취소 (terminal)
 */
export type StatusCategory =
  | "not_started"
  | "in_progress"
  | "waiting"
  | "blocked"
  | "ready"
  | "completed"
  | "cancelled";

export interface StatusGrammar {
  /** Code-level status value */
  status: string;
  /** Which domain this status belongs to */
  domain: GovernanceDomain;
  /** Status category */
  category: StatusCategory;
  /** Operator-facing label */
  label: string;
  /** Is this a terminal status */
  isTerminal: boolean;
  /** Can irreversible actions be taken in this status */
  allowsIrreversibleAction: boolean;
}

export const STATUS_GRAMMAR: readonly StatusGrammar[] = [
  // ── Dispatch Prep ──
  { status: "not_evaluated",    domain: "dispatch_prep",        category: "not_started",  label: "미평가",         isTerminal: false, allowsIrreversibleAction: false },
  { status: "blocked",          domain: "dispatch_prep",        category: "blocked",      label: "차단됨",         isTerminal: false, allowsIrreversibleAction: false },
  { status: "needs_review",     domain: "dispatch_prep",        category: "in_progress",  label: "검토 필요",      isTerminal: false, allowsIrreversibleAction: false },
  { status: "ready_to_send",    domain: "dispatch_prep",        category: "ready",        label: "발송 가능",      isTerminal: false, allowsIrreversibleAction: true },
  { status: "scheduled",        domain: "dispatch_prep",        category: "waiting",      label: "발송 예약됨",    isTerminal: false, allowsIrreversibleAction: false },
  { status: "sent",             domain: "dispatch_prep",        category: "completed",    label: "발송 완료",      isTerminal: true,  allowsIrreversibleAction: false },
  { status: "cancelled",        domain: "dispatch_prep",        category: "cancelled",    label: "취소됨",         isTerminal: true,  allowsIrreversibleAction: false },

  // ── Dispatch Execution ──
  { status: "draft_dispatch",   domain: "dispatch_execution",   category: "not_started",  label: "초안",           isTerminal: false, allowsIrreversibleAction: false },
  { status: "scheduled",        domain: "dispatch_execution",   category: "waiting",      label: "예약됨",         isTerminal: false, allowsIrreversibleAction: false },
  { status: "queued_to_send",   domain: "dispatch_execution",   category: "in_progress",  label: "발송 대기열",    isTerminal: false, allowsIrreversibleAction: false },
  { status: "sending",          domain: "dispatch_execution",   category: "in_progress",  label: "발송 중",        isTerminal: false, allowsIrreversibleAction: false },
  { status: "sent",             domain: "dispatch_execution",   category: "completed",    label: "발송 완료",      isTerminal: true,  allowsIrreversibleAction: false },
  { status: "send_failed",      domain: "dispatch_execution",   category: "blocked",      label: "발송 실패",      isTerminal: false, allowsIrreversibleAction: false },
  { status: "cancelled",        domain: "dispatch_execution",   category: "cancelled",    label: "취소됨",         isTerminal: true,  allowsIrreversibleAction: false },

  // ── Supplier Confirmation ──
  { status: "awaiting_response",  domain: "supplier_confirmation", category: "waiting",     label: "응답 대기",      isTerminal: false, allowsIrreversibleAction: false },
  { status: "response_received",  domain: "supplier_confirmation", category: "in_progress", label: "응답 수신",      isTerminal: false, allowsIrreversibleAction: false },
  { status: "confirmed",          domain: "supplier_confirmation", category: "completed",   label: "확인 완료",      isTerminal: true,  allowsIrreversibleAction: false },
  { status: "partially_confirmed", domain: "supplier_confirmation", category: "in_progress", label: "부분 확인",     isTerminal: false, allowsIrreversibleAction: false },
  { status: "change_requested",   domain: "supplier_confirmation", category: "blocked",     label: "변경 요청",      isTerminal: false, allowsIrreversibleAction: false },
  { status: "rejected",           domain: "supplier_confirmation", category: "completed",   label: "거부됨",         isTerminal: true,  allowsIrreversibleAction: false },
  { status: "expired",            domain: "supplier_confirmation", category: "blocked",     label: "만료됨",         isTerminal: false, allowsIrreversibleAction: false },
  { status: "cancelled",          domain: "supplier_confirmation", category: "cancelled",   label: "취소됨",         isTerminal: true,  allowsIrreversibleAction: false },

  // ── Receiving Prep ──
  { status: "not_evaluated",    domain: "receiving_prep",       category: "not_started",  label: "미평가",         isTerminal: false, allowsIrreversibleAction: false },
  { status: "blocked",          domain: "receiving_prep",       category: "blocked",      label: "차단됨",         isTerminal: false, allowsIrreversibleAction: false },
  { status: "needs_review",     domain: "receiving_prep",       category: "in_progress",  label: "검토 필요",      isTerminal: false, allowsIrreversibleAction: false },
  { status: "ready_to_receive", domain: "receiving_prep",       category: "ready",        label: "입고 가능",      isTerminal: false, allowsIrreversibleAction: true },
  { status: "scheduled",        domain: "receiving_prep",       category: "waiting",      label: "입고 예약됨",    isTerminal: false, allowsIrreversibleAction: false },
  { status: "cancelled",        domain: "receiving_prep",       category: "cancelled",    label: "취소됨",         isTerminal: true,  allowsIrreversibleAction: false },

  // ── Receiving Execution ──
  { status: "awaiting_receipt",       domain: "receiving_execution", category: "waiting",     label: "입고 대기",      isTerminal: false, allowsIrreversibleAction: false },
  { status: "receiving_in_progress",  domain: "receiving_execution", category: "in_progress", label: "입고 진행 중",   isTerminal: false, allowsIrreversibleAction: false },
  { status: "partially_received",     domain: "receiving_execution", category: "in_progress", label: "부분 입고",      isTerminal: false, allowsIrreversibleAction: false },
  { status: "received",              domain: "receiving_execution", category: "completed",   label: "입고 완료",      isTerminal: true,  allowsIrreversibleAction: false },
  { status: "discrepancy",           domain: "receiving_execution", category: "blocked",     label: "불일치 발생",    isTerminal: false, allowsIrreversibleAction: false },
  { status: "quarantined",           domain: "receiving_execution", category: "blocked",     label: "격리 보관",      isTerminal: false, allowsIrreversibleAction: false },
  { status: "cancelled",             domain: "receiving_execution", category: "cancelled",   label: "취소됨",         isTerminal: true,  allowsIrreversibleAction: false },

  // ── Stock Release ──
  { status: "not_evaluated",       domain: "stock_release",     category: "not_started",  label: "미평가",         isTerminal: false, allowsIrreversibleAction: false },
  { status: "evaluating",          domain: "stock_release",     category: "in_progress",  label: "평가 중",        isTerminal: false, allowsIrreversibleAction: false },
  { status: "hold_active",         domain: "stock_release",     category: "blocked",      label: "보류 활성",      isTerminal: false, allowsIrreversibleAction: false },
  { status: "partially_released",  domain: "stock_release",     category: "in_progress",  label: "부분 릴리즈",    isTerminal: false, allowsIrreversibleAction: true },
  { status: "released",            domain: "stock_release",     category: "completed",    label: "릴리즈 완료",    isTerminal: true,  allowsIrreversibleAction: false },
  { status: "cancelled",           domain: "stock_release",     category: "cancelled",    label: "취소됨",         isTerminal: true,  allowsIrreversibleAction: false },

  // ── Reorder Decision ──
  { status: "not_evaluated",             domain: "reorder_decision",  category: "not_started",  label: "미평가",           isTerminal: false, allowsIrreversibleAction: false },
  { status: "evaluating",                domain: "reorder_decision",  category: "in_progress",  label: "평가 중",          isTerminal: false, allowsIrreversibleAction: false },
  { status: "watch_active",              domain: "reorder_decision",  category: "waiting",      label: "모니터링 중",      isTerminal: false, allowsIrreversibleAction: false },
  { status: "reorder_recommended",       domain: "reorder_decision",  category: "in_progress",  label: "재주문 권고",      isTerminal: false, allowsIrreversibleAction: false },
  { status: "reorder_required",          domain: "reorder_decision",  category: "blocked",      label: "재주문 필수",      isTerminal: false, allowsIrreversibleAction: true },
  { status: "expedite_required",         domain: "reorder_decision",  category: "blocked",      label: "긴급 발주 필요",   isTerminal: false, allowsIrreversibleAction: true },
  { status: "no_action",                 domain: "reorder_decision",  category: "completed",    label: "조치 불필요",      isTerminal: true,  allowsIrreversibleAction: false },
  { status: "procurement_reentry_ready", domain: "reorder_decision",  category: "ready",        label: "구매 재진입 가능", isTerminal: true,  allowsIrreversibleAction: false },
  { status: "cancelled",                 domain: "reorder_decision",  category: "cancelled",    label: "취소됨",           isTerminal: true,  allowsIrreversibleAction: false },
] as const;

// ══════════════════════════════════════════════════════
// 3. Blocker Severity Formal Spec
// ══════════════════════════════════════════════════════

/**
 * Blocker Severity Behavior Contract:
 *
 * hard: 이 blocker가 있으면 dock의 irreversible action(send, release, confirm 등)은 잠김.
 *       operator가 반드시 해결해야 다음 단계로 진행 가능.
 *       UI에 빨간색 차단 표시.
 *
 * soft: 경고만 표시. operator가 확인 후 진행 가능.
 *       UI에 노란색 주의 표시.
 *       irreversible action은 열려 있지만, confirmation checklist에 표시됨.
 */
export type BlockerSeverity = "hard" | "soft";

export interface BlockerSeverityBehavior {
  severity: BlockerSeverity;
  /** Locks irreversible dock actions */
  locksIrreversibleAction: boolean;
  /** Requires explicit operator acknowledgment */
  requiresAcknowledgment: boolean;
  /** UI badge color */
  badgeColor: "red" | "amber";
  /** Operator-facing label */
  label: string;
}

export const BLOCKER_SEVERITY_SPEC: Record<BlockerSeverity, BlockerSeverityBehavior> = {
  hard: {
    severity: "hard",
    locksIrreversibleAction: true,
    requiresAcknowledgment: true,
    badgeColor: "red",
    label: "차단",
  },
  soft: {
    severity: "soft",
    locksIrreversibleAction: false,
    requiresAcknowledgment: false,
    badgeColor: "amber",
    label: "주의",
  },
};

// ══════════════════════════════════════════════════════
// 4. Severity Grammar — 3단계만
// ══════════════════════════════════════════════════════

/**
 * Event / Panel / Surface severity — 전체 시스템 공통.
 * "error"는 severity가 아님 — error는 Error Boundary가 처리.
 */
export type UnifiedSeverity = "info" | "warning" | "critical";

export interface SeverityBehavior {
  severity: UnifiedSeverity;
  /** Panel item badge color */
  badgeColor: "slate" | "amber" | "red";
  /** Stale banner level mapping */
  staleBannerLevel: "info" | "warning" | "blocking";
  /** Invalidation scope 상한 */
  maxInvalidationScope: "surface_only" | "readiness_recompute" | "handoff_invalidate";
  /** Operator-facing label */
  label: string;
}

export const SEVERITY_SPEC: Record<UnifiedSeverity, SeverityBehavior> = {
  info: {
    severity: "info",
    badgeColor: "slate",
    staleBannerLevel: "info",
    maxInvalidationScope: "surface_only",
    label: "정보",
  },
  warning: {
    severity: "warning",
    badgeColor: "amber",
    staleBannerLevel: "warning",
    maxInvalidationScope: "readiness_recompute",
    label: "주의",
  },
  critical: {
    severity: "critical",
    badgeColor: "red",
    staleBannerLevel: "blocking",
    maxInvalidationScope: "handoff_invalidate",
    label: "심각",
  },
};

// ══════════════════════════════════════════════════════
// 5. Panel Grammar — 11 panels 확정
// ══════════════════════════════════════════════════════

export interface PanelGrammar {
  panelId: string;
  /** Operator-facing label */
  label: string;
  /** Which domain this panel monitors */
  domain: GovernanceDomain;
  /** Which chain stage */
  stage: QuoteChainStage;
  /** What this panel represents in operator language */
  description: string;
  /** Priority order (lower = higher priority) */
  priority: number;
}

export const PANEL_GRAMMAR: readonly PanelGrammar[] = [
  { panelId: "send_blocked",              label: "발송 차단",        domain: "dispatch_prep",         stage: "dispatch_prep",      description: "발송 전 차단 조건이 있는 건",            priority: 1 },
  { panelId: "send_scheduled",            label: "발송 예정",        domain: "dispatch_prep",         stage: "dispatch_prep",      description: "발송 일정이 잡혀 대기 중인 건",           priority: 8 },
  { panelId: "supplier_response_pending", label: "공급사 응답 대기",  domain: "supplier_confirmation", stage: "supplier_confirmed", description: "공급사 응답을 기다리는 건",               priority: 7 },
  { panelId: "supplier_change_requested", label: "공급사 변경 요청",  domain: "supplier_confirmation", stage: "supplier_confirmed", description: "공급사가 변경을 요청한 건",               priority: 6 },
  { panelId: "receiving_blocked",         label: "입고 차단",        domain: "receiving_prep",        stage: "receiving_prep",     description: "입고 준비 중 차단 조건이 있는 건",        priority: 2 },
  { panelId: "receiving_discrepancy",     label: "입고 불일치",       domain: "receiving_execution",   stage: "receiving_prep",     description: "입고 시 수량/품질 불일치가 발생한 건",     priority: 4 },
  { panelId: "stock_release_blocked",     label: "릴리즈 차단",      domain: "stock_release",         stage: "stock_release",      description: "재고 릴리즈가 차단된 건 (보류/검토 중)",   priority: 3 },
  { panelId: "reorder_required",          label: "재주문 필요",      domain: "reorder_decision",      stage: "reorder_decision",   description: "재주문이 필요하거나 긴급 발주가 필요한 건", priority: 5 },
  { panelId: "reorder_watch",             label: "모니터링 중",      domain: "reorder_decision",      stage: "reorder_decision",   description: "모니터링 대상으로 관찰 중인 건",           priority: 9 },
  { panelId: "procurement_reentry",       label: "구매 재진입 대기",  domain: "reorder_decision",      stage: "reorder_decision",   description: "재주문 결정 후 구매 재진입 가능한 건",     priority: 10 },
  { panelId: "chain_health",             label: "체인 건강도",       domain: "quote_chain",           stage: "quote_review",       description: "전체 구매 체인의 건강 상태 요약",          priority: 11 },
] as const;

// ══════════════════════════════════════════════════════
// 6. Dock Action Grammar — domain별 action 확정
// ══════════════════════════════════════════════════════

export type ActionRisk = "irreversible" | "reversible" | "navigation";

export interface DockActionGrammar {
  /** Code-level action key */
  actionKey: string;
  /** Operator-facing label */
  label: string;
  /** Which domain */
  domain: GovernanceDomain;
  /** Risk classification */
  risk: ActionRisk;
  /** Requires confirmation dialog */
  requiresConfirmation: boolean;
  /** Blocked when hard blocker exists */
  blockedByHardBlocker: boolean;
  /** Blocked when stale context detected */
  blockedByStale: boolean;
}

export const DOCK_ACTION_GRAMMAR: readonly DockActionGrammar[] = [
  // ── Dispatch Prep ──
  { actionKey: "send_now",              label: "즉시 발송",        domain: "dispatch_prep",         risk: "irreversible", requiresConfirmation: true,  blockedByHardBlocker: true,  blockedByStale: true },
  { actionKey: "schedule_send",         label: "발송 예약",        domain: "dispatch_prep",         risk: "reversible",   requiresConfirmation: true,  blockedByHardBlocker: true,  blockedByStale: true },
  { actionKey: "request_correction",    label: "수정 요청",        domain: "dispatch_prep",         risk: "reversible",   requiresConfirmation: false, blockedByHardBlocker: false, blockedByStale: false },
  { actionKey: "reopen_po_conversion",  label: "PO 전환 재열기",    domain: "dispatch_prep",         risk: "reversible",   requiresConfirmation: true,  blockedByHardBlocker: false, blockedByStale: false },
  { actionKey: "cancel_dispatch_prep",  label: "발송 준비 취소",    domain: "dispatch_prep",         risk: "irreversible", requiresConfirmation: true,  blockedByHardBlocker: false, blockedByStale: true },

  // ── Supplier Confirmation ──
  { actionKey: "accept_response",       label: "응답 수락",        domain: "supplier_confirmation", risk: "irreversible", requiresConfirmation: true,  blockedByHardBlocker: true,  blockedByStale: true },
  { actionKey: "reject_response",       label: "응답 거부",        domain: "supplier_confirmation", risk: "irreversible", requiresConfirmation: true,  blockedByHardBlocker: false, blockedByStale: true },
  { actionKey: "request_change",        label: "변경 요청",        domain: "supplier_confirmation", risk: "reversible",   requiresConfirmation: false, blockedByHardBlocker: false, blockedByStale: false },
  { actionKey: "escalate_response",     label: "상위 보고",        domain: "supplier_confirmation", risk: "reversible",   requiresConfirmation: true,  blockedByHardBlocker: false, blockedByStale: false },

  // ── Receiving Execution ──
  { actionKey: "confirm_receipt",       label: "입고 확인",        domain: "receiving_execution",   risk: "irreversible", requiresConfirmation: true,  blockedByHardBlocker: true,  blockedByStale: true },
  { actionKey: "report_discrepancy",    label: "불일치 신고",       domain: "receiving_execution",   risk: "reversible",   requiresConfirmation: false, blockedByHardBlocker: false, blockedByStale: false },
  { actionKey: "quarantine",            label: "격리 보관",        domain: "receiving_execution",   risk: "reversible",   requiresConfirmation: true,  blockedByHardBlocker: false, blockedByStale: false },
  { actionKey: "cancel_receiving",      label: "입고 취소",        domain: "receiving_execution",   risk: "irreversible", requiresConfirmation: true,  blockedByHardBlocker: false, blockedByStale: true },

  // ── Stock Release ──
  { actionKey: "start_evaluation",      label: "평가 시작",        domain: "stock_release",         risk: "reversible",   requiresConfirmation: false, blockedByHardBlocker: false, blockedByStale: false },
  { actionKey: "release_stock",         label: "전량 릴리즈",       domain: "stock_release",         risk: "irreversible", requiresConfirmation: true,  blockedByHardBlocker: true,  blockedByStale: true },
  { actionKey: "partial_release",       label: "부분 릴리즈",       domain: "stock_release",         risk: "irreversible", requiresConfirmation: true,  blockedByHardBlocker: true,  blockedByStale: true },
  { actionKey: "place_hold",            label: "보류 추가",        domain: "stock_release",         risk: "reversible",   requiresConfirmation: false, blockedByHardBlocker: false, blockedByStale: false },
  { actionKey: "cancel_release",        label: "릴리즈 취소",       domain: "stock_release",         risk: "irreversible", requiresConfirmation: true,  blockedByHardBlocker: false, blockedByStale: true },

  // ── Reorder Decision ──
  { actionKey: "start_reorder_eval",    label: "평가 시작",        domain: "reorder_decision",      risk: "reversible",   requiresConfirmation: false, blockedByHardBlocker: false, blockedByStale: false },
  { actionKey: "set_watch",             label: "모니터링",          domain: "reorder_decision",      risk: "reversible",   requiresConfirmation: false, blockedByHardBlocker: false, blockedByStale: false },
  { actionKey: "recommend_reorder",     label: "재주문 권고",       domain: "reorder_decision",      risk: "reversible",   requiresConfirmation: false, blockedByHardBlocker: false, blockedByStale: false },
  { actionKey: "require_reorder",       label: "재주문 확정",       domain: "reorder_decision",      risk: "irreversible", requiresConfirmation: true,  blockedByHardBlocker: true,  blockedByStale: true },
  { actionKey: "require_expedite",      label: "긴급 발주",        domain: "reorder_decision",      risk: "irreversible", requiresConfirmation: true,  blockedByHardBlocker: true,  blockedByStale: true },
  { actionKey: "mark_no_action",        label: "조치 불필요",       domain: "reorder_decision",      risk: "irreversible", requiresConfirmation: true,  blockedByHardBlocker: true,  blockedByStale: true },
  { actionKey: "procurement_reentry",   label: "구매 재진입",       domain: "reorder_decision",      risk: "irreversible", requiresConfirmation: true,  blockedByHardBlocker: true,  blockedByStale: true },
  { actionKey: "cancel_reorder",        label: "재주문 취소",       domain: "reorder_decision",      risk: "irreversible", requiresConfirmation: true,  blockedByHardBlocker: false, blockedByStale: true },
] as const;

// ══════════════════════════════════════════════════════
// 7. Lookup Utilities — grammar에서 검색
// ══════════════════════════════════════════════════════

export function getStageGrammar(stage: QuoteChainStage): StageGrammar | undefined {
  return CHAIN_STAGE_GRAMMAR.find(s => s.stage === stage);
}

export function getStatusGrammar(domain: GovernanceDomain, status: string): StatusGrammar | undefined {
  return STATUS_GRAMMAR.find(s => s.domain === domain && s.status === status);
}

export function getStatusLabel(domain: GovernanceDomain, status: string): string {
  return getStatusGrammar(domain, status)?.label ?? status;
}

export function getStageLabel(stage: QuoteChainStage, short: boolean = false): string {
  const grammar = getStageGrammar(stage);
  if (!grammar) return stage;
  return short ? grammar.shortLabel : grammar.fullLabel;
}

export function getTerminalStatuses(domain: GovernanceDomain): string[] {
  return STATUS_GRAMMAR.filter(s => s.domain === domain && s.isTerminal).map(s => s.status);
}

export function isTerminalStatus(domain: GovernanceDomain, status: string): boolean {
  return getTerminalStatuses(domain).includes(status);
}

export function isIrreversibleActionAllowed(domain: GovernanceDomain, status: string): boolean {
  return getStatusGrammar(domain, status)?.allowsIrreversibleAction ?? false;
}

export function getDockActions(domain: GovernanceDomain): readonly DockActionGrammar[] {
  return DOCK_ACTION_GRAMMAR.filter(a => a.domain === domain);
}

export function getIrreversibleActions(domain: GovernanceDomain): readonly DockActionGrammar[] {
  return DOCK_ACTION_GRAMMAR.filter(a => a.domain === domain && a.risk === "irreversible");
}

export function getPanelGrammar(panelId: string): PanelGrammar | undefined {
  return PANEL_GRAMMAR.find(p => p.panelId === panelId);
}

export function getPanelLabel(panelId: string): string {
  return getPanelGrammar(panelId)?.label ?? panelId;
}

/**
 * Visibility-filtered stage list.
 * UI strip은 이 함수로 display gating — label 존재와 노출 여부 분리.
 * "ga"면 항상 보이고, "pilot"이면 pilot 모드에서만, "hidden"이면 안 보임.
 */
export function getVisibleStages(mode: "ga" | "pilot"): readonly StageGrammar[] {
  if (mode === "pilot") {
    return CHAIN_STAGE_GRAMMAR.filter(s => s.visibility !== "hidden");
  }
  return CHAIN_STAGE_GRAMMAR.filter(s => s.visibility === "ga");
}

// ══════════════════════════════════════════════════════
// 8. Validation — grammar 무결성 검증
// ══════════════════════════════════════════════════════

export interface GrammarValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    stageCount: number;
    statusCount: number;
    panelCount: number;
    actionCount: number;
    terminalStatusCount: number;
    irreversibleActionCount: number;
  };
}

/**
 * 전체 grammar registry의 무결성을 검증.
 * 중복, 누락, 불일치를 발견.
 */
export function validateGrammarRegistry(): GrammarValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Stage order uniqueness
  const stageOrders = CHAIN_STAGE_GRAMMAR.map(s => s.order);
  const uniqueOrders = new Set(stageOrders);
  if (uniqueOrders.size !== stageOrders.length) {
    errors.push("stage order에 중복이 있습니다");
  }

  // 2. Stage name uniqueness
  const stageNames = CHAIN_STAGE_GRAMMAR.map(s => s.stage);
  if (new Set(stageNames).size !== stageNames.length) {
    errors.push("stage name에 중복이 있습니다");
  }

  // 3. Every domain has at least one terminal status
  const domains: GovernanceDomain[] = [
    "dispatch_prep", "dispatch_execution", "supplier_confirmation",
    "receiving_prep", "receiving_execution", "stock_release", "reorder_decision",
  ];
  for (const domain of domains) {
    const terminals = getTerminalStatuses(domain);
    if (terminals.length === 0) {
      errors.push(`${domain}에 terminal status가 없습니다`);
    }
    // Every domain should have "cancelled" as terminal
    if (!terminals.includes("cancelled")) {
      warnings.push(`${domain}에 "cancelled" terminal이 없습니다`);
    }
  }

  // 4. Every irreversible action should be blocked by hard blocker or stale
  for (const action of DOCK_ACTION_GRAMMAR) {
    if (action.risk === "irreversible") {
      if (!action.blockedByStale) {
        warnings.push(`irreversible action "${action.actionKey}" (${action.domain})이 stale에 의해 차단되지 않습니다`);
      }
    }
  }

  // 5. Panel IDs uniqueness
  const panelIds = PANEL_GRAMMAR.map(p => p.panelId);
  if (new Set(panelIds).size !== panelIds.length) {
    errors.push("panel ID에 중복이 있습니다");
  }

  // 6. Status label uniqueness within domain
  for (const domain of domains) {
    const labels = STATUS_GRAMMAR.filter(s => s.domain === domain).map(s => s.label);
    const uniqueLabels = new Set(labels);
    if (uniqueLabels.size !== labels.length) {
      warnings.push(`${domain} 내 status label에 중복이 있습니다`);
    }
  }

  // 7. Short label length check
  for (const stage of CHAIN_STAGE_GRAMMAR) {
    if (stage.shortLabel.length > 5) {
      warnings.push(`stage "${stage.stage}" shortLabel이 5자 초과: "${stage.shortLabel}"`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      stageCount: CHAIN_STAGE_GRAMMAR.length,
      statusCount: STATUS_GRAMMAR.length,
      panelCount: PANEL_GRAMMAR.length,
      actionCount: DOCK_ACTION_GRAMMAR.length,
      terminalStatusCount: STATUS_GRAMMAR.filter(s => s.isTerminal).length,
      irreversibleActionCount: DOCK_ACTION_GRAMMAR.filter(a => a.risk === "irreversible").length,
    },
  };
}

// ══════════════════════════════════════════════════════
// 9. Pilot Lifecycle Grammar — launch/graduation 운영 라벨
// ══════════════════════════════════════════════════════

/**
 * Pilot lifecycle은 procurement chain (8 domain)과 별개의 운영 레이어.
 * launch / graduation / restart 전용 라벨을 여기서 관리.
 * 엔진/workbench에서 이 라벨을 직접 참조 — 하드코딩 금지.
 */

// ── 9-1. Launch Dock Actions ──
export interface LifecycleActionGrammar {
  actionKey: string;
  label: string;
  lifecycle: "launch" | "graduation";
  risk: ActionRisk;
  requiresConfirmation: boolean;
}

export const LIFECYCLE_ACTION_GRAMMAR: readonly LifecycleActionGrammar[] = [
  // Launch
  { actionKey: "launch_pilot",      label: "파일럿 시작",          lifecycle: "launch",     risk: "irreversible", requiresConfirmation: true },
  { actionKey: "conduct_drill",     label: "롤백 리허설 실행",     lifecycle: "launch",     risk: "reversible",   requiresConfirmation: true },
  { actionKey: "modify_scope",      label: "범위 수정 (새 RC0)",   lifecycle: "launch",     risk: "reversible",   requiresConfirmation: true },
  { actionKey: "export_launch_pack", label: "런치 팩 내보내기",    lifecycle: "launch",     risk: "navigation",   requiresConfirmation: false },
  { actionKey: "cancel_rc0",        label: "RC0 취소",             lifecycle: "launch",     risk: "irreversible", requiresConfirmation: true },
  // Graduation
  { actionKey: "mark_completed",    label: "파일럿 완료 확정",     lifecycle: "graduation", risk: "irreversible", requiresConfirmation: true },
  { actionKey: "expand_pilot",      label: "파일럿 확장",          lifecycle: "graduation", risk: "irreversible", requiresConfirmation: true },
  { actionKey: "approve_ga",        label: "GA 승인",              lifecycle: "graduation", risk: "irreversible", requiresConfirmation: true },
  { actionKey: "rollback_and_reassess", label: "롤백 및 재평가",   lifecycle: "graduation", risk: "irreversible", requiresConfirmation: true },
  { actionKey: "cancel_pilot",      label: "파일럿 취소",          lifecycle: "graduation", risk: "irreversible", requiresConfirmation: true },
  { actionKey: "export_graduation_pack", label: "졸업 팩 내보내기", lifecycle: "graduation", risk: "navigation",   requiresConfirmation: false },
] as const;

// ── 9-2. Completion Verdict Labels ──
export type PilotCompletionVerdictKey =
  | "completed_successfully"
  | "completed_conditionally"
  | "rollback_required"
  | "cancelled"
  | "insufficient_evidence";

export interface VerdictLabelGrammar {
  verdict: PilotCompletionVerdictKey;
  label: string;
  badgeColor: "green" | "amber" | "red" | "gray" | "blue";
}

export const VERDICT_LABEL_GRAMMAR: readonly VerdictLabelGrammar[] = [
  { verdict: "completed_successfully",  label: "성공적 완료",    badgeColor: "green" },
  { verdict: "completed_conditionally", label: "조건부 완료",    badgeColor: "amber" },
  { verdict: "rollback_required",       label: "롤백 필요",      badgeColor: "red" },
  { verdict: "cancelled",              label: "취소됨",          badgeColor: "gray" },
  { verdict: "insufficient_evidence",   label: "Evidence 부족",  badgeColor: "blue" },
] as const;

// ── 9-3. Graduation Path Labels ──
export type GraduationPathKey =
  | "remain_internal_only"
  | "expand_pilot"
  | "ready_for_ga"
  | "rollback_and_reassess";

export interface GraduationPathGrammar {
  path: GraduationPathKey;
  label: string;
  badgeColor: "gray" | "blue" | "green" | "red";
}

export const GRADUATION_PATH_GRAMMAR: readonly GraduationPathGrammar[] = [
  { path: "remain_internal_only",  label: "내부 유지",       badgeColor: "gray" },
  { path: "expand_pilot",          label: "파일럿 확장",     badgeColor: "blue" },
  { path: "ready_for_ga",          label: "GA 준비 완료",    badgeColor: "green" },
  { path: "rollback_and_reassess", label: "롤백 및 재평가",  badgeColor: "red" },
] as const;

// ── 9-4. Lifecycle Lookup Utilities ──

export function getLifecycleActionLabel(actionKey: string): string {
  return LIFECYCLE_ACTION_GRAMMAR.find(a => a.actionKey === actionKey)?.label ?? actionKey;
}

export function getVerdictLabel(verdict: PilotCompletionVerdictKey): string {
  return VERDICT_LABEL_GRAMMAR.find(v => v.verdict === verdict)?.label ?? verdict;
}

export function getGraduationPathLabel(path: GraduationPathKey): string {
  return GRADUATION_PATH_GRAMMAR.find(p => p.path === path)?.label ?? path;
}

export function getLifecycleActions(lifecycle: "launch" | "graduation"): readonly LifecycleActionGrammar[] {
  return LIFECYCLE_ACTION_GRAMMAR.filter(a => a.lifecycle === lifecycle);
}
