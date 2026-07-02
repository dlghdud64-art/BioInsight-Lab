/**
 * §inbound-quarantine-temp-exclude — P1 canonical gate
 *
 * 격리(quarantine)·온도이탈(temperature_excursion)은 입고(receivingBatch) posting
 * 게이트에서 제외한다. 격리 lot도 재고반영을 차단하지 않는다.
 * (호영님 2026-07-02 결정, scope: 입고 surface만 — 2026-07-03)
 *
 * KEEP (범위 밖): stockPosition quarantine_constrained, lot-disposal, stock-release.
 * 이 테스트는 receivingBatch 게이트만 검증한다.
 */
import { describe, it, expect } from "vitest";
import type { ReceivingBatchContract } from "../../review-queue/receiving-inbound-contract";
import {
  resolveReceivingExecutionPhase,
  buildPostingReadiness,
} from "../receiving-detail-adapter";

// 격리 lot 하나만 blocker인 최소 배치. 문서/검수는 모두 통과 상태.
function quarantineOnlyBatch(): ReceivingBatchContract {
  return {
    id: "rb-test-q",
    workspaceId: "ws-test",
    receivingNumber: "RCV-TEST-Q",
    status: "arrived",
    sourceType: "purchase_order",
    poId: "po-test",
    vendorId: "vendor-test",
    shipToLocation: "test",
    receivedAt: new Date().toISOString(),
    receivedBy: "user-test",
    lineReceipts: [
      {
        id: "rlr-q",
        receivingBatchId: "rb-test-q",
        poLineId: "pol-q",
        lineNumber: 1,
        itemName: "Quarantine Item",
        manufacturer: "TestCo",
        catalogNumber: "Q-001",
        orderedQuantity: 5,
        receivedQuantity: 5,
        receivedUnit: "bottle",
        packSize: "100mL",
        receiptStatus: "received",
        conditionStatus: "temperature_excursion",
        documentStatus: "complete",
        inspectionRequired: false,
        inspectionStatus: "not_required",
        lotRecords: [
          {
            id: "lot-q",
            receivingLineReceiptId: "rlr-q",
            lotNumber: "LOT-Q-2026",
            expiryDate: new Date(Date.now() + 365 * 864e5).toISOString(),
            quantity: 5,
            unit: "bottle",
            storageCondition: "2-8C",
            coaAttached: true,
            msdsAttached: true,
            validationAttached: false,
            warrantyAttached: false,
            labelStatus: "ok",
            quarantineStatus: "quarantined",
          },
        ],
        riskFlags: [],
      },
    ],
  } as ReceivingBatchContract;
}

describe("§inbound-quarantine-temp-exclude — receivingBatch posting gate", () => {
  it("격리 lot이 입고 phase를 quarantine_active로 잠그지 않는다", () => {
    const phase = resolveReceivingExecutionPhase(quarantineOnlyBatch());
    expect(phase.phase).not.toBe("quarantine_active");
    // 다른 blocker가 없으므로 반영 준비 상태여야 한다
    expect(phase.phase).toBe("ready_to_post");
  });

  it("격리 품목이 posting readiness blocker에 포함되지 않는다", () => {
    const readiness = buildPostingReadiness(quarantineOnlyBatch());
    expect(readiness.blockers).not.toContain("격리 품목 미해결");
    expect(readiness.readiness).toBe("ready");
  });
});

describe("§inbound-quarantine-temp-exclude — 회귀 보호 (기존 게이트 유지)", () => {
  it("문서 누락은 여전히 posting을 차단한다", () => {
    const b = quarantineOnlyBatch();
    b.lineReceipts[0].documentStatus = "missing";
    const readiness = buildPostingReadiness(b);
    expect(readiness.blockers).toContain("문서 미첨부 라인 존재");
  });

  it("검수 미완료는 여전히 posting을 차단한다", () => {
    const b = quarantineOnlyBatch();
    b.lineReceipts[0].inspectionRequired = true;
    b.lineReceipts[0].inspectionStatus = "pending";
    const readiness = buildPostingReadiness(b);
    expect(readiness.blockers).toContain("검수 미완료 라인 존재");
  });
});
