/**
 * §inbound-quarantine-temp-exclude — P2 command + store
 *
 * 1) 문서 첨부 store capability: 필수문서 세트(COA+MSDS) 충족 시 documentStatus='complete',
 *    미충족은 'partial', 무첨부는 'missing'. (호영님 2026-07-03 canonical)
 * 2) command-adapters: rcv-resolve-quarantine 제거, 격리 게이트 제거.
 */
import { describe, it, expect } from "vitest";
import type {
  ReceivingBatchContract,
  ReceivingLineReceiptContract,
} from "../../review-queue/receiving-inbound-contract";
import {
  applyTransition,
  deriveLineDocStatus,
  type EntityGraph,
} from "../scenario-transition-runner";
import { buildReceivingCommandSurface } from "../command-adapters";

function line(overrides: Partial<ReceivingLineReceiptContract> = {}): ReceivingLineReceiptContract {
  return {
    id: "rlr-1",
    receivingBatchId: "rb-1",
    poLineId: "pol-1",
    lineNumber: 1,
    itemName: "Item",
    manufacturer: "M",
    catalogNumber: "C",
    orderedQuantity: 5,
    receivedQuantity: 5,
    receivedUnit: "bottle",
    packSize: "100mL",
    receiptStatus: "received",
    conditionStatus: "ok",
    documentStatus: "missing",
    inspectionRequired: false,
    inspectionStatus: "not_required",
    lotRecords: [
      {
        id: "lot-1",
        receivingLineReceiptId: "rlr-1",
        lotNumber: "L1",
        expiryDate: new Date(Date.now() + 365 * 864e5).toISOString(),
        quantity: 5,
        unit: "bottle",
        storageCondition: "2-8C",
        coaAttached: false,
        msdsAttached: false,
        validationAttached: false,
        warrantyAttached: false,
        labelStatus: "ok",
        quarantineStatus: "quarantined",
      },
    ],
    riskFlags: [],
    ...overrides,
  } as ReceivingLineReceiptContract;
}

function batch(lines: ReceivingLineReceiptContract[]): ReceivingBatchContract {
  return {
    id: "rb-1",
    workspaceId: "ws",
    receivingNumber: "RCV-1",
    status: "arrived",
    sourceType: "purchase_order",
    poId: "po-1",
    vendorId: "v",
    shipToLocation: "x",
    receivedAt: new Date().toISOString(),
    receivedBy: "u",
    lineReceipts: lines,
  } as ReceivingBatchContract;
}

function emptyGraph(rb: ReceivingBatchContract): EntityGraph {
  return {
    quoteRequests: [], quoteResponses: [], quoteComparisons: [],
    purchaseOrders: [], approvalExecutions: [], acknowledgements: [],
    receivingBatches: [rb], stockPositions: [],
    reorderRecommendations: [], expiryActions: [], lotRisks: [],
  };
}

describe("§P2 — deriveLineDocStatus (필수세트 COA+MSDS)", () => {
  it("COA+MSDS 모두 있으면 complete", () => {
    const l = line({ lotRecords: [{ ...line().lotRecords[0], coaAttached: true, msdsAttached: true }] });
    expect(deriveLineDocStatus(l)).toBe("complete");
  });
  it("일부만 있으면 partial", () => {
    const l = line({ lotRecords: [{ ...line().lotRecords[0], coaAttached: true, msdsAttached: false }] });
    expect(deriveLineDocStatus(l)).toBe("partial");
  });
  it("아무 문서도 없으면 missing", () => {
    expect(deriveLineDocStatus(line())).toBe("missing");
  });
  it("not_required는 유지", () => {
    expect(deriveLineDocStatus(line({ documentStatus: "not_required" }))).toBe("not_required");
  });
});

describe("§P2 — attach_receiving_document transition", () => {
  it("COA 첨부 후 MSDS 첨부하면 documentStatus가 partial→complete", () => {
    const g0 = emptyGraph(batch([line()]));
    const g1 = applyTransition(g0, { type: "attach_receiving_document", receivingBatchId: "rb-1", lineId: "rlr-1", docType: "coa" });
    expect(g1.receivingBatches[0].lineReceipts[0].documentStatus).toBe("partial");
    const g2 = applyTransition(g1, { type: "attach_receiving_document", receivingBatchId: "rb-1", lineId: "rlr-1", docType: "msds" });
    expect(g2.receivingBatches[0].lineReceipts[0].documentStatus).toBe("complete");
    expect(g2.receivingBatches[0].lineReceipts[0].lotRecords[0].coaAttached).toBe(true);
  });
  it("입력 그래프를 변형하지 않는다(불변)", () => {
    const g0 = emptyGraph(batch([line()]));
    applyTransition(g0, { type: "attach_receiving_document", receivingBatchId: "rb-1", lineId: "rlr-1", docType: "coa" });
    expect(g0.receivingBatches[0].lineReceipts[0].documentStatus).toBe("missing");
  });
});

describe("§P2 — command surface: 격리 제거", () => {
  const noop = () => {};
  it("격리 lot이 있어도 rcv-resolve-quarantine 명령이 없다", () => {
    const surface = buildReceivingCommandSurface({ rb: batch([line()]), onCompleteInspection: noop, onPostToInventory: noop });
    const ids = surface.triageCommands.map((c) => c.id);
    expect(ids).not.toContain("rcv-resolve-quarantine");
  });
  it("격리는 aggregatedBlockers에 포함되지 않는다", () => {
    const surface = buildReceivingCommandSurface({ rb: batch([line({ documentStatus: "complete", lotRecords: [{ ...line().lotRecords[0], coaAttached: true, msdsAttached: true }] })]), onCompleteInspection: noop, onPostToInventory: noop });
    expect(surface.aggregatedBlockers).not.toContain("격리 품목 미해결");
  });
});
