/**
 * Vendor Response Inbox — 공급사 포털 제출 → 내부 canonical response 연결
 *
 * 역할:
 * - governance event bus의 `vendor_quote_submitted` 이벤트를 구독
 * - payload를 `SupplierQuoteResponse` canonical shape으로 변환해 inbox에 기록
 * - quote-workqueue/approval 등 내부 surface가 본 inbox를 구독해 업데이트
 *
 * Mutation boundary:
 * - 본 모듈은 event → canonical response record만 담당한다.
 * - ProcurementCase stage 전이(예: awaiting_responses → quotes_ready_for_review)는
 *   recomputeProcurementSummary / recomputeQuoteStatus 계열에서 별도 처리한다.
 * - 본 모듈 자체는 canonical ProcurementCase를 절대 변경하지 않는다.
 */

import { create } from "zustand";
import {
  getGlobalGovernanceEventBus,
  type GovernanceEvent,
} from "@/lib/ai/governance-event-bus";
import type { SupplierQuoteResponse } from "./procurement-case";

// ── Types ────────────────────────────────────────────────────────────

/** payload shape that vendor-portal-events emits */
interface VendorSubmitPayload {
  vendorName?: string;
  quotedTotal?: number;
  leadTimeDays?: number;
  notes?: string;
}

// ── Event → SupplierQuoteResponse mapper ─────────────────────────────

/**
 * vendor_quote_submitted 이벤트를 SupplierQuoteResponse canonical shape으로 변환.
 * payload 누락 시에도 파괴적 실패하지 않고 null-safe로 기록한다.
 */
export function mapVendorSubmitEventToResponse(
  event: GovernanceEvent,
): SupplierQuoteResponse {
  const payload = (event.payload ?? {}) as VendorSubmitPayload;
  // actor 형식: "vendor:{vendorId}"
  const supplierId = event.actor.startsWith("vendor:")
    ? event.actor.slice("vendor:".length)
    : event.actor;
  const supplierName = payload.vendorName ?? supplierId;

  return {
    procurementCaseId: event.caseId,
    supplierId,
    supplierName,
    responseStatus: "received",
    quotedTotal: typeof payload.quotedTotal === "number" ? payload.quotedTotal : null,
    // 포털 이벤트 payload에는 항목별 단가가 없어 빈 배열로 시작 — 이후 inbox에서
    // 보강 가능. Mutation boundary 유지 위해 이벤트 데이터만 사용.
    quotedUnitPrices: [],
    leadTimeDays: typeof payload.leadTimeDays === "number" ? payload.leadTimeDays : null,
    substituteOffered: null,
    termsNotes: typeof payload.notes === "string" ? payload.notes : null,
    attachments: [],
    receivedAt: event.timestamp,
  };
}

// ── Store ────────────────────────────────────────────────────────────

interface VendorResponseInboxState {
  /** 수신된 canonical response 목록 (최신 → 과거) */
  responses: SupplierQuoteResponse[];
  /** bus 구독 상태 */
  subscriptionId: string | null;

  // ── Actions ──
  /** 전역 bus 구독 시작. 이미 구독 중이면 no-op */
  start: () => void;
  /** 구독 해제 */
  stop: () => void;
  /** 테스트용 리셋 */
  reset: () => void;

  // ── Selectors ──
  getByCaseId: (procurementCaseId: string) => SupplierQuoteResponse[];
  getBySupplierId: (supplierId: string) => SupplierQuoteResponse[];
  latestForPair: (procurementCaseId: string, supplierId: string) => SupplierQuoteResponse | null;
}

export const useVendorResponseInbox = create<VendorResponseInboxState>((set, get) => ({
  responses: [],
  subscriptionId: null,

  start: () => {
    if (get().subscriptionId) return; // 중복 구독 방지

    const bus = getGlobalGovernanceEventBus();
    const subId = bus.subscribe({
      domains: ["quote_chain"],
      chainStages: [],
      caseId: null,
      poNumber: null,
      severities: [],
      handler: (event) => {
        if (event.eventType !== "vendor_quote_submitted") return;

        const record = mapVendorSubmitEventToResponse(event);

        set((state) => {
          // 동일 (case, supplier) pair의 기존 record는 최신으로 대체
          const filtered = state.responses.filter(
            (r) =>
              !(
                r.procurementCaseId === record.procurementCaseId &&
                r.supplierId === record.supplierId
              ),
          );
          return { responses: [record, ...filtered] };
        });
      },
    });

    set({ subscriptionId: subId });
  },

  stop: () => {
    const subId = get().subscriptionId;
    if (!subId) return;
    const bus = getGlobalGovernanceEventBus();
    bus.unsubscribe(subId);
    set({ subscriptionId: null });
  },

  reset: () => {
    const subId = get().subscriptionId;
    if (subId) {
      const bus = getGlobalGovernanceEventBus();
      bus.unsubscribe(subId);
    }
    set({ responses: [], subscriptionId: null });
  },

  getByCaseId: (procurementCaseId) =>
    get().responses.filter((r) => r.procurementCaseId === procurementCaseId),

  getBySupplierId: (supplierId) =>
    get().responses.filter((r) => r.supplierId === supplierId),

  latestForPair: (procurementCaseId, supplierId) => {
    const matches = get().responses.filter(
      (r) => r.procurementCaseId === procurementCaseId && r.supplierId === supplierId,
    );
    if (matches.length === 0) return null;
    // sorted desc by receivedAt
    return [...matches].sort((a, b) => {
      const ta = a.receivedAt ? new Date(a.receivedAt).getTime() : 0;
      const tb = b.receivedAt ? new Date(b.receivedAt).getTime() : 0;
      return tb - ta;
    })[0]!;
  },
}));

// ── Auto-start on module load (client only) ──────────────────────────
//
// 클라이언트 런타임에서 모듈이 처음 import되는 시점에 inbox를 start 한다.
// SSR에서는 event bus 상태가 request 간 공유되면 안되므로 guard한다.
if (typeof window !== "undefined") {
  // microtask로 지연 — store 초기화 완료 보장
  queueMicrotask(() => {
    useVendorResponseInbox.getState().start();
  });
}
