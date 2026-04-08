/**
 * Vendor Portal Event Emission
 *
 * 외부 공급사 포털에서 발생한 이벤트를 governance event bus에 발행한다.
 * Vendor Portal은 quote_chain domain의 인입 surface로 취급하며,
 * 자체 truth를 만들지 않고 ProcurementCase의 quote 응답 stage를 전환하는 신호만 보낸다.
 *
 * 발행 이벤트:
 * - vendor_quote_submitted: 공급사가 단가/납기 입력 후 제출
 * - vendor_quote_acknowledged: 포털에서 RFQ 확인 (optional)
 *
 * 원칙:
 * - canonical truth(ProcurementCase)는 내부 engine만 변경한다.
 * - 본 모듈은 "포털에서 무슨 일이 있었다"를 알리는 역할.
 * - listener가 quote_chain invalidation rule을 통해 내부 surface를 갱신한다.
 */

import {
  getGlobalGovernanceEventBus,
  resetGlobalGovernanceEventBus,
  createGovernanceEvent,
  type GovernanceEvent,
  type GovernanceDomain,
} from "@/lib/ai/governance-event-bus";

// ── Event Types ──────────────────────────────────────────────────────

export type VendorPortalEventType =
  | "vendor_quote_submitted"
  | "vendor_quote_acknowledged";

/** Vendor Portal은 quote_chain domain에 속함 (quote stage 인입 신호) */
const VP_DOMAIN: GovernanceDomain = "quote_chain";

/**
 * 전역 shared bus 사용.
 * 자체 singleton을 두면 listener(예: vendor-response-inbox)가 이벤트를 받지 못한다.
 */
function getEventBus() {
  return getGlobalGovernanceEventBus();
}

/** 테스트용 reset — 전역 bus를 리셋 */
export function resetVendorPortalEventBus(): void {
  resetGlobalGovernanceEventBus();
}

// ── Publish ──────────────────────────────────────────────────────────

interface VendorPortalEventParams {
  procurementCaseId: string;
  vendorId: string;
  vendorName: string;
  eventType: VendorPortalEventType;
  fromStatus: string;
  toStatus: string;
  detail: string;
  payload?: Record<string, unknown>;
}

export function publishVendorPortalEvent(
  params: VendorPortalEventParams,
): GovernanceEvent {
  const bus = getEventBus();

  const event = createGovernanceEvent(VP_DOMAIN, params.eventType, {
    caseId: params.procurementCaseId,
    poNumber: "", // quote 단계 — PO 미발행
    fromStatus: params.fromStatus,
    toStatus: params.toStatus,
    actor: `vendor:${params.vendorId}`,
    detail: params.detail,
    severity: "info",
    affectedObjectIds: [params.procurementCaseId, params.vendorId],
    payload: {
      vendorName: params.vendorName,
      ...(params.payload ?? {}),
    },
  });

  bus.publish(event);
  return event;
}

// ── Convenience emitters ─────────────────────────────────────────────

export function emitVendorQuoteSubmitted(input: {
  procurementCaseId: string;
  vendorId: string;
  vendorName: string;
  quotedTotal: number;
  leadTimeDays: number;
}): GovernanceEvent {
  return publishVendorPortalEvent({
    procurementCaseId: input.procurementCaseId,
    vendorId: input.vendorId,
    vendorName: input.vendorName,
    eventType: "vendor_quote_submitted",
    fromStatus: "request_for_quote",
    toStatus: "quote_received",
    detail: `${input.vendorName} 견적 제출 (총액 ${input.quotedTotal.toLocaleString()}원, 납기 ${input.leadTimeDays}일)`,
    payload: {
      quotedTotal: input.quotedTotal,
      leadTimeDays: input.leadTimeDays,
    },
  });
}

export function emitVendorQuoteAcknowledged(input: {
  procurementCaseId: string;
  vendorId: string;
  vendorName: string;
}): GovernanceEvent {
  return publishVendorPortalEvent({
    procurementCaseId: input.procurementCaseId,
    vendorId: input.vendorId,
    vendorName: input.vendorName,
    eventType: "vendor_quote_acknowledged",
    fromStatus: "request_for_quote",
    toStatus: "request_for_quote",
    detail: `${input.vendorName}이 RFQ를 확인했습니다.`,
  });
}

// ── History query ────────────────────────────────────────────────────

export function getVendorPortalEventHistory(vendorId?: string): GovernanceEvent[] {
  const bus = getEventBus();
  const all = bus.getHistory({ domain: VP_DOMAIN });
  if (!vendorId) return all;
  return all.filter((e) => e.actor === `vendor:${vendorId}`);
}
