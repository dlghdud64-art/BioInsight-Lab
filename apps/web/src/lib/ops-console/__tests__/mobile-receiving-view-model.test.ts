import { describe, it, expect } from "vitest";
import {
  buildMobileReceivingCard,
  buildMobileReceivingSummary,
} from "@/lib/ops-console/mobile-receiving-view-model";
import type {
  ReceivingBatchContract,
  ReceivingLineReceiptContract,
  ReceivedLotRecordContract,
} from "@/lib/review-queue/receiving-inbound-contract";

/**
 * §mobile-receiving-rcv-card Phase 1 — RCV 단위 뷰모델 unit.
 * 핸드오프(모바일 입고 관리): RCV 1건 = 카드 1장 + blockers[](문서 → 보류 → 검수),
 *   해결 순서·의존 게이트·해결 시 소멸·KPI 단일 소스 검증.
 */

const NOW = "2026-07-26T00:00:00.000Z";
const RECENT = "2026-07-25T20:00:00.000Z"; // 4h 전 (SLA 24h 이내)
const OLD = "2026-07-24T00:00:00.000Z"; // 48h 전 (초과)

function lot(over: Partial<ReceivedLotRecordContract> = {}): ReceivedLotRecordContract {
  return {
    id: "lot-1",
    receivingLineReceiptId: "line-1",
    lotNumber: "L-001",
    quantity: 10,
    unit: "EA",
    coaAttached: false,
    msdsAttached: false,
    validationAttached: false,
    warrantyAttached: false,
    labelStatus: "ok",
    quarantineStatus: "not_applicable",
    ...over,
  };
}

function line(over: Partial<ReceivingLineReceiptContract> = {}): ReceivingLineReceiptContract {
  return {
    id: "line-1",
    receivingBatchId: "rb-1",
    lineNumber: 1,
    itemName: "Sodium Chloride",
    receivedQuantity: 10,
    receivedUnit: "EA",
    receiptStatus: "received",
    conditionStatus: "ok",
    documentStatus: "complete",
    inspectionRequired: false,
    inspectionStatus: "not_required",
    lotRecords: [lot({ coaAttached: true, msdsAttached: true })],
    riskFlags: [],
    ...over,
  };
}

function batch(over: Partial<ReceivingBatchContract> = {}): ReceivingBatchContract {
  return {
    id: "rb-1",
    workspaceId: "ws-1",
    receivingNumber: "RCV-2026-0031",
    status: "received",
    sourceType: "purchase_order",
    shipToLocation: "본원 창고",
    receivedAt: RECENT,
    receivedBy: "user-1",
    lineReceipts: [line()],
    ...over,
  };
}

describe("§mobile-receiving-rcv-card P1 — blocker 파생·순서·의존", () => {
  it("blocker 전무 → ready, blockers=[]", () => {
    const card = buildMobileReceivingCard(batch(), NOW);
    expect(card.status).toBe("ready");
    expect(card.blockers).toHaveLength(0);
    expect(card.blockerCount).toBe(0);
  });

  it("문서·보류·검수 3중 → 순서(doc → quarantine → inspection)", () => {
    const card = buildMobileReceivingCard(
      batch({
        lineReceipts: [
          line({
            documentStatus: "missing",
            inspectionRequired: true,
            inspectionStatus: "pending",
            lotRecords: [lot({ quarantineStatus: "quarantined" })],
          }),
        ],
      }),
      NOW,
    );
    expect(card.status).toBe("blocked");
    expect(card.blockers.map((b) => b.kind)).toEqual(["doc", "quarantine", "inspection"]);
    expect(card.blockerCount).toBe(3);
  });

  it("검수 줄 — 선행(문서/보류) 미해결 시 dependsOnUnresolved=true", () => {
    const card = buildMobileReceivingCard(
      batch({
        lineReceipts: [
          line({
            documentStatus: "missing",
            inspectionRequired: true,
            inspectionStatus: "pending",
            lotRecords: [lot()],
          }),
        ],
      }),
      NOW,
    );
    const insp = card.blockers.find((b) => b.kind === "inspection");
    expect(insp?.dependsOnUnresolved).toBe(true);
  });

  it("검수 줄 — 선행 없이 검수만 남으면 dependsOnUnresolved=false(실행 가능)", () => {
    const card = buildMobileReceivingCard(
      batch({
        lineReceipts: [
          line({
            documentStatus: "complete",
            inspectionRequired: true,
            inspectionStatus: "pending",
            lotRecords: [lot({ coaAttached: true, msdsAttached: true })],
          }),
        ],
      }),
      NOW,
    );
    expect(card.blockers.map((b) => b.kind)).toEqual(["inspection"]);
    expect(card.blockers[0].dependsOnUnresolved).toBe(false);
  });

  it("검수 passed/failed = 종료 → blocker 아님(라이브 전이 정합)", () => {
    for (const s of ["passed", "failed"] as const) {
      const card = buildMobileReceivingCard(
        batch({
          lineReceipts: [line({ inspectionRequired: true, inspectionStatus: s })],
        }),
        NOW,
      );
      expect(card.blockers.some((b) => b.kind === "inspection")).toBe(false);
    }
  });

  it("문서 해결 시 doc 줄 소멸 + 검수 게이트 해제", () => {
    const resolved = buildMobileReceivingCard(
      batch({
        lineReceipts: [
          line({
            documentStatus: "complete",
            inspectionRequired: true,
            inspectionStatus: "pending",
            lotRecords: [lot({ coaAttached: true, msdsAttached: true })],
          }),
        ],
      }),
      NOW,
    );
    expect(resolved.blockers.some((b) => b.kind === "doc")).toBe(false);
    expect(resolved.blockers.find((b) => b.kind === "inspection")?.dependsOnUnresolved).toBe(false);
  });
});

describe("§mobile-receiving-rcv-card P1 — missingDocs 프리셋(첨부 시트 컨텍스트)", () => {
  it("missing/partial 라인의 미첨부 문서 종류 산출", () => {
    const card = buildMobileReceivingCard(
      batch({
        lineReceipts: [
          line({
            id: "line-A",
            lineNumber: 2,
            itemName: "Tris Buffer",
            documentStatus: "partial",
            lotRecords: [lot({ id: "lotA", coaAttached: true, msdsAttached: false })],
          }),
        ],
      }),
      NOW,
    );
    expect(card.missingDocs).toEqual([
      { lineId: "line-A", lineNumber: 2, lineName: "Tris Buffer", missingTypes: ["msds"] },
    ]);
  });

  it("not_required·complete 라인은 missingDocs 제외", () => {
    const card = buildMobileReceivingCard(
      batch({
        lineReceipts: [
          line({ documentStatus: "complete", lotRecords: [lot({ coaAttached: true, msdsAttached: true })] }),
          line({ id: "l2", documentStatus: "not_required", lotRecords: [] }),
        ],
      }),
      NOW,
    );
    expect(card.missingDocs).toHaveLength(0);
    expect(card.blockers).toHaveLength(0);
  });
});

describe("§mobile-receiving-rcv-card P1 — summary 필터·정렬·KPI 단일 소스", () => {
  it("expected(도착 전)·posted/closed/cancelled 제외", () => {
    const s = buildMobileReceivingSummary(
      [
        batch({ id: "a", status: "expected" }),
        batch({ id: "b", status: "posted" }),
        batch({ id: "c", status: "closed" }),
        batch({ id: "d", status: "cancelled" }),
        batch({ id: "e", status: "received" }),
      ],
      NOW,
    );
    expect(s.cards.map((c) => c.id)).toEqual(["e"]);
  });

  it("정렬: blocked 먼저 → overdue 우선 → 오래된 순", () => {
    const blockedOld = batch({
      id: "blkOld",
      receivedAt: OLD,
      lineReceipts: [line({ documentStatus: "missing", lotRecords: [lot()] })],
    });
    const blockedRecent = batch({
      id: "blkRecent",
      receivedAt: RECENT,
      lineReceipts: [line({ documentStatus: "missing", lotRecords: [lot()] })],
    });
    const ready = batch({ id: "ready", receivedAt: OLD });
    const s = buildMobileReceivingSummary([ready, blockedRecent, blockedOld], NOW);
    expect(s.cards.map((c) => c.id)).toEqual(["blkOld", "blkRecent", "ready"]);
  });

  it("KPI 카운트 = cards 파생 동일 소스", () => {
    const s = buildMobileReceivingSummary(
      [
        batch({ id: "b1", lineReceipts: [line({ documentStatus: "missing", lotRecords: [lot()] })] }),
        batch({ id: "b2", lineReceipts: [line({ documentStatus: "missing", lotRecords: [lot()] })] }),
        batch({ id: "r1" }),
      ],
      NOW,
    );
    expect(s.blockedCount).toBe(2);
    expect(s.readyCount).toBe(1);
    expect(s.blockedCount).toBe(s.cards.filter((c) => c.status === "blocked").length);
    expect(s.readyCount).toBe(s.cards.filter((c) => c.status === "ready").length);
  });

  it("overdue 파생 — 24h 초과 여부", () => {
    expect(buildMobileReceivingCard(batch({ receivedAt: OLD }), NOW).isOverdue).toBe(true);
    expect(buildMobileReceivingCard(batch({ receivedAt: RECENT }), NOW).isOverdue).toBe(false);
  });
});
