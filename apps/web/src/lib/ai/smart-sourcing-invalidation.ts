/**
 * Smart Sourcing Invalidation Engine
 *
 * AI 견적 분석 결과의 상태 변경을 governance event bus로 발행하고,
 * 관련 surface의 targeted invalidation을 수행합니다.
 *
 * IMMUTABLE RULES (governance-event-bus.ts):
 * 1. event bus는 truth를 변경하지 않음 — 변경은 engine 함수에서만
 * 2. bus는 "무슨 일이 일어났다"를 전파하고, listener가 재계산을 trigger
 * 3. broad global refresh 금지 — targeted invalidation만 허용
 * 4. event는 불변 — 발행 후 수정 불가
 *
 * Smart Sourcing 이벤트:
 * - quote_comparison_completed: 다중 견적 비교 완료
 * - vendor_selected: 공급사 선정됨
 * - comparison_handed_off: 견적 요청으로 전달됨
 * - bom_parsed: BOM 텍스트 파싱 완료
 * - bom_items_confirmed: BOM 품목 확인 완료
 * - bom_registered_to_queue: BOM 품목 발주 대기열 등록
 * - context_stale_detected: 입력 변경 → 결과 stale
 * - smart_sourcing_reset: 전체 리셋
 */

import type { GovernanceEvent, GovernanceDomain } from "./governance-event-bus";
import {
  createGovernanceEvent,
  getGlobalGovernanceEventBus,
  resetGlobalGovernanceEventBus,
} from "./governance-event-bus";

// ══════════════════════════════════════════════════════════════════════════════
// Smart Sourcing Event Types
// ══════════════════════════════════════════════════════════════════════════════

export type SmartSourcingEventType =
  | "quote_comparison_completed"
  | "vendor_selected"
  | "comparison_handed_off"
  | "bom_parsed"
  | "bom_items_confirmed"
  | "bom_registered_to_queue"
  | "context_stale_detected"
  | "smart_sourcing_reset";

/** Smart Sourcing은 quote_chain domain에 속함 */
const SS_DOMAIN: GovernanceDomain = "quote_chain";

// ══════════════════════════════════════════════════════════════════════════════
// Event Bus 인스턴스 — process-wide global singleton 사용
// ══════════════════════════════════════════════════════════════════════════════
//
// NOTE: 이전에는 이 모듈이 자체 `let _eventBus` 싱글톤을 들고 있었으나,
// 그 경우 vendor portal / vendor-response-inbox / 기타 listener가 다른 인스턴스를
// 구독하게 되어 cross-module 이벤트가 조용히 사라지는 문제가 있었음.
// 이제 quote_chain domain을 공유하는 모든 publisher / listener가
// 동일한 process-wide bus를 사용하도록 global helper로 위임한다.

function getEventBus() {
  return getGlobalGovernanceEventBus();
}

/** 테스트용: bus 리셋 (global bus clear + 재생성) */
export function resetSmartSourcingEventBus(): void {
  resetGlobalGovernanceEventBus();
}

// ══════════════════════════════════════════════════════════════════════════════
// Event 발행 함수
// ══════════════════════════════════════════════════════════════════════════════

interface SmartSourcingEventParams {
  handoffId: string;
  eventType: SmartSourcingEventType;
  fromStatus: string;
  toStatus: string;
  detail: string;
  /** 영향 받는 object ID들 (targeted invalidation 대상) */
  affectedIds?: string[];
  /** 추가 payload */
  payload?: Record<string, unknown>;
}

export function publishSmartSourcingEvent(params: SmartSourcingEventParams): GovernanceEvent {
  const bus = getEventBus();

  const event = createGovernanceEvent(SS_DOMAIN, params.eventType, {
    caseId: params.handoffId,
    poNumber: "", // smart sourcing은 PO 전 단계
    fromStatus: params.fromStatus,
    toStatus: params.toStatus,
    actor: "smart_sourcing_ui",
    detail: params.detail,
    severity: params.eventType === "context_stale_detected" ? "warning" : "info",
    chainStage: null,
    affectedObjectIds: params.affectedIds ?? [params.handoffId],
    payload: {
      source: "smart_sourcing",
      ...params.payload,
    },
  });

  bus.publish(event);
  return event;
}

// ══════════════════════════════════════════════════════════════════════════════
// 편의 함수: 주요 상태 전이 이벤트
// ══════════════════════════════════════════════════════════════════════════════

/** 다중 견적 비교 완료 */
export function emitComparisonCompleted(handoffId: string, vendorCount: number): GovernanceEvent {
  return publishSmartSourcingEvent({
    handoffId,
    eventType: "quote_comparison_completed",
    fromStatus: "idle",
    toStatus: "comparison_complete",
    detail: `${vendorCount}개 공급사 견적 비교 완료`,
    payload: { vendorCount },
  });
}

/** 공급사 선정 */
export function emitVendorSelected(handoffId: string, vendorName: string): GovernanceEvent {
  return publishSmartSourcingEvent({
    handoffId,
    eventType: "vendor_selected",
    fromStatus: "comparison_complete",
    toStatus: "vendor_selected",
    detail: `${vendorName} 공급사 선정됨`,
    payload: { vendorName },
  });
}

/** 견적 요청으로 전달 */
export function emitComparisonHandedOff(handoffId: string, vendorName: string): GovernanceEvent {
  return publishSmartSourcingEvent({
    handoffId,
    eventType: "comparison_handed_off",
    fromStatus: "vendor_selected",
    toStatus: "handed_off_to_request",
    detail: `${vendorName} 공급사로 견적 요청 전달`,
    payload: { vendorName },
  });
}

/** BOM 파싱 완료 */
export function emitBomParsed(handoffId: string, itemCount: number): GovernanceEvent {
  return publishSmartSourcingEvent({
    handoffId,
    eventType: "bom_parsed",
    fromStatus: "idle",
    toStatus: "parsed",
    detail: `${itemCount}개 품목 파싱 완료`,
    payload: { itemCount },
  });
}

/** BOM 품목 확인 */
export function emitBomItemsConfirmed(handoffId: string, selectedCount: number): GovernanceEvent {
  return publishSmartSourcingEvent({
    handoffId,
    eventType: "bom_items_confirmed",
    fromStatus: "parsed",
    toStatus: "items_confirmed",
    detail: `${selectedCount}개 품목 확인됨`,
    payload: { selectedCount },
  });
}

/** BOM 발주 대기열 등록 */
export function emitBomRegisteredToQueue(handoffId: string, registeredCount: number): GovernanceEvent {
  return publishSmartSourcingEvent({
    handoffId,
    eventType: "bom_registered_to_queue",
    fromStatus: "items_confirmed",
    toStatus: "registered_to_queue",
    detail: `${registeredCount}개 품목 발주 대기열 등록`,
    payload: { registeredCount },
  });
}

/** 결과 stale 감지 */
export function emitContextStaleDetected(handoffId: string, source: "multi_vendor" | "bom_parse"): GovernanceEvent {
  return publishSmartSourcingEvent({
    handoffId,
    eventType: "context_stale_detected",
    fromStatus: "result_valid",
    toStatus: "result_stale",
    detail: `${source === "multi_vendor" ? "견적 비교" : "BOM 파싱"} 입력이 변경되어 결과가 stale 상태`,
    payload: { source },
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 구독 헬퍼
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Smart Sourcing 이벤트 구독
 *
 * 사용 예:
 * ```ts
 * const unsub = subscribeSmartSourcingEvents((event) => {
 *   if (event.eventType === "comparison_handed_off") {
 *     // 견적 요청 queue에 반영
 *   }
 * });
 * // cleanup
 * unsub();
 * ```
 */
export function subscribeSmartSourcingEvents(
  handler: (event: GovernanceEvent) => void,
  options?: {
    eventTypes?: SmartSourcingEventType[];
    handoffId?: string;
  },
): () => void {
  const bus = getEventBus();

  const subId = bus.subscribe({
    domains: [SS_DOMAIN],
    chainStages: [],
    caseId: options?.handoffId ?? null,
    poNumber: null,
    severities: [],
    handler: (event) => {
      // event type 필터
      if (
        options?.eventTypes &&
        options.eventTypes.length > 0 &&
        !options.eventTypes.includes(event.eventType as SmartSourcingEventType)
      ) {
        return;
      }
      handler(event);
    },
  });

  return () => bus.unsubscribe(subId);
}

/** 이벤트 히스토리 조회 */
export function getSmartSourcingEventHistory(options?: {
  handoffId?: string;
  limit?: number;
  since?: string;
}): GovernanceEvent[] {
  const bus = getEventBus();
  return bus.getHistory({
    domain: SS_DOMAIN,
    caseId: options?.handoffId,
    limit: options?.limit ?? 50,
    since: options?.since,
  });
}
