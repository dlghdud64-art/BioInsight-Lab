/**
 * Dispatch Outbound Store — outbound execution state (POCreatedRecord 와 분리)
 *
 * 본 store 는 created truth 를 절대 변경하지 않는다.
 * 오직 다음 outbound execution lifecycle 만 다룬다:
 *
 *   - schedule send 등록 (scheduledFor)
 *   - schedule cancel
 *   - dispatch prep cancel (전체 발송 준비 폐기 의사)
 *
 * 실제 발송(immediate send)은 기존 ops-store.issuePO 가 담당한다.
 * 본 store 는 schedule/cancel intent 만 보관하며,
 * 후속 배치에서 backend job runner 와 연결될 hook point 다.
 */

import { create } from "zustand";
import { persistOutboundHistory } from "@/lib/ai/outbound-history-persistence";
import {
  persistOutboundHistoryWithServer,
  hydrateOutboundHistoryWithServer,
} from "@/lib/persistence/outbound-history-client";

// ══════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════

export type DispatchOutboundStatus =
  | "scheduled"
  | "schedule_cancelled"
  | "prep_cancelled";

export interface DispatchOutboundRecord {
  id: string;
  poId: string;
  status: DispatchOutboundStatus;
  /** 예약 발송 일시 (status === scheduled 일 때만 의미 있음) */
  scheduledFor: string | null;
  /** 취소 사유 (cancel 계열에서만 사용) */
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
}

// ══════════════════════════════════════════════
// Store
// ══════════════════════════════════════════════

interface DispatchOutboundStoreState {
  // canonical: poId → 최신 outbound record (latest pointer)
  recordsByPoId: Record<string, DispatchOutboundRecord>;

  /**
   * append-only history (poId → [oldest, ..., latest]).
   * - 모든 state-change mutation 직후 새 record 의 immutable snapshot 을 push 한다.
   * - latest pointer (recordsByPoId) 는 그대로 유지되어, 기존 surface 가 회귀 없이 동작한다.
   * - audit / 타임라인 surface 가 본 history 를 read-only 로 소비한다.
   * - canonical truth 는 여전히 latest pointer 이며, history 는 lineage 만 기록한다.
   */
  historyByPoId: Record<string, DispatchOutboundRecord[]>;

  /**
   * 예약 발송 등록.
   * 동일 PO 의 기존 scheduled record 가 있으면 덮어쓰기 (재예약).
   */
  scheduleSend: (poId: string, scheduledFor: string) => DispatchOutboundRecord;

  /**
   * 예약 취소. 기존 scheduled record 가 없으면 no-op.
   * cancel 후에도 record 자체는 보존 (status 만 변경) — audit linkage 유지.
   */
  cancelSchedule: (poId: string, reason?: string) => DispatchOutboundRecord | null;

  /**
   * dispatch prep 자체를 폐기. send 가 아직 일어나지 않은 경우에만 의미 있음.
   * 기존 record 가 없어도 cancel 의도를 새 record 로 기록한다.
   */
  cancelDispatchPrep: (poId: string, reason?: string) => DispatchOutboundRecord;

  /** 조회 헬퍼 — UI 가 직접 사용 */
  getOutboundRecord: (poId: string) => DispatchOutboundRecord | undefined;

  /**
   * outbound lifecycle 의 시간순 history.
   * - 빈 배열 = 아직 어떤 mutation 도 일어나지 않은 PO
   * - 마지막 element 는 항상 getOutboundRecord(poId) 와 동일한 snapshot 이다.
   */
  getOutboundHistory: (poId: string) => DispatchOutboundRecord[];

  /**
   * B2-g: 주어진 시점(default: now) 기준 due 상태에 도달한 scheduled record 목록.
   * - status === "scheduled" && scheduledFor <= asOf 인 record만 반환
   * - 본 메서드는 read-only — status 전이는 backend job runner 의 책임
   * - 실제 발송은 ops-store.issuePO 와 같은 separate execution layer 가 수행
   */
  getDueScheduledRecords: (asOfIso?: string) => DispatchOutboundRecord[];

  /**
   * B2-g: backend job runner 가 주기적으로 호출할 진입점 (frontend hook contract).
   * - due record를 callback 으로 흘려보내고, callback 결과(success/error)는 caller 책임
   * - store 자체는 status 전이를 하지 않음 (canonical 변경은 execution layer 에서만)
   * - 반환값: 처리 시도된 record 수
   */
  drainDueScheduledRecords: (
    handler: (record: DispatchOutboundRecord) => void | Promise<void>,
    asOfIso?: string,
  ) => Promise<number>;

  /**
   * sessionStorage 에서 persisted history 를 hydrate 한다.
   * in-memory history 가 이미 있으면 no-op (in-memory 우선).
   * PO detail page mount 시 호출한다.
   *
   * @returns true 이면 hydration 발생, false 이면 skip
   */
  hydrateFromPersistence: (poId: string) => boolean;

  /**
   * 서버 → sessionStorage 순서로 persisted history 를 hydrate 한다.
   * in-memory history 가 이미 있으면 no-op.
   * PO detail page mount 시 호출. 비동기.
   *
   * @returns true 이면 hydration 발생, false 이면 skip
   */
  hydrateFromServerPersistence: (poId: string) => Promise<boolean>;

  /** 테스트/리셋용 — production 에서는 호출하지 말 것 */
  reset: () => void;
}

function nextId(poId: string): string {
  return `dispatch_outbound_${poId}_${Date.now().toString(36)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * 내부 helper — latest pointer + history append 를 한 번의 set 으로 묶는다.
 * UI mutation 이 latest 와 history 사이에 race 로 끼지 않도록 동일 트랜잭션에서 갱신한다.
 */
function applyOutboundMutation(
  state: { recordsByPoId: Record<string, DispatchOutboundRecord>; historyByPoId: Record<string, DispatchOutboundRecord[]> },
  record: DispatchOutboundRecord,
) {
  const prevHistory = state.historyByPoId[record.poId] ?? [];
  return {
    recordsByPoId: { ...state.recordsByPoId, [record.poId]: record },
    historyByPoId: { ...state.historyByPoId, [record.poId]: [...prevHistory, record] },
  };
}

export const useDispatchOutboundStore = create<DispatchOutboundStoreState>((set, get) => ({
  recordsByPoId: {},
  historyByPoId: {},

  scheduleSend: (poId, scheduledFor) => {
    const now = nowIso();
    const existing = get().recordsByPoId[poId];
    const record: DispatchOutboundRecord = {
      id: existing?.id ?? nextId(poId),
      poId,
      status: "scheduled",
      scheduledFor,
      cancelReason: null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    set((s) => {
      const next = applyOutboundMutation(s, record);
      persistOutboundHistory(poId, next.historyByPoId[poId] ?? []);
      // fire-and-forget 서버 동기화
      persistOutboundHistoryWithServer(poId, next.historyByPoId[poId] ?? []);
      return next;
    });
    return record;
  },

  cancelSchedule: (poId, reason) => {
    const existing = get().recordsByPoId[poId];
    if (!existing || existing.status !== "scheduled") return null;
    const record: DispatchOutboundRecord = {
      ...existing,
      status: "schedule_cancelled",
      cancelReason: reason ?? null,
      updatedAt: nowIso(),
    };
    set((s) => {
      const next = applyOutboundMutation(s, record);
      persistOutboundHistory(poId, next.historyByPoId[poId] ?? []);
      persistOutboundHistoryWithServer(poId, next.historyByPoId[poId] ?? []);
      return next;
    });
    return record;
  },

  cancelDispatchPrep: (poId, reason) => {
    const now = nowIso();
    const existing = get().recordsByPoId[poId];
    const record: DispatchOutboundRecord = {
      id: existing?.id ?? nextId(poId),
      poId,
      status: "prep_cancelled",
      scheduledFor: null,
      cancelReason: reason ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    set((s) => {
      const next = applyOutboundMutation(s, record);
      persistOutboundHistory(poId, next.historyByPoId[poId] ?? []);
      persistOutboundHistoryWithServer(poId, next.historyByPoId[poId] ?? []);
      return next;
    });
    return record;
  },

  getOutboundRecord: (poId) => get().recordsByPoId[poId],

  getOutboundHistory: (poId) => get().historyByPoId[poId] ?? [],

  getDueScheduledRecords: (asOfIso) => {
    const asOf = asOfIso ?? nowIso();
    return Object.values(get().recordsByPoId).filter(
      (r) => r.status === "scheduled" && r.scheduledFor !== null && r.scheduledFor <= asOf,
    );
  },

  drainDueScheduledRecords: async (handler, asOfIso) => {
    const due = get().getDueScheduledRecords(asOfIso);
    for (const record of due) {
      try {
        await handler(record);
      } catch {
        // caller-side responsibility — store does not transition status
      }
    }
    return due.length;
  },

  hydrateFromPersistence: (poId) => {
    const current = get().historyByPoId[poId] ?? [];
    if (current.length > 0) return false; // in-memory 우선
    // 동기 hydrate 는 sessionStorage fallback 으로 유지
    const { hydrateOutboundHistoryIfEmpty } = require("@/lib/ai/outbound-history-persistence");
    const result = hydrateOutboundHistoryIfEmpty(poId, current);
    if (!result.shouldHydrate) return false;
    set((s) => ({
      recordsByPoId: { ...s.recordsByPoId, [poId]: result.latest },
      historyByPoId: { ...s.historyByPoId, [poId]: result.history },
    }));
    return true;
  },

  hydrateFromServerPersistence: async (poId) => {
    const current = get().historyByPoId[poId] ?? [];
    if (current.length > 0) return false;
    const result = await hydrateOutboundHistoryWithServer(poId, current);
    if (!result.shouldHydrate) return false;
    set((s) => ({
      recordsByPoId: { ...s.recordsByPoId, [poId]: result.latest },
      historyByPoId: { ...s.historyByPoId, [poId]: result.history },
    }));
    return true;
  },

  reset: () => set({ recordsByPoId: {}, historyByPoId: {} }),
}));
