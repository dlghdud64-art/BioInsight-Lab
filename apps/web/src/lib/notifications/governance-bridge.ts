/**
 * Governance Event → Notification Store Bridge
 *
 * 책임:
 * - getGlobalGovernanceEventBus()에 단일 subscriber를 등록해
 *   특정 governance event를 client-side notification으로 변환한다.
 *
 * 고정 규칙:
 * 1. 본 bridge는 read-only orchestrator다. governance bus의 canonical event를
 *    in-memory notification store에 mirror할 뿐, source of truth를 흔들지 않는다.
 * 2. 매핑은 명시적 화이트리스트 방식이다. 모든 event를 자동으로 알림화하지 않는다.
 *    의도하지 않은 알림 폭주를 방지하기 위함이다.
 * 3. dedupeKey는 governance eventId 기반이라 동일 event가 여러 번 dispatch 돼도 한 번만 toast.
 * 4. AI/auto-action 트리거 금지. 본 bridge는 표시만 한다.
 * 5. 본 모듈은 client-only다 (Zustand store import). 서버 컴포넌트에서 import 금지.
 */

"use client";

import {
  getGlobalGovernanceEventBus,
  type GovernanceEvent,
  type GovernanceEventSeverity,
} from "@/lib/ai/governance-event-bus";
import { useNotificationStore, type NotificationSeverity, type NotificationSource } from "@/lib/store/notification-store";
import { clearDedupeForPoWithServer } from "@/lib/persistence/governance-event-dedupe-client";
import { clearApprovalSnapshotWithServer } from "@/lib/persistence/approval-baseline-client";
import { clearOutboundHistoryWithServer } from "@/lib/persistence/outbound-history-client";
import type { NotificationEventType } from "./event-types";

// reopen / invalidation 계열 — 이 이벤트들이 발생하면 해당 PO 의 cross-session
// dedupe 기록을 지워 이후 재계산된 governance event 가 다시 발행될 수 있도록 한다.
// canonical truth 는 흔들지 않고, dedupe layer 만 리셋한다.
const DEDUPE_CLEAR_EVENT_TYPES: ReadonlySet<string> = new Set([
  "po_conversion_reopened",
  "po_conversion_reopened_from_impact",
  "approval_snapshot_invalidated",
  "supplier_profile_changed",
  "policy_hold_changed",
]);

// Fast-Track stale 재평가 트리거 — 이 이벤트들이 발생하면 해당 case 의
// Fast-Track recommendation 을 clear 해 다음 평가 사이클에서 재계산되게 한다.
// recommendation store (Zustand in-memory) 를 직접 import 하면 SSR 이슈가
// 생기므로, handler 에서 dynamic import 방식으로 접근한다.
const FAST_TRACK_STALE_TRIGGER_EVENT_TYPES: ReadonlySet<string> = new Set([
  "supplier_profile_changed",
  "policy_hold_changed",
  "approval_snapshot_invalidated",
]);

// ══════════════════════════════════════════════════════════════════════════════
// 명시적 매핑 — 화이트리스트 방식
// ══════════════════════════════════════════════════════════════════════════════

interface BridgeMapping {
  /** governance event의 eventType과 정확히 일치 */
  matchEventType: string;
  /** notification 정규 이벤트 (없으면 null) */
  notificationEventType: NotificationEventType | null;
  /** Header bell 그룹화용 source */
  source: NotificationSource;
  /** title 빌더 — governance event payload 기반 */
  buildTitle: (event: GovernanceEvent) => string;
  /** description 빌더 (선택) */
  buildDescription?: (event: GovernanceEvent) => string | null;
}

const BRIDGE_MAPPINGS: BridgeMapping[] = [
  // ── Dispatch / approval 흐름 ────────────────────────────────────────────────
  {
    matchEventType: "approval_snapshot_invalidated",
    notificationEventType: "APPROVAL_NEEDED",
    source: "governance",
    buildTitle: (e) => `승인 스냅샷 무효화 — ${e.poNumber || e.caseId}`,
    buildDescription: (e) => e.detail,
  },
  {
    matchEventType: "dispatch_prep_blocked",
    notificationEventType: "APPROVAL_NEEDED",
    source: "governance",
    buildTitle: (e) => `발송 준비 차단 — ${e.poNumber || e.caseId}`,
    buildDescription: (e) => e.detail,
  },
  {
    matchEventType: "dispatch_prep_ready",
    notificationEventType: null,
    source: "governance",
    buildTitle: (e) => `발송 준비 완료 — ${e.poNumber || e.caseId}`,
    buildDescription: (e) => e.detail,
  },
  {
    matchEventType: "po_conversion_completed",
    notificationEventType: "ORDER_PLACED",
    source: "governance",
    buildTitle: (e) => `PO 생성 완료 — ${e.poNumber || e.caseId}`,
    buildDescription: (e) => e.detail,
  },

  // ── 예산 ───────────────────────────────────────────────────────────────────
  {
    matchEventType: "budget_warning_triggered",
    notificationEventType: "BUDGET_WARNING",
    source: "budget",
    buildTitle: (e) => `예산 경고 — ${e.detail}`,
  },

  // ── 공급사 응답 ─────────────────────────────────────────────────────────────
  {
    matchEventType: "vendor_replied",
    notificationEventType: "VENDOR_REPLIED",
    source: "vendor",
    buildTitle: (e) => `공급사 응답 도착 — ${e.poNumber || e.caseId}`,
    buildDescription: (e) => e.detail,
  },

  // ── Fast-Track ─────────────────────────────────────────────────────────────
  {
    matchEventType: "fast_track_eligible",
    notificationEventType: "FAST_TRACK_ELIGIBLE",
    source: "fast_track",
    buildTitle: (e) => `즉시 승인 가능 — ${e.poNumber || e.caseId}`,
    buildDescription: (e) => e.detail,
  },
  {
    matchEventType: "fast_track_stale",
    notificationEventType: null,
    source: "fast_track",
    buildTitle: (e) => `Fast-Track 권장 회수 — ${e.poNumber || e.caseId}`,
    buildDescription: (e) => e.detail,
  },
  {
    matchEventType: "fast_track_not_eligible",
    notificationEventType: null,
    source: "fast_track",
    buildTitle: (e) => `Fast-Track 자격 상실 — ${e.poNumber || e.caseId}`,
    buildDescription: (e) => e.detail,
  },
  {
    matchEventType: "fast_track_dismissed",
    notificationEventType: null,
    source: "fast_track",
    buildTitle: (e) => `Fast-Track 권장 거부됨 — ${e.poNumber || e.caseId}`,
    buildDescription: (e) => e.detail,
  },

  // ── 견적 요청 제출 → 워크큐 (D-3 / D-5 listener 확장) ──────────────────────
  // canonical truth 는 smart-sourcing handoff 에 있고, 이 매핑은 operator 알림 스트림에
  // 동일 이벤트를 surface 해주는 read-only bridge 다.
  {
    matchEventType: "request_submission_executed",
    notificationEventType: null,
    source: "governance",
    buildTitle: (e) => `견적 요청 제출 — ${e.poNumber || e.caseId}`,
    buildDescription: (e) => e.detail,
  },
  {
    matchEventType: "request_submission_handed_off_to_workqueue",
    notificationEventType: null,
    source: "governance",
    buildTitle: (e) => `견적 워크큐로 이관 — ${e.poNumber || e.caseId}`,
    buildDescription: (e) => e.detail,
  },

  // ── PO 본문 사후 변경 (B2-h publish 결선) ───────────────────────────────────
  // dispatch-prep-invalidation.ts → emitPoDataChangedAfterApproval 가 발행한 governance event 를
  // operator 알림 스트림에 surface 한다. severity=warning, dispatch readiness lock 신호.
  {
    matchEventType: "po_data_changed_after_approval",
    notificationEventType: "APPROVAL_NEEDED",
    source: "governance",
    buildTitle: (e) => `승인 후 PO 본문 변경 — ${e.poNumber || e.caseId}`,
    buildDescription: (e) => e.detail,
  },

  // ── Dispatch prep 상태 전이 (잔여 publisher 결선) ───────────────────────────
  // readiness_changed / send_scheduled / cancelled 는 noise 가 큰 internal 전이라
  // notificationEventType 은 null 로 두고 governance ledger 에만 흘린다.
  // 사용자 유도 알림은 dispatch_prep_blocked (위쪽) 가 담당.
  {
    matchEventType: "dispatch_prep_readiness_changed",
    notificationEventType: null,
    source: "governance",
    buildTitle: (e) => `발송 준비 상태 변경 — ${e.poNumber || e.caseId}`,
    buildDescription: (e) => e.detail,
  },
  {
    matchEventType: "dispatch_prep_send_scheduled",
    notificationEventType: null,
    source: "governance",
    buildTitle: (e) => `발송 예약 등록 — ${e.poNumber || e.caseId}`,
    buildDescription: (e) => e.detail,
  },
  {
    matchEventType: "dispatch_prep_cancelled",
    notificationEventType: null,
    source: "governance",
    buildTitle: (e) => `발송 준비 취소 — ${e.poNumber || e.caseId}`,
    buildDescription: (e) => e.detail,
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// Severity 매핑
// ══════════════════════════════════════════════════════════════════════════════

function mapSeverity(g: GovernanceEventSeverity): NotificationSeverity {
  switch (g) {
    case "critical":
      return "error";
    case "warning":
      return "warning";
    case "info":
    default:
      return "info";
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Subscriber lifecycle
// ══════════════════════════════════════════════════════════════════════════════

let activeSubscriptionId: string | null = null;

/**
 * Bridge를 활성화한다. dashboard-shell의 useEffect에서 한 번만 호출되어야 한다.
 *
 * @returns unsubscribe 함수 — useEffect cleanup에서 호출.
 */
export function startGovernanceNotificationBridge(): () => void {
  // 중복 활성화 방지 — Strict mode 이중 mount에도 안전
  if (activeSubscriptionId) {
    const previous = activeSubscriptionId;
    return () => {
      if (activeSubscriptionId === previous) {
        getGlobalGovernanceEventBus().unsubscribe(previous);
        activeSubscriptionId = null;
      }
    };
  }

  const bus = getGlobalGovernanceEventBus();

  const subId = bus.subscribe({
    domains: [],
    chainStages: [],
    caseId: null,
    poNumber: null,
    severities: [],
    handler: (event: GovernanceEvent) => {
      // reopen / invalidation 이벤트에서 PO 의 cross-session dedupe 기록 +
      // approval baseline snapshot 을 함께 제거한다.
      // mapping 여부와 무관하게 먼저 수행한다 (알림 표시 ≠ targeted invalidation).
      // approval snapshot 은 재승인 후 다음 approval 시점에 새 baseline 으로 재확보된다.
      if (DEDUPE_CLEAR_EVENT_TYPES.has(event.eventType)) {
        const poKey = event.poNumber || event.caseId;
        if (poKey) {
          clearDedupeForPoWithServer(poKey);
          clearApprovalSnapshotWithServer(poKey);
          clearOutboundHistoryWithServer(poKey);
        }
      }

      // Fast-Track stale 재평가: supplier/policy/snapshot 변경 시 해당 case 의
      // recommendation 을 store 에서 제거해 다음 bulkEvaluate 에서 재평가되게 한다.
      if (FAST_TRACK_STALE_TRIGGER_EVENT_TYPES.has(event.eventType)) {
        const caseKey = event.caseId;
        if (caseKey) {
          try {
            // Zustand store 는 client-only 이므로 동적으로 접근.
            // governance-bridge 는 "use client" 모듈이라 런타임에는 항상 존재.
            const { useFastTrackStore } = require("@/lib/store/fast-track-store");
            useFastTrackStore.getState().clearRecommendation(caseKey);
          } catch {
            // store import 실패는 무시 — Fast-Track 재평가는 필수 경로가 아님
          }
        }
      }

      const mapping = BRIDGE_MAPPINGS.find((m) => m.matchEventType === event.eventType);
      if (!mapping) return;

      // dedupeKey: governance eventId — 동일 event는 한 번만 push
      const dedupeKey = `gov:${event.eventId}`;

      useNotificationStore.getState().publishLocalNotification({
        title: mapping.buildTitle(event),
        description: mapping.buildDescription ? mapping.buildDescription(event) : null,
        severity: mapSeverity(event.severity),
        source: mapping.source,
        eventType: mapping.notificationEventType,
        entityType: "PO",
        entityId: event.poNumber || event.caseId || null,
        dedupeKey,
        createdAt: event.timestamp,
      });
    },
  });

  activeSubscriptionId = subId;

  return () => {
    if (activeSubscriptionId === subId) {
      bus.unsubscribe(subId);
      activeSubscriptionId = null;
    }
  };
}

/**
 * 테스트/디버그용 — 현재 활성화된 매핑 목록을 반환한다.
 */
export function getBridgeMappings(): readonly BridgeMapping[] {
  return BRIDGE_MAPPINGS;
}
