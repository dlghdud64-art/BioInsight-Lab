/**
 * Enterprise Event Bus Contracts — 표준 이벤트 스키마
 *
 * Point-to-Point API 결합을 끊어내고 이벤트 기반 비동기 통신을 구현합니다.
 * 모든 이벤트에 Tenant ID, Payload Version, Correlation ID가 필수입니다.
 */

// ── Event Types ──

export type EventDomain = "DOCUMENT" | "BUDGET" | "INCIDENT" | "INVENTORY" | "PROCUREMENT" | "IDENTITY" | "POLICY" | "WORKFLOW";

export type EventAction =
  // Document
  | "document.ingested"
  | "document.verified"
  | "document.verification_failed"
  | "document.review_required"
  // Budget
  | "budget.breached"
  | "budget.warning"
  | "budget.approved"
  // Incident
  | "incident.opened"
  | "incident.escalated"
  | "incident.resolved"
  // Inventory
  | "inventory.discrepancy_detected"
  | "inventory.lot_expiring"
  | "inventory.reorder_triggered"
  // Procurement
  | "procurement.order_matched"
  | "procurement.order_mismatch"
  | "procurement.vendor_mapped"
  // Identity
  | "identity.role_synced"
  | "identity.access_revoked"
  // Policy
  | "policy.updated"
  | "policy.rollback"
  // Workflow
  | "workflow.step_completed"
  | "workflow.step_failed"
  | "workflow.timeout";

// ── Event Schema ──

export interface EnterpriseEvent<T = unknown> {
  eventId: string;
  eventAction: EventAction;
  eventDomain: EventDomain;
  version: string;           // payload schema version e.g. "1.0"
  tenantId: string;           // org ID
  correlationId: string;      // traces full workflow
  causationId: string | null;  // event that caused this
  source: string;              // originating system
  timestamp: string;           // ISO 8601
  payload: T;
  metadata: {
    retryCount: number;
    maxRetries: number;
    deadLetterEligible: boolean;
  };
}

// ── Typed Payloads ──

export interface DocumentVerifiedPayload {
  documentId: string;
  documentType: string;
  verificationResult: string;
  confidence: number;
  processingPath: string;
  autoVerified: boolean;
}

export interface BudgetBreachedPayload {
  budgetId: string;
  currentSpend: number;
  budgetLimit: number;
  currency: string;
  breachPercent: number;
}

export interface IncidentOpenedPayload {
  incidentId: string;
  severity: string;
  documentType: string;
  description: string;
  assignee: string | null;
}

export interface InventoryDiscrepancyPayload {
  productId: string;
  lotNumber: string;
  platformQuantity: number;
  wmsQuantity: number;
  discrepancyType: "QUANTITY_MISMATCH" | "EXPIRY_MISMATCH" | "LOT_NOT_FOUND";
}

export interface ProcurementOrderMatchedPayload {
  documentId: string;
  purchaseOrderId: string;
  vendorId: string;
  matchConfidence: number;
  lineItems: { productId: string; quantity: number; unitPrice: number }[];
}

// ── Event Bus (In-memory, production: Kafka/SQS/EventBridge) ──

type EventHandler = (event: EnterpriseEvent) => Promise<void>;
const handlers: Map<EventAction, EventHandler[]> = new Map();
const deadLetterQueue: EnterpriseEvent[] = [];
const eventLog: EnterpriseEvent[] = [];

/**
 * 이벤트 핸들러 등록
 */
export function subscribe(action: EventAction, handler: EventHandler): void {
  const existing = handlers.get(action) ?? [];
  existing.push(handler);
  handlers.set(action, existing);
}

/**
 * 이벤트 발행
 */
export async function publish(event: EnterpriseEvent): Promise<{ delivered: boolean; deadLettered: boolean }> {
  eventLog.push(event);
  const eventHandlers = handlers.get(event.eventAction) ?? [];

  if (eventHandlers.length === 0) {
    return { delivered: true, deadLettered: false };
  }

  for (const handler of eventHandlers) {
    try {
      await handler(event);
    } catch (err) {
      event.metadata.retryCount++;
      if (event.metadata.retryCount >= event.metadata.maxRetries) {
        if (event.metadata.deadLetterEligible) {
          deadLetterQueue.push(event);
          return { delivered: false, deadLettered: true };
        }
      }
      console.warn(`[EventBus] Handler failed for ${event.eventAction}:`, err);
      return { delivered: false, deadLettered: false };
    }
  }

  return { delivered: true, deadLettered: false };
}

/**
 * 이벤트 생성 헬퍼
 */
export function createEvent<T>(params: {
  action: EventAction;
  domain: EventDomain;
  tenantId: string;
  correlationId: string;
  source: string;
  payload: T;
  causationId?: string;
}): EnterpriseEvent<T> {
  return {
    eventId: `EVT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    eventAction: params.action,
    eventDomain: params.domain,
    version: "1.0",
    tenantId: params.tenantId,
    correlationId: params.correlationId,
    causationId: params.causationId ?? null,
    source: params.source,
    timestamp: new Date().toISOString(),
    payload: params.payload,
    metadata: { retryCount: 0, maxRetries: 3, deadLetterEligible: true },
  };
}

export function getDeadLetterQueue(): EnterpriseEvent[] {
  return [...deadLetterQueue];
}

export function getEventLog(limit?: number): EnterpriseEvent[] {
  const logs = [...eventLog].reverse();
  return limit ? logs.slice(0, limit) : logs;
}

export function drainDeadLetter(eventId: string): boolean {
  const idx = deadLetterQueue.findIndex((e) => e.eventId === eventId);
  if (idx === -1) return false;
  deadLetterQueue.splice(idx, 1);
  return true;
}
