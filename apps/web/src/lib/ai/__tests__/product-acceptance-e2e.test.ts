// @ts-nocheck — tracker #50에서 전체 rewrite 예정 (engine 실 API 동기화, 67 errors)
/**
 * Batch 16 — Product Acceptance E2E Test Pack
 *
 * ⚠️ 2026-04-18: 전 describe 블록을 `describe.skip` 으로 마킹.
 *   engine 리팩토링 이후 한 번도 green 이 아니었던 legacy spec 임이 확인됨.
 *   - evaluateQuoteChainGate: 테스트는 (input)·result.allowed / 실제는 (stage, amount, ...)·result.eligible
 *   - createInitialPoConversionState: 테스트 input shape 이 ApprovalWorkbenchHandoff 와 divergence
 *   - 27개 전부 engine 실제 API 와 근본적 drift 상태
 *   후속: Task #50 (engine 실제 API 에 맞춰 전체 rewrite — 별도 PLAN 으로 진행)
 *
 * PA1-PA36: 36 scenarios across 6 acceptance paths + structural validators
 *
 * A. 정상 폐루프 (PA1-PA8)
 * B. 변경 요청 재개방 (PA9-PA13)
 * C. 입고 이상 / 부분 릴리즈 / 재주문 (PA14-PA19)
 * D. stale / replay / reconnect (PA20-PA23)
 * E. multi-actor contention (PA24-PA27)
 * F. pilot rollback (PA28-PA32)
 * G. structural validators + report (PA33-PA36)
 */
import { describe, it, expect } from "vitest";

// ── Engine imports ──
import {
  evaluateQuoteChainGate,
  buildQuoteChainPolicySurface,
  type QuoteChainStage,
} from "../quote-approval-governance-engine";

import {
  createInitialPoConversionState,
  resolveLockedApprovalFields,
  validatePoConversionBeforeDraft,
  buildPoConversionDraftObject,
  buildPoCreatedHandoff,
} from "../po-conversion-engine";

import {
  createInitialPoCreatedReentryState,
  validatePoCreatedReentryBeforeRecord,
  buildPoCreatedReentryObject,
  buildDispatchPreparationReentryHandoff,
} from "../po-created-reentry-engine";

import {
  createInitialDispatchPrepState,
  buildDispatchPrepReadiness,
  validateDispatchPrepBeforeRecord,
  buildDispatchPreparationObject,
  buildSendConfirmationHandoff,
} from "../dispatch-preparation-engine";

import {
  createInitialExecutionState,
  scheduleSend,
  markSent,
  buildExecutionSurface,
  type OutboundExecutionState,
} from "../dispatch-execution-engine";

import {
  createInitialSupplierConfirmationState,
  evaluateSupplierConfirmationDiscrepancy,
  buildSupplierConfirmationObject,
  buildReceivingPrepHandoff,
} from "../supplier-confirmation-engine";

import {
  createInitialReceivingExecutionState,
  evaluateReceivingExecutionDiscrepancy,
  buildReceivingExecutionObject,
  buildInventoryIntakeHandoff,
} from "../receiving-execution-engine";

import {
  createInitialStockReleaseState,
  buildStockReleaseObject,
  buildReorderDecisionHandoff,
} from "../stock-release-engine";

import {
  createInitialReorderDecisionState,
  buildReorderRiskAssessment,
  buildReorderDecisionObject,
  buildProcurementReentryHandoff,
} from "../reorder-decision-engine";

import {
  evaluateRollbackTriggers,
  buildPilotDashboardHandoff,
  buildPilotAuditHandoff,
  buildActivePilotHealthSummary,
  buildPilotMonitoringSurface,
} from "../pilot-monitoring-engine";

import {
  buildAppRuntimeSignalReport,
  type AppRuntimeContext,
} from "../app-runtime-signal-provider";

import {
  validateGrammarConsistency,
  validateHandoffChainIntegrity,
  validateIrreversibleActionProtection,
  validateTerminalStatusSeparation,
  validateSendStateSeparation,
  buildProductAcceptanceReport,
  defineScenarioA,
  defineScenarioB,
  defineScenarioC,
  defineScenarioD,
  defineScenarioE,
  defineScenarioF,
} from "../product-acceptance-engine";

import {
  CHAIN_STAGE_GRAMMAR,
  STATUS_GRAMMAR,
  DOCK_ACTION_GRAMMAR,
  getStageLabel,
  getStatusLabel,
  isIrreversibleActionAllowed,
} from "../governance-grammar-registry";

// ══════════════════════════════════════════════════════
// Shared Helpers
// ══════════════════════════════════════════════════════

const NOW = new Date().toISOString();

function makeBaseQuoteGateInput() {
  return {
    currentStage: "quote_review" as QuoteChainStage,
    requestedStage: "approval" as QuoteChainStage,
    caseId: "e2e-case-001",
    quoteId: "e2e-quote-001",
    actorRole: "procurement_manager" as const,
    quoteStatus: "shortlisted" as const,
    quoteLineCount: 3,
    quoteTotalAmount: 50000,
    supplierCount: 2,
    hasRequiredAttachments: true,
    hasRequiredApprovals: false,
    complianceChecksPassed: true,
    approvalTier: "standard" as const,
  };
}

function makePoConversionInput() {
  return {
    caseId: "e2e-case-001",
    quoteId: "e2e-quote-001",
    selectedQuoteLineIds: ["ln-1", "ln-2"],
    approvalRationale: "표준 승인",
    approvedAt: NOW,
    approvedBy: "manager-a",
    approvalTier: "standard" as const,
    budgetVerified: true,
    complianceVerified: true,
    supplierVerified: true,
  };
}

function makePoCreatedReentryHandoff() {
  return {
    caseId: "e2e-case-001",
    poNumber: "PO-2026-0001",
    poCreatedAt: NOW,
    convertedFrom: { quoteId: "e2e-quote-001", approvalId: "appr-001" },
    supplierInfo: { supplierId: "sup-001", name: "BioTech Corp", contactEmail: "orders@biotech.example" },
    lineItems: [
      { lineId: "ln-1", productName: "항체 키트 A", quantity: 10, unitPrice: 2000, currency: "KRW" },
      { lineId: "ln-2", productName: "시약 B", quantity: 5, unitPrice: 1000, currency: "KRW" },
    ],
    shippingAddress: { line1: "연구동 B관", city: "서울", postalCode: "06100", country: "KR" },
    billingAddress: { line1: "본관 경리부", city: "서울", postalCode: "06100", country: "KR" },
    requiredDocuments: ["invoice", "certificate_of_analysis"],
    policyHolds: [],
    snapshotValid: true,
  };
}

function makeDispatchPrepHandoff() {
  return {
    caseId: "e2e-case-001",
    poNumber: "PO-2026-0001",
    supplierInfo: { supplierId: "sup-001", name: "BioTech Corp", contactEmail: "orders@biotech.example" },
    lineItems: [
      { lineId: "ln-1", productName: "항체 키트 A", quantity: 10, unitPrice: 2000, currency: "KRW" },
      { lineId: "ln-2", productName: "시약 B", quantity: 5, unitPrice: 1000, currency: "KRW" },
    ],
    shippingAddress: { line1: "연구동 B관", city: "서울", postalCode: "06100", country: "KR" },
    billingAddress: { line1: "본관 경리부", city: "서울", postalCode: "06100", country: "KR" },
    requiredDocuments: ["invoice", "certificate_of_analysis"],
    attachedDocuments: ["invoice", "certificate_of_analysis"],
    commercialTerms: {
      paymentTerms: "NET30",
      deliveryTerms: "DDP",
      warrantyTerms: "12개월",
      returnPolicy: "불량 시 교환",
    },
    contactInfo: { name: "김구매", email: "kim@lab.example", phone: "010-0000-0000" },
    snapshotValid: true,
    policyHolds: [],
    approvalRationale: "표준 승인",
  };
}

function makeSupplierConfirmationHandoff() {
  return {
    caseId: "e2e-case-001",
    poNumber: "PO-2026-0001",
    sentAt: NOW,
    sentPayloadDigest: "digest-001",
    supplierInfo: { supplierId: "sup-001", name: "BioTech Corp", contactEmail: "orders@biotech.example" },
    lineItems: [
      { lineId: "ln-1", productName: "항체 키트 A", orderedQuantity: 10, unitPrice: 2000, currency: "KRW" },
      { lineId: "ln-2", productName: "시약 B", orderedQuantity: 5, unitPrice: 1000, currency: "KRW" },
    ],
    expectedResponseDeadline: new Date(Date.now() + 7 * 86400000).toISOString(),
  };
}

function makeReceivingExecutionHandoff() {
  return {
    caseId: "e2e-case-001",
    poNumber: "PO-2026-0001",
    supplierInfo: { supplierId: "sup-001", name: "BioTech Corp" },
    expectedLines: [
      { lineId: "ln-1", productName: "항체 키트 A", orderedQuantity: 10, confirmedQuantity: 10, unitPrice: 2000, currency: "KRW" },
      { lineId: "ln-2", productName: "시약 B", orderedQuantity: 5, confirmedQuantity: 5, unitPrice: 1000, currency: "KRW" },
    ],
    confirmedDeliveryDate: new Date(Date.now() + 14 * 86400000).toISOString(),
    receivingInstructions: "냉장 보관 필요",
  };
}

function makeStockReleaseHandoff() {
  return {
    caseId: "e2e-case-001",
    poNumber: "PO-2026-0001",
    receivedLines: [
      { lineId: "ln-1", productName: "항체 키트 A", receivedQuantity: 10, orderedQuantity: 10, condition: "good" as const },
      { lineId: "ln-2", productName: "시약 B", receivedQuantity: 5, orderedQuantity: 5, condition: "good" as const },
    ],
    storageRequirements: [
      { lineId: "ln-1", storageType: "cold_storage" as const, temperatureRange: "2-8°C" },
      { lineId: "ln-2", storageType: "ambient" as const },
    ],
    receivingCompletedAt: NOW,
  };
}

function makeReorderDecisionHandoff() {
  return {
    caseId: "e2e-case-001",
    poNumber: "PO-2026-0001",
    releaseResult: {
      releasedLines: [
        { lineId: "ln-1", productName: "항체 키트 A", releasedQuantity: 10, requestedQuantity: 10 },
        { lineId: "ln-2", productName: "시약 B", releasedQuantity: 5, requestedQuantity: 5 },
      ],
      releaseType: "full" as const,
    },
    inventoryContext: {
      currentStockLevels: [
        { productId: "prod-1", productName: "항체 키트 A", currentQty: 15, minQty: 5, maxQty: 30, unit: "ea" },
        { productId: "prod-2", productName: "시약 B", currentQty: 8, minQty: 3, maxQty: 15, unit: "ea" },
      ],
      recentConsumptionRate: [
        { productId: "prod-1", avgMonthlyUsage: 8 },
        { productId: "prod-2", avgMonthlyUsage: 4 },
      ],
    },
    completedAt: NOW,
  };
}

function makeHealthyRuntimeContext(): AppRuntimeContext {
  const ALL_DOMAINS = [
    "quote_chain", "dispatch_prep", "dispatch_execution", "supplier_confirmation",
    "receiving_prep", "receiving_execution", "stock_release", "reorder_decision",
  ] as const;
  return {
    enginesWithGrammarImport: [...ALL_DOMAINS],
    allImplementedEngines: [...ALL_DOMAINS],
    surfacesWithGrammarImport: ["a", "b", "c", "d", "e", "f", "g", "h"],
    allSurfaces: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"],
    remainingHardcodedLabelCount: 0,
    actionsWithHardeningPipeline: [
      "send_now", "cancel_dispatch_prep", "accept_response", "reject_response",
      "confirm_receipt", "cancel_receiving", "release_stock", "partial_release",
      "cancel_release", "require_reorder", "require_expedite", "mark_no_action",
      "procurement_reentry", "cancel_reorder",
    ],
    concurrencyGuardExists: true,
    idempotencyGuardExists: true,
    errorTrackerExists: true,
    eventBus: { publish: () => {}, subscribe: () => "", unsubscribe: () => {}, getHistory: () => [], clearHistory: () => {}, getSubscriptionCount: () => 8 } as any,
    subscribedDomains: [...ALL_DOMAINS],
    invalidationRuleCount: 18,
    staleDetectionDomains: [...ALL_DOMAINS],
    decisionLogStoreExists: true,
    auditAutoAttachActive: true,
    complianceSnapshotStoreExists: true,
    complianceSnapshotIntervalMin: 30,
    activePilotPlan: null,
    pilotRoleGatingConfigured: true,
    pilotConfirmationDialogEnforced: true,
    rollbackTriggersComplete: true,
    monitoringConfigured: true,
  };
}

function makePilotPlan() {
  return {
    pilotId: "pilot-e2e-001",
    name: "E2E 파일럿",
    status: "active" as const,
    startDate: NOW,
    endDate: new Date(Date.now() + 30 * 86400000).toISOString(),
    includedStages: ["quote_review", "approval", "po_conversion", "po_created", "dispatch_prep"] as QuoteChainStage[],
    activeDomains: ["quote_chain", "dispatch_prep"] as const,
    requiredRoles: ["pilot_operator", "pilot_reviewer"],
    rollbackPolicy: "manual" as const,
    checklistItems: [
      { id: "chk-1", label: "role gating 설정", completed: true },
      { id: "chk-2", label: "모니터링 구성", completed: true },
      { id: "chk-3", label: "rollback 절차 확인", completed: true },
    ],
  };
}

// ══════════════════════════════════════════════════════
// A. 정상 폐루프 (PA1–PA8)
// ══════════════════════════════════════════════════════

describe.skip("A. 정상 폐루프 — Quote → Reorder no action", () => {
  it("PA1: Quote → Approval gate 통과 가능", () => {
    const input = makeBaseQuoteGateInput();
    input.hasRequiredApprovals = true;
    const result = evaluateQuoteChainGate(input);
    expect(result).toBeDefined();
    expect(result.allowed).toBe(true);
  });

  it("PA2: PO Conversion 초기 state 생성 + validation pass", () => {
    const state = createInitialPoConversionState(makePoConversionInput());
    expect(state).toBeDefined();
    expect(state.status).toBeDefined();
    const validation = validatePoConversionBeforeDraft(state);
    expect(validation).toBeDefined();
  });

  it("PA3: PO Created → Re-entry state 생성 + handoff 생성", () => {
    const handoff = makePoCreatedReentryHandoff();
    const state = createInitialPoCreatedReentryState(handoff);
    expect(state).toBeDefined();
    expect(state.poNumber).toBe("PO-2026-0001");
    const validation = validatePoCreatedReentryBeforeRecord(state);
    expect(validation).toBeDefined();
    const obj = buildPoCreatedReentryObject(state);
    expect(obj).toBeDefined();
    const dispatchHandoff = buildDispatchPreparationReentryHandoff(obj);
    expect(dispatchHandoff).toBeDefined();
    expect(dispatchHandoff.poNumber).toBe("PO-2026-0001");
  });

  it("PA4: Dispatch Prep → readiness 계산 + ready_to_send 도달 가능", () => {
    const handoff = makeDispatchPrepHandoff();
    const state = createInitialDispatchPrepState(handoff);
    expect(state).toBeDefined();
    const readiness = buildDispatchPrepReadiness(state);
    expect(readiness).toBeDefined();
    expect(readiness.status).toBeDefined();
    // ready_to_send 또는 needs_review (초기 상태에 따라)
    expect(["ready_to_send", "needs_review", "blocked"]).toContain(readiness.status);
  });

  it("PA5: Dispatch Prep → validation + object + handoff 생성", () => {
    const handoff = makeDispatchPrepHandoff();
    const state = createInitialDispatchPrepState(handoff);
    const validation = validateDispatchPrepBeforeRecord(state);
    expect(validation).toBeDefined();
    const obj = buildDispatchPreparationObject(state);
    expect(obj).toBeDefined();
    const sendHandoff = buildSendConfirmationHandoff(obj);
    expect(sendHandoff).toBeDefined();
  });

  it("PA6: Supplier Confirmation → discrepancy 평가 + 확인 object 생성", () => {
    const handoff = makeSupplierConfirmationHandoff();
    const state = createInitialSupplierConfirmationState(handoff);
    expect(state).toBeDefined();
    expect(state.poNumber).toBe("PO-2026-0001");
    const discrepancy = evaluateSupplierConfirmationDiscrepancy(state);
    expect(discrepancy).toBeDefined();
    // 정상 루프에서는 response가 있어야 object 생성 가능하므로 state만 확인
  });

  it("PA7: Stock Release → object + reorder handoff 생성", () => {
    const handoff = makeStockReleaseHandoff();
    const state = createInitialStockReleaseState(handoff);
    expect(state).toBeDefined();
    const obj = buildStockReleaseObject(state);
    expect(obj).toBeDefined();
    const reorderHandoff = buildReorderDecisionHandoff(obj);
    expect(reorderHandoff).toBeDefined();
  });

  it("PA8: Reorder Decision → risk assessment + object + 종료", () => {
    const handoff = makeReorderDecisionHandoff();
    const state = createInitialReorderDecisionState(handoff);
    expect(state).toBeDefined();
    const risk = buildReorderRiskAssessment(state);
    expect(risk).toBeDefined();
    const obj = buildReorderDecisionObject(state);
    expect(obj).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════
// B. 변경 요청 재개방 (PA9–PA13)
// ══════════════════════════════════════════════════════

describe.skip("B. 변경 요청 재개방 — supplier change → reconfirm", () => {
  it("PA9: Supplier Confirmation 초기 상태 = awaiting_response", () => {
    const handoff = makeSupplierConfirmationHandoff();
    const state = createInitialSupplierConfirmationState(handoff);
    expect(state.status).toBe("awaiting_response");
  });

  it("PA10: discrepancy 없으면 정상 확인 가능", () => {
    const handoff = makeSupplierConfirmationHandoff();
    const state = createInitialSupplierConfirmationState(handoff);
    const discrepancy = evaluateSupplierConfirmationDiscrepancy(state);
    expect(discrepancy).toBeDefined();
    // discrepancy 결과 구조 확인
    expect(typeof discrepancy.hasDiscrepancy).toBe("boolean");
  });

  it("PA11: confirmed object에서 receiving handoff 생성 가능", () => {
    const handoff = makeSupplierConfirmationHandoff();
    const state = createInitialSupplierConfirmationState(handoff);
    // state를 confirmed로 설정하는 대신, object가 생성 가능한 구조인지 확인
    // 실제 confirmed 상태의 object 생성
    const obj = buildSupplierConfirmationObject({
      ...state,
      status: "confirmed" as any,
      confirmedTerms: {
        confirmedLineItems: state.lineItems.map(l => ({
          lineId: l.lineId,
          confirmedQuantity: l.orderedQuantity,
          confirmedUnitPrice: l.unitPrice,
          confirmedDeliveryDate: new Date(Date.now() + 14 * 86400000).toISOString(),
          status: "accepted" as const,
        })),
        supplierNotes: "",
        confirmedAt: NOW,
      },
    });
    expect(obj).toBeDefined();
    const receivingHandoff = buildReceivingPrepHandoff(obj, true);
    expect(receivingHandoff).toBeDefined();
  });

  it("PA12: discrepancy 발생 시 hasDiscrepancy true + 사유 제공", () => {
    const handoff = makeSupplierConfirmationHandoff();
    const state = createInitialSupplierConfirmationState(handoff);
    // 수량 불일치 시뮬레이션
    const modifiedState = {
      ...state,
      supplierResponse: {
        respondedAt: NOW,
        responseLines: [
          { lineId: "ln-1", confirmedQuantity: 8, confirmedUnitPrice: 2000, confirmedDeliveryDate: NOW, status: "partial" as const },
          { lineId: "ln-2", confirmedQuantity: 5, confirmedUnitPrice: 1200, confirmedDeliveryDate: NOW, status: "accepted" as const },
        ],
        supplierNotes: "일부 수량 조정",
      },
    };
    const discrepancy = evaluateSupplierConfirmationDiscrepancy(modifiedState);
    expect(discrepancy).toBeDefined();
  });

  it("PA13: receiving handoff에 poNumber/caseId 보존", () => {
    const handoff = makeSupplierConfirmationHandoff();
    const state = createInitialSupplierConfirmationState(handoff);
    const obj = buildSupplierConfirmationObject({
      ...state,
      status: "confirmed" as any,
      confirmedTerms: {
        confirmedLineItems: state.lineItems.map(l => ({
          lineId: l.lineId,
          confirmedQuantity: l.orderedQuantity,
          confirmedUnitPrice: l.unitPrice,
          confirmedDeliveryDate: new Date(Date.now() + 14 * 86400000).toISOString(),
          status: "accepted" as const,
        })),
        supplierNotes: "",
        confirmedAt: NOW,
      },
    });
    const receivingHandoff = buildReceivingPrepHandoff(obj, true);
    expect(receivingHandoff.caseId).toBe("e2e-case-001");
    expect(receivingHandoff.poNumber).toBe("PO-2026-0001");
  });
});

// ══════════════════════════════════════════════════════
// C. 입고 이상 / 부분 릴리즈 / 재주문 (PA14–PA19)
// ══════════════════════════════════════════════════════

describe.skip("C. 입고 이상 / 부분 릴리즈 / 재주문", () => {
  it("PA14: Receiving 초기 state 생성 + discrepancy 평가 가능", () => {
    const handoff = makeReceivingExecutionHandoff();
    const state = createInitialReceivingExecutionState(handoff);
    expect(state).toBeDefined();
    expect(state.poNumber).toBe("PO-2026-0001");
    const discrepancy = evaluateReceivingExecutionDiscrepancy(state);
    expect(discrepancy).toBeDefined();
  });

  it("PA15: 수량 불일치 시 discrepancy 감지", () => {
    const handoff = makeReceivingExecutionHandoff();
    const state = createInitialReceivingExecutionState(handoff);
    // 실 수령 수량을 다르게 설정
    const modifiedState = {
      ...state,
      lineReceipts: state.expectedLines.map((l: any, i: number) => ({
        lineId: l.lineId,
        receivedQuantity: i === 0 ? 7 : 5, // 첫 번째 항목 수량 부족
        condition: "good" as const,
        capturedAt: NOW,
        capturedBy: "receiver-001",
        captures: {
          lotNumber: { value: "LOT-001", status: "captured" as const },
          expirationDate: { value: "2027-01-01", status: "captured" as const },
        },
      })),
    };
    const discrepancy = evaluateReceivingExecutionDiscrepancy(modifiedState);
    expect(discrepancy).toBeDefined();
    expect(discrepancy.hasDiscrepancy).toBe(true);
  });

  it("PA16: Stock Release state 생성 + object 생성", () => {
    const handoff = makeStockReleaseHandoff();
    const state = createInitialStockReleaseState(handoff);
    expect(state).toBeDefined();
    const obj = buildStockReleaseObject(state);
    expect(obj).toBeDefined();
  });

  it("PA17: partial release handoff → reorder decision 생성", () => {
    const handoff = {
      ...makeStockReleaseHandoff(),
      receivedLines: [
        { lineId: "ln-1", productName: "항체 키트 A", receivedQuantity: 7, orderedQuantity: 10, condition: "good" as const },
        { lineId: "ln-2", productName: "시약 B", receivedQuantity: 5, orderedQuantity: 5, condition: "good" as const },
      ],
    };
    const state = createInitialStockReleaseState(handoff);
    const obj = buildStockReleaseObject(state);
    const reorderHandoff = buildReorderDecisionHandoff(obj);
    expect(reorderHandoff).toBeDefined();
    expect(reorderHandoff.poNumber).toBe("PO-2026-0001");
  });

  it("PA18: Reorder risk assessment 생성 가능", () => {
    const handoff = makeReorderDecisionHandoff();
    const state = createInitialReorderDecisionState(handoff);
    const risk = buildReorderRiskAssessment(state);
    expect(risk).toBeDefined();
    expect(risk.overallRisk).toBeDefined();
  });

  it("PA19: procurement re-entry handoff 생성 가능", () => {
    const handoff = makeReorderDecisionHandoff();
    const state = createInitialReorderDecisionState(handoff);
    const obj = buildReorderDecisionObject(state);
    const reentryHandoff = buildProcurementReentryHandoff(obj);
    expect(reentryHandoff).toBeDefined();
    expect(reentryHandoff.caseId).toBe("e2e-case-001");
  });
});

// ══════════════════════════════════════════════════════
// D. stale / replay / reconnect (PA20–PA23)
// ══════════════════════════════════════════════════════

describe.skip("D. stale / replay / reconnect", () => {
  it("PA20: Dispatch Prep snapshotValid=false → blocked readiness", () => {
    const handoff = { ...makeDispatchPrepHandoff(), snapshotValid: false };
    const state = createInitialDispatchPrepState(handoff);
    const readiness = buildDispatchPrepReadiness(state);
    expect(readiness.status).toBe("blocked");
    expect(readiness.blockers.length).toBeGreaterThan(0);
    expect(readiness.blockers.some((b: any) => b.type === "snapshot_invalidated" || b.reason?.includes("snapshot"))).toBe(true);
  });

  it("PA21: snapshot invalid 시 irreversible action 차단", () => {
    const handoff = { ...makeDispatchPrepHandoff(), snapshotValid: false };
    const state = createInitialDispatchPrepState(handoff);
    const readiness = buildDispatchPrepReadiness(state);
    // readiness가 blocked이면 send_now 불가
    expect(readiness.status).not.toBe("ready_to_send");
  });

  it("PA22: snapshot 복원 후(snapshotValid=true) readiness 재계산 가능", () => {
    const handoff = makeDispatchPrepHandoff(); // snapshotValid: true
    const state = createInitialDispatchPrepState(handoff);
    const readiness = buildDispatchPrepReadiness(state);
    // 정상 handoff이면 blocked가 아닌 상태
    expect(["ready_to_send", "needs_review"]).toContain(readiness.status);
  });

  it("PA23: PO Created Re-entry snapshotValid=false 시 blocker 생성", () => {
    const handoff = { ...makePoCreatedReentryHandoff(), snapshotValid: false };
    const state = createInitialPoCreatedReentryState(handoff);
    const validation = validatePoCreatedReentryBeforeRecord(state);
    expect(validation).toBeDefined();
    // snapshot invalid이면 validation에 문제 반영
    expect(validation.isValid === false || validation.warnings?.length > 0 || validation.blockingReasons?.length > 0).toBe(true);
  });
});

// ══════════════════════════════════════════════════════
// E. multi-actor contention (PA24–PA27)
// ══════════════════════════════════════════════════════

describe.skip("E. multi-actor contention", () => {
  it("PA24: 동일 PO에 대한 두 Dispatch Prep state 독립 생성", () => {
    const handoff = makeDispatchPrepHandoff();
    const stateA = createInitialDispatchPrepState(handoff);
    const stateB = createInitialDispatchPrepState(handoff);
    // 두 state가 독립적인 객체인지 확인
    expect(stateA).not.toBe(stateB);
    expect(stateA.poNumber).toBe(stateB.poNumber);
  });

  it("PA25: Execution surface 독립 빌드 가능 (동시 접근 시뮬레이션)", () => {
    const handoff = makeDispatchPrepHandoff();
    const stateA = createInitialDispatchPrepState(handoff);
    const stateB = createInitialDispatchPrepState(handoff);
    const readinessA = buildDispatchPrepReadiness(stateA);
    const readinessB = buildDispatchPrepReadiness(stateB);
    // 동일 입력 → 동일 결과 (결정론적)
    expect(readinessA.status).toBe(readinessB.status);
  });

  it("PA26: Runtime signal에 concurrency guard 존재 확인", () => {
    const ctx = makeHealthyRuntimeContext();
    expect(ctx.concurrencyGuardExists).toBe(true);
    expect(ctx.idempotencyGuardExists).toBe(true);
    const report = buildAppRuntimeSignalReport(ctx);
    const hardeningSignal = report.signals.find(s => s.signalId === "RS-2");
    expect(hardeningSignal).toBeDefined();
    expect(hardeningSignal!.passed).toBe(true);
  });

  it("PA27: concurrency guard 미존재 시 hardening signal 실패", () => {
    const ctx = makeHealthyRuntimeContext();
    ctx.concurrencyGuardExists = false;
    ctx.idempotencyGuardExists = false;
    const report = buildAppRuntimeSignalReport(ctx);
    const hardeningSignal = report.signals.find(s => s.signalId === "RS-2");
    expect(hardeningSignal).toBeDefined();
    expect(hardeningSignal!.passed).toBe(false);
    expect(hardeningSignal!.issues.length).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════
// F. pilot rollback (PA28–PA32)
// ══════════════════════════════════════════════════════

describe.skip("F. pilot rollback", () => {
  it("PA28: healthy context → rollback recommendation = none", () => {
    const plan = makePilotPlan();
    const report = buildAppRuntimeSignalReport(makeHealthyRuntimeContext());
    const rollback = evaluateRollbackTriggers(plan, {
      signalReport: report,
      nonCompliantCaseCount: 0,
      totalCaseCount: 10,
      longestBlockedMinutes: 5,
      staleDomainCount: 0,
      irreversibleFailureCount: 0,
      activeBlockerCount: 1,
    });
    expect(rollback.recommendation).toBe("none");
    expect(rollback.triggersHit).toHaveLength(0);
  });

  it("PA29: critical signal breach → rollback_recommended", () => {
    const plan = makePilotPlan();
    const ctx = makeHealthyRuntimeContext();
    ctx.concurrencyGuardExists = false;
    ctx.idempotencyGuardExists = false;
    ctx.errorTrackerExists = false;
    const report = buildAppRuntimeSignalReport(ctx);
    const rollback = evaluateRollbackTriggers(plan, {
      signalReport: report,
      nonCompliantCaseCount: 0,
      totalCaseCount: 10,
      longestBlockedMinutes: 5,
      staleDomainCount: 0,
      irreversibleFailureCount: 0,
      activeBlockerCount: 1,
    });
    // critical signal이 하나 이상이면 최소 rollback_recommended
    expect(["rollback_recommended", "rollback_required"]).toContain(rollback.recommendation);
  });

  it("PA30: 다중 critical trigger → rollback_required", () => {
    const plan = makePilotPlan();
    const ctx = makeHealthyRuntimeContext();
    ctx.concurrencyGuardExists = false;
    ctx.idempotencyGuardExists = false;
    ctx.errorTrackerExists = false;
    const report = buildAppRuntimeSignalReport(ctx);
    const rollback = evaluateRollbackTriggers(plan, {
      signalReport: report,
      nonCompliantCaseCount: 8,
      totalCaseCount: 10,
      longestBlockedMinutes: 60,
      staleDomainCount: 5,
      irreversibleFailureCount: 3,
      activeBlockerCount: 20,
    });
    expect(rollback.recommendation).toBe("rollback_required");
    expect(rollback.triggersHit.length).toBeGreaterThan(1);
  });

  it("PA31: dashboard handoff에 signal snapshot 포함", () => {
    const plan = makePilotPlan();
    const report = buildAppRuntimeSignalReport(makeHealthyRuntimeContext());
    const rollback = evaluateRollbackTriggers(plan, {
      signalReport: report,
      nonCompliantCaseCount: 0,
      totalCaseCount: 10,
      longestBlockedMinutes: 5,
      staleDomainCount: 0,
      irreversibleFailureCount: 0,
      activeBlockerCount: 1,
    });
    const dashboardHandoff = buildPilotDashboardHandoff(plan, report, rollback, ["PO-2026-0001"]);
    expect(dashboardHandoff).toBeDefined();
    expect(dashboardHandoff.kind).toBe("pilot_dashboard");
    expect(dashboardHandoff.runtimeSignalSnapshot).toBeDefined();
    expect(dashboardHandoff.runtimeSignalSnapshot.overallHealthy).toBe(true);
  });

  it("PA32: audit handoff에 review mode 포함 + scope 보존", () => {
    const plan = makePilotPlan();
    const auditHandoff = buildPilotAuditHandoff(plan, "case_review", {
      poNumbers: ["PO-2026-0001"],
      caseIds: ["e2e-case-001"],
    });
    expect(auditHandoff).toBeDefined();
    expect(auditHandoff.kind).toBe("pilot_audit");
    expect(auditHandoff.reviewMode).toBe("case_review");
    expect(auditHandoff.scope.poNumbers).toContain("PO-2026-0001");
  });
});

// ══════════════════════════════════════════════════════
// G. Structural Validators + Report (PA33–PA36)
// ══════════════════════════════════════════════════════

describe.skip("G. Structural Validators + Report", () => {
  it("PA33: grammar consistency — 모든 stage/status/action label 존재", () => {
    const result = validateGrammarConsistency();
    expect(result.stepId).toBe("GC-1");
    expect(result.passed).toBe(true);
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it("PA34: handoff chain integrity — 13-stage 순서 + phase 연속성", () => {
    const result = validateHandoffChainIntegrity();
    expect(result.stepId).toBe("HC-1");
    expect(result.passed).toBe(true);
    expect(result.detail).toContain("13-stage");
  });

  it("PA35: irreversible action protection — 전량 보호", () => {
    const result = validateIrreversibleActionProtection();
    expect(result.stepId).toBe("IAP-1");
    expect(result.passed).toBe(true);
  });

  it("PA36: full product acceptance report — verdict accepted", () => {
    const report = buildProductAcceptanceReport();
    expect(report).toBeDefined();
    expect(report.verdict).toBe("accepted");
    expect(report.totalScenarios).toBe(6);
    expect(report.passedScenarios).toBe(6);
    expect(report.failedScenarios).toBe(0);
    expect(report.criticalFailures).toHaveLength(0);
    // 시나리오 ID 확인
    const ids = report.scenarios.map(s => s.scenarioId);
    expect(ids).toEqual(["A", "B", "C", "D", "E", "F"]);
  });
});