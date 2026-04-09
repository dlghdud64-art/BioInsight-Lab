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
  // canonical: poId → 최신 outbound record (latest only — history 는 후속 배치)
  recordsByPoId: Record<string, DispatchOutboundRecord>;

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

  /** 테스트/리셋용 — production 에서는 호출하지 말 것 */
  reset: () => void;
}

function nextId(poId: string): string {
  return `dispatch_outbound_${poId}_${Date.now().toString(36)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export const useDispatchOutboundStore = create<DispatchOutboundStoreState>((set, get) => ({
  recordsByPoId: {},

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
    set((s) => ({ recordsByPoId: { ...s.recordsByPoId, [poId]: record } }));
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
    set((s) => ({ recordsByPoId: { ...s.recordsByPoId, [poId]: record } }));
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
    set((s) => ({ recordsByPoId: { ...s.recordsByPoId, [poId]: record } }));
    return record;
  },

  getOutboundRecord: (poId) => get().recordsByPoId[poId],

  reset: () => set({ recordsByPoId: {} }),
}));
