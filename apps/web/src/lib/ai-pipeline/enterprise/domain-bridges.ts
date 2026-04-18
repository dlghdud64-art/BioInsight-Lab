/**
 * Domain Bridges — 구매/재고/재무/보안/티켓팅 연동 인터페이스
 *
 * 각 브릿지는 비동기 이벤트 기반으로 동작하며,
 * 플랫폼이 직접 외부 DB를 수정(Mutation)하지 않습니다.
 *
 * Guardrails:
 * - 자동 구매 승인 트리거 금지
 * - 자동 대금 지급 트리거 금지
 * - 재고 DB 다이렉트 수정 금지
 */

import { createEvent, publish } from "./event-bus-contracts";
import { validateWriteAccess } from "./source-of-truth-matrix";
import type { EnterpriseEvent } from "./event-bus-contracts";

// ── Procurement & Finance Bridge ──

export interface ProcurementMatchRequest {
  tenantId: string;
  documentId: string;
  documentType: string;
  vendorName: string;
  totalAmount: number;
  currency: string;
  lineItems: { description: string; quantity: number; unitPrice: number }[];
  correlationId: string;
}

export interface ProcurementMatchResult {
  matched: boolean;
  purchaseOrderId: string | null;
  matchConfidence: number;
  discrepancies: { field: string; expected: string; actual: string }[];
}

/**
 * 구매 매핑 — 검증된 문서를 구매 마스터와 매핑 (READ ONLY)
 *
 * ⚠️ Guardrail: 절대 '대금 지급'이나 '자동 구매 승인'을 트리거하지 않습니다.
 */
export async function matchProcurementOrder(request: ProcurementMatchRequest): Promise<ProcurementMatchResult> {
  // Guardrail: SoT 검증 — PURCHASE_ORDER는 ERP 소유
  const writeCheck = validateWriteAccess({ domain: "PURCHASE_ORDER", requestingSystem: "PLATFORM" });
  if (writeCheck.allowed) {
    // This should never happen — PLATFORM should not have write access to PURCHASE_ORDER
    throw new Error("SoT VIOLATION: PLATFORM must not write to PURCHASE_ORDER");
  }

  // READ-ONLY matching logic (production: ERP API 호출)
  const result: ProcurementMatchResult = {
    matched: false,
    purchaseOrderId: null,
    matchConfidence: 0,
    discrepancies: [],
  };

  // Emit event for downstream processing
  await publish(createEvent({
    action: "procurement.order_matched",
    domain: "PROCUREMENT",
    tenantId: request.tenantId,
    correlationId: request.correlationId,
    source: "PROCUREMENT_BRIDGE",
    payload: {
      documentId: request.documentId,
      vendorName: request.vendorName,
      totalAmount: request.totalAmount,
      result,
    },
  }));

  return result;
}

// ── Inventory Bridge ──

export interface InventoryCheckRequest {
  tenantId: string;
  productId: string;
  lotNumber: string;
  expectedQuantity: number;
  expiryDate: string | null;
  correlationId: string;
}

export interface InventoryDiscrepancy {
  type: "QUANTITY_MISMATCH" | "EXPIRY_MISMATCH" | "LOT_NOT_FOUND";
  platformValue: string;
  wmsValue: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
}

/**
 * 재고 불일치 확인 — Discrepancy 이벤트만 발행 (재고 DB 수정 금지)
 */
export async function checkInventoryDiscrepancy(request: InventoryCheckRequest): Promise<InventoryDiscrepancy[]> {
  // Guardrail: SoT 검증 — INVENTORY_LOT은 WMS 소유
  const writeCheck = validateWriteAccess({ domain: "INVENTORY_LOT", requestingSystem: "PLATFORM" });
  if (writeCheck.allowed) {
    throw new Error("SoT VIOLATION: PLATFORM must not write to INVENTORY_LOT");
  }

  // READ-ONLY check (production: WMS API 호출)
  const discrepancies: InventoryDiscrepancy[] = [];

  // If discrepancies found, emit event
  if (discrepancies.length > 0) {
    await publish(createEvent({
      action: "inventory.discrepancy_detected",
      domain: "INVENTORY",
      tenantId: request.tenantId,
      correlationId: request.correlationId,
      source: "INVENTORY_BRIDGE",
      payload: {
        productId: request.productId,
        lotNumber: request.lotNumber,
        discrepancies,
      },
    }));
  }

  return discrepancies;
}

// ── IAM Bridge ──

export interface IAMSyncRequest {
  tenantId: string;
  userId: string;
  externalGroups: string[];
  correlationId: string;
}

/**
 * RBAC ↔ 전사 IAM 그룹 동기화
 */
export async function syncIAMRoles(request: IAMSyncRequest): Promise<{
  synced: boolean;
  mappedRoles: string[];
}> {
  // Guardrail: SoT 검증 — USER_IDENTITY는 IAM 소유
  const writeCheck = validateWriteAccess({ domain: "USER_IDENTITY", requestingSystem: "PLATFORM" });
  if (writeCheck.allowed) {
    throw new Error("SoT VIOLATION: PLATFORM must not write to USER_IDENTITY");
  }

  // READ from IAM, map to platform roles
  const mappedRoles: string[] = [];

  await publish(createEvent({
    action: "identity.role_synced",
    domain: "IDENTITY",
    tenantId: request.tenantId,
    correlationId: request.correlationId,
    source: "IAM_BRIDGE",
    payload: { userId: request.userId, mappedRoles },
  }));

  return { synced: true, mappedRoles };
}

// ── Ticketing Bridge ──

export interface TicketCreateRequest {
  tenantId: string;
  title: string;
  description: string;
  severity: string;
  assignee: string | null;
  documentType: string;
  correlationId: string;
  sourceEvent: string;
}

/**
 * False-safe 등 고위험 이벤트 → 전사 티켓팅 인시던트 발행
 */
export async function createIncidentTicket(request: TicketCreateRequest): Promise<{
  ticketId: string;
  externalUrl: string | null;
}> {
  const ticketId = `TKT-${Date.now()}`;

  await publish(createEvent({
    action: "incident.opened",
    domain: "INCIDENT",
    tenantId: request.tenantId,
    correlationId: request.correlationId,
    source: "TICKETING_BRIDGE",
    payload: {
      ticketId,
      title: request.title,
      severity: request.severity,
      documentType: request.documentType,
      assignee: request.assignee,
    },
  }));

  return { ticketId, externalUrl: null }; // production: Jira/ServiceNow URL
}

// ── Budget Bridge ──

export interface BudgetCheckRequest {
  tenantId: string;
  budgetId: string;
  amount: number;
  currency: string;
  correlationId: string;
}

/**
 * 예산 한도 확인 — READ ONLY (예산 수정 금지)
 */
export async function checkBudgetAvailability(request: BudgetCheckRequest): Promise<{
  available: boolean;
  remainingBudget: number;
  breached: boolean;
}> {
  // Guardrail: SoT — BUDGET는 FINANCE 소유
  const writeCheck = validateWriteAccess({ domain: "BUDGET", requestingSystem: "PLATFORM" });
  if (writeCheck.allowed) {
    throw new Error("SoT VIOLATION: PLATFORM must not write to BUDGET");
  }

  // READ-ONLY check (production: Finance API)
  const result = { available: true, remainingBudget: 0, breached: false };

  if (result.breached) {
    await publish(createEvent({
      action: "budget.breached",
      domain: "BUDGET",
      tenantId: request.tenantId,
      correlationId: request.correlationId,
      source: "FINANCE_BRIDGE",
      payload: { budgetId: request.budgetId, amount: request.amount },
    }));
  }

  return result;
}
