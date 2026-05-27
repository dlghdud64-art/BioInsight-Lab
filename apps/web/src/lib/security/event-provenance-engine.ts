/**
 * Event Provenance Engine
 *
 * Security Readiness Hardening Batch 0 — Security Batch B
 *
 * governance event bus에 provenance 필드를 강화하고,
 * impossible transition detector를 추가합니다.
 *
 * 설계 원칙:
 * - 이벤트는 "흐름"만이 아니라 "증거"가 되어야 함
 * - impossible transition은 즉시 탐지 + 기록
 * - security-relevant event는 별도 분류
 * - debug raw event key는 사용자-facing UI에 노출 금지
 */

// ═══════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════

/** 강화된 provenance 필드 */
export interface EventProvenance {
  readonly sourceDomain: string;
  readonly sourceSurface: string;
  readonly sourceRoute: string;
  readonly actorUserId: string;
  readonly targetEntityType: string;
  readonly targetEntityId: string;
  readonly correlationId: string;
  readonly securityClassification: EventSecurityClassification;
  readonly provenanceGeneratedAt: string; // ISO
}

export type EventSecurityClassification =
  | 'routine'             // 일반 상태 변경
  | 'governance_action'   // 거버넌스 결정 (approval, conversion)
  | 'irreversible_action' // 되돌릴 수 없는 실행 (send, finalize)
  | 'security_event'      // 보안 관련 (auth failure, replay blocked)
  | 'audit_marker';       // 감사 표시 (compliance snapshot, chain verification)

/** Impossible transition 정의 */
export interface TransitionRule {
  readonly fromStatus: string;
  readonly toStatus: string;
  readonly requiredPrecondition?: string;
  readonly description: string;
}

/** Impossible transition 탐지 결과 */
export interface ImpossibleTransitionResult {
  readonly detected: boolean;
  readonly violations: readonly TransitionViolation[];
  readonly checkedAt: string;
}

export interface TransitionViolation {
  readonly ruleDescription: string;
  readonly fromStatus: string;
  readonly toStatus: string;
  readonly missingPrecondition?: string;
  readonly severity: 'critical' | 'warning';
  readonly governanceMessage: string;
}

// ═══════════════════════════════════════════════════════
// Impossible Transition Rules
// ═══════════════════════════════════════════════════════

/**
 * 불가능한 전환 규칙 — 이 전환이 발생하면 보안 이벤트 기록
 *
 * 규칙: "A 없이 B가 발생하면 안 된다"
 */
const IMPOSSIBLE_TRANSITIONS: readonly TransitionRule[] = [
  // sent 이전에 supplier confirmed 불가
  {
    fromStatus: 'ready_to_send',
    toStatus: 'supplier_confirmed',
    requiredPrecondition: 'sent',
    description: '발송 없이 공급사 확인 발생',
  },
  // approval 없이 conversion finalize 불가
  {
    fromStatus: 'pending_approval',
    toStatus: 'conversion_finalized',
    requiredPrecondition: 'approved',
    description: '승인 없이 전환 확정 발생',
  },
  // invalidated snapshot 상태에서 send success 불가
  {
    fromStatus: 'snapshot_invalidated',
    toStatus: 'sent',
    requiredPrecondition: 'snapshot_revalidated',
    description: '무효화된 스냅샷 상태에서 발송 성공 발생',
  },
  // dispatch_prep 없이 sent 불가 (shortcut 금지)
  {
    fromStatus: 'po_created',
    toStatus: 'sent',
    requiredPrecondition: 'dispatch_prep_completed',
    description: '발송 준비 단계를 거치지 않고 발송 발생',
  },
  // cancelled 상태에서 sent 불가
  {
    fromStatus: 'prep_cancelled',
    toStatus: 'sent',
    requiredPrecondition: 'prep_reopened',
    description: '취소된 준비 상태에서 발송 발생',
  },
  // reopen 없이 re-finalize 불가
  {
    fromStatus: 'conversion_finalized',
    toStatus: 'conversion_finalized',
    requiredPrecondition: 'conversion_reopened',
    description: '재개 없이 중복 확정 발생',
  },
];

// ═══════════════════════════════════════════════════════
// Provenance Store (security events)
// ═══════════════════════════════════════════════════════

interface SecurityEventRecord {
  readonly eventId: string;
  readonly classification: EventSecurityClassification;
  readonly provenance: EventProvenance;
  readonly detail: string;
  readonly recordedAt: string;
}

const SECURITY_EVENTS: SecurityEventRecord[] = [];
const MAX_SECURITY_EVENTS = 2000;
let securityEventCounter = 0;

// ═══════════════════════════════════════════════════════
// Core Functions
// ═══════════════════════════════════════════════════════

let correlationCounter = 0;

/** Correlation ID 생성 — 하나의 사용자 action에서 파생된 모든 이벤트를 연결 */
export function generateCorrelationId(): string {
  correlationCounter += 1;
  return `corr_${Date.now()}_${correlationCounter}`;
}

/** Event provenance 생성 */
export function createEventProvenance(input: {
  sourceDomain: string;
  sourceSurface: string;
  sourceRoute: string;
  actorUserId: string;
  targetEntityType: string;
  targetEntityId: string;
  correlationId: string;
  securityClassification?: EventSecurityClassification;
}): EventProvenance {
  return {
    sourceDomain: input.sourceDomain,
    sourceSurface: input.sourceSurface,
    sourceRoute: input.sourceRoute,
    actorUserId: input.actorUserId,
    targetEntityType: input.targetEntityType,
    targetEntityId: input.targetEntityId,
    correlationId: input.correlationId,
    securityClassification: input.securityClassification ?? 'routine',
    provenanceGeneratedAt: new Date().toISOString(),
  };
}

/**
 * Impossible transition 탐지
 *
 * 현재 상태와 목표 상태 사이에 필수 선행 조건이 충족되었는지 확인.
 * 위반 시 security event로 기록.
 */
export function detectImpossibleTransition(
  fromStatus: string,
  toStatus: string,
  satisfiedPreconditions: readonly string[],
  provenance?: EventProvenance,
): ImpossibleTransitionResult {
  const checkedAt = new Date().toISOString();
  const violations: TransitionViolation[] = [];

  for (const rule of IMPOSSIBLE_TRANSITIONS) {
    // 규칙의 from/to가 현재 전환과 일치하는지
    if (rule.fromStatus === fromStatus && rule.toStatus === toStatus) {
      // 필수 선행 조건이 충족되지 않았으면 위반
      if (rule.requiredPrecondition &&
          !satisfiedPreconditions.includes(rule.requiredPrecondition)) {
        violations.push({
          ruleDescription: rule.description,
          fromStatus,
          toStatus,
          missingPrecondition: rule.requiredPrecondition,
          severity: 'critical',
          governanceMessage: `거버넌스 위반이 탐지되었습니다: ${rule.description}`,
        });
      }
    }
  }

  const result: ImpossibleTransitionResult = {
    detected: violations.length > 0,
    violations,
    checkedAt,
  };

  // 위반 발견 시 security event 기록
  if (result.detected && provenance) {
    recordSecurityEvent(
      'security_event',
      provenance,
      `Impossible transition detected: ${fromStatus} → ${toStatus}. Violations: ${violations.length}`,
    );
  }

  return result;
}

/**
 * Security event 기록 — observability panel용
 */
export function recordSecurityEvent(
  classification: EventSecurityClassification,
  provenance: EventProvenance,
  detail: string,
): SecurityEventRecord {
  securityEventCounter += 1;
  const record: SecurityEventRecord = {
    eventId: `sec_${Date.now()}_${securityEventCounter}`,
    classification,
    provenance,
    detail,
    recordedAt: new Date().toISOString(),
  };

  SECURITY_EVENTS.push(record);

  // Bounded history
  if (SECURITY_EVENTS.length > MAX_SECURITY_EVENTS) {
    SECURITY_EVENTS.splice(0, SECURITY_EVENTS.length - MAX_SECURITY_EVENTS);
  }

  return record;
}

/**
 * Security events 조회 — 필터링
 * debug raw key 노출 없이 human-readable 형태로 제공
 */
export function querySecurityEvents(filter: {
  classification?: EventSecurityClassification;
  actorUserId?: string;
  targetEntityId?: string;
  since?: string;
  limit?: number;
}): readonly SecurityEventRecord[] {
  let results = SECURITY_EVENTS.filter(ev => {
    if (filter.classification && ev.classification !== filter.classification) return false;
    if (filter.actorUserId && ev.provenance.actorUserId !== filter.actorUserId) return false;
    if (filter.targetEntityId && ev.provenance.targetEntityId !== filter.targetEntityId) return false;
    if (filter.since && ev.recordedAt < filter.since) return false;
    return true;
  });

  if (filter.limit) {
    results = results.slice(-filter.limit);
  }

  return results;
}

/**
 * Event classification 판정 — action type에 따라 자동 분류
 */
export function classifyEventSecurity(actionType: string): EventSecurityClassification {
  const IRREVERSIBLE_ACTIONS = new Set([
    'send_now', 'dispatch_send_now', 'po_conversion_finalize',
    'schedule_send', 'dispatch_schedule_send',
  ]);

  const GOVERNANCE_ACTIONS = new Set([
    'approval_decision', 'request_correction', 'po_conversion_reopen',
    'schedule_cancel', 'dispatch_schedule_cancel',
  ]);

  const SECURITY_EVENTS_SET = new Set([
    'auth_failure', 'permission_denied', 'replay_blocked',
    'impossible_transition', 'csrf_invalid', 'stale_snapshot_blocked',
  ]);

  if (IRREVERSIBLE_ACTIONS.has(actionType)) return 'irreversible_action';
  if (GOVERNANCE_ACTIONS.has(actionType)) return 'governance_action';
  if (SECURITY_EVENTS_SET.has(actionType)) return 'security_event';
  return 'routine';
}

// ═══════════════════════════════════════════════════════
// Test Helpers
// ═══════════════════════════════════════════════════════

export function __resetProvenanceState(): void {
  SECURITY_EVENTS.length = 0;
  securityEventCounter = 0;
  correlationCounter = 0;
}

/**
 * Security event summary — rollout 모니터링용
 * CSRF 관련 이벤트 통계를 반환
 */
export function getSecurityEventSummary(): {
  total: number;
  csrfEvents: number;
  byClassification: Record<string, number>;
  recentCsrf: readonly { detail: string; recordedAt: string }[];
} {
  const byClassification: Record<string, number> = {};
  let csrfEvents = 0;
  const recentCsrf: { detail: string; recordedAt: string }[] = [];

  for (const ev of SECURITY_EVENTS) {
    byClassification[ev.classification] = (byClassification[ev.classification] || 0) + 1;
    if (ev.provenance.targetEntityType === 'csrf') {
      csrfEvents++;
    }
  }

  // 최근 CSRF 이벤트 10건
  const csrfRecords = SECURITY_EVENTS
    .filter(ev => ev.provenance.targetEntityType === 'csrf')
    .slice(-10);
  for (const ev of csrfRecords) {
    recentCsrf.push({ detail: ev.detail, recordedAt: ev.recordedAt });
  }

  return {
    total: SECURITY_EVENTS.length,
    csrfEvents,
    byClassification,
    recentCsrf,
  };
}

export { IMPOSSIBLE_TRANSITIONS };
