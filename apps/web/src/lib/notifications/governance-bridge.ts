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
import type { NotificationEventType } from "./event-types";

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
