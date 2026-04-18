/**
 * Notification Store (client-side, in-memory)
 *
 * 책임:
 * - 클라이언트 세션 동안 발생한 알림을 즉시 표시 가능한 형태로 보관
 * - sonner toast / Header bell 둘 다 동일한 source of truth를 구독
 * - DB 영속 알림(notification-query.ts)과 분리. DB는 서버 권위, 본 store는 in-memory mirror
 *
 * 고정 규칙:
 * 1. 본 store는 canonical truth가 아니다. governance event / DB notification에서 파생된
 *    computed view이며, 본 store가 사라져도 DB의 NotificationEvent 레코드는 그대로다.
 * 2. mutation은 publishLocalNotification 단일 진입점만 허용한다 (governance bridge가 호출).
 * 3. 동일 dedupeKey를 가진 알림은 중복 push하지 않는다 (governance event가 재발행돼도 한 번만).
 * 4. 최대 보관 개수를 초과하면 오래된 항목부터 잘라낸다 (메모리 폭주 방지).
 * 5. 본 store는 자동 발송/실행을 하지 않는다. 표시 + 읽음 처리만 담당.
 */

import { create } from "zustand";

import type { NotificationEventType } from "@/lib/notifications/event-types";
import {
  markCriticalEventAcknowledged,
  markCriticalEventsAcknowledged,
} from "@/lib/ontology/fast-track/critical-event-ack-store";

// governance-bridge 가 사용하는 dedupeKey 형식: `gov:${eventId}`
// 사용자가 governance critical 알림을 read 처리하면 fast-track entry guard 의
// pending critical events 집계에서도 제외되도록 ack store 에 전파한다.
const GOVERNANCE_DEDUPE_PREFIX = "gov:";

function extractGovernanceEventId(dedupeKey: string): string | null {
  if (!dedupeKey.startsWith(GOVERNANCE_DEDUPE_PREFIX)) return null;
  const id = dedupeKey.slice(GOVERNANCE_DEDUPE_PREFIX.length);
  return id.length > 0 ? id : null;
}

// ══════════════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════════════

export type NotificationSeverity = "info" | "success" | "warning" | "error";

export interface LocalNotification {
  /** Stable id — 동일 source 이벤트의 재발행을 방지하기 위해 dedupeKey와 같이 쓸 수 있다 */
  id: string;
  /** 노출 메시지 (title) */
  title: string;
  /** 부가 설명 */
  description: string | null;
  /** 사용자 노출 severity (sonner 색상 결정) */
  severity: NotificationSeverity;
  /** 발생 도메인 라벨 (Header bell 그룹화용) */
  source: NotificationSource;
  /** 정규 이벤트 타입 (없으면 governance만 발생한 in-memory 알림) */
  eventType: NotificationEventType | null;
  /** 연결 entity (clickable navigation 용) */
  entityType: string | null;
  entityId: string | null;
  /** 동일 이벤트 중복 방지 키. 동일 키는 한 번만 push된다 */
  dedupeKey: string;
  /** 발생 시각 */
  createdAt: string;
  /** 사용자가 읽었는지 여부 */
  read: boolean;
}

export type NotificationSource =
  | "governance"
  | "fast_track"
  | "budget"
  | "vendor"
  | "system";

export interface PublishLocalNotificationInput {
  title: string;
  description?: string | null;
  severity?: NotificationSeverity;
  source: NotificationSource;
  eventType?: NotificationEventType | null;
  entityType?: string | null;
  entityId?: string | null;
  dedupeKey: string;
  createdAt?: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════════════════════════════

const MAX_NOTIFICATIONS = 50;

// ══════════════════════════════════════════════════════════════════════════════
// Store
// ══════════════════════════════════════════════════════════════════════════════

interface NotificationStoreState {
  notifications: LocalNotification[];
  /** monotonically incrementing version, sonner subscriber가 변화 감지에 사용 */
  version: number;
  /** 마지막으로 push된 알림 id (subscriber가 toast 발사 결정에 사용) */
  lastPublishedId: string | null;

  // ── selectors ──────────────────────────────────────────────
  unreadCount: () => number;
  getById: (id: string) => LocalNotification | undefined;

  // ── mutations (governance bridge 단일 진입점) ──────────────
  publishLocalNotification: (input: PublishLocalNotificationInput) => string | null;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
}

export const useNotificationStore = create<NotificationStoreState>((set, get) => ({
  notifications: [],
  version: 0,
  lastPublishedId: null,

  unreadCount: () => get().notifications.filter((n) => !n.read).length,

  getById: (id) => get().notifications.find((n) => n.id === id),

  publishLocalNotification: (input) => {
    const state = get();

    // dedupe — 같은 dedupeKey가 이미 있으면 push 안 함
    if (state.notifications.some((n) => n.dedupeKey === input.dedupeKey)) {
      return null;
    }

    const notif: LocalNotification = {
      id: `localnotif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: input.title,
      description: input.description ?? null,
      severity: input.severity ?? "info",
      source: input.source,
      eventType: input.eventType ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      dedupeKey: input.dedupeKey,
      createdAt: input.createdAt ?? new Date().toISOString(),
      read: false,
    };

    // prepend + cap
    const next = [notif, ...state.notifications].slice(0, MAX_NOTIFICATIONS);

    set({
      notifications: next,
      version: state.version + 1,
      lastPublishedId: notif.id,
    });

    return notif.id;
  },

  markRead: (id) => {
    const state = get();
    let mutated = false;
    let ackedEventId: string | null = null;
    const next = state.notifications.map((n) => {
      if (n.id === id && !n.read) {
        mutated = true;
        // governance critical 알림이면 fast-track guard 의 ack store 에도 반영
        if (n.source === "governance" && n.severity === "error") {
          ackedEventId = extractGovernanceEventId(n.dedupeKey);
        }
        return { ...n, read: true };
      }
      return n;
    });
    if (!mutated) return;
    if (ackedEventId) markCriticalEventAcknowledged(ackedEventId);
    set({ notifications: next, version: state.version + 1 });
  },

  markAllRead: () => {
    const state = get();
    if (!state.notifications.some((n) => !n.read)) return;
    // bulk ack — governance critical 알림 중 read 안 된 것들의 eventId 수집
    const ackedEventIds: string[] = [];
    for (const n of state.notifications) {
      if (n.read) continue;
      if (n.source === "governance" && n.severity === "error") {
        const eid = extractGovernanceEventId(n.dedupeKey);
        if (eid) ackedEventIds.push(eid);
      }
    }
    if (ackedEventIds.length > 0) markCriticalEventsAcknowledged(ackedEventIds);
    set({
      notifications: state.notifications.map((n) => (n.read ? n : { ...n, read: true })),
      version: state.version + 1,
    });
  },

  clear: () => {
    set({ notifications: [], version: get().version + 1, lastPublishedId: null });
  },
}));
