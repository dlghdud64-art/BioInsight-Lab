/**
 * quote-workqueue × vendor-response merge helper 테스트
 *
 * 검증 포인트:
 * - VRM1: inbox에 일치 supplier가 있으면 responseStatus/quoteReceivedFlag 반영
 * - VRM2: 다른 case의 response는 무시
 * - VRM3: 이미 ready_for_compare 상태인 row는 downgrade 되지 않음
 * - VRM4: 동일 pair 다중 response면 최신 receivedAt만 반영
 * - VRM5: latestReceivedAt / updatedCount 출력 정확성
 * - VRM6: 입력 rows는 변형되지 않음 (immutability)
 */

import { mergeVendorResponsesIntoWorkqueueRows } from "../quote-workqueue-vendor-response-merge";
import type { QuoteWorkqueueRow } from "../quote-workqueue-engine";
import type { SupplierQuoteResponse } from "@/lib/procurement/procurement-case";

function makeRow(overrides: Partial<QuoteWorkqueueRow> = {}): QuoteWorkqueueRow {
  return {
    rowId: "qrow_test",
    vendorTargetId: "v1",
    vendorDisplayName: "v1",
    responseStatus: "no_response",
    quoteReceivedFlag: false,
    quoteLineCoverageCount: 0,
    missingLineCount: 3,
    normalizationStatus: "not_needed",
    compareReadinessStatus: "not_ready",
    lastUpdatedAt: null,
    nextAction: "응답 대기 중",
    ...overrides,
  };
}

function makeResponse(
  overrides: Partial<SupplierQuoteResponse> = {},
): SupplierQuoteResponse {
  return {
    procurementCaseId: "pc_001",
    supplierId: "v1",
    supplierName: "BioReagent Korea",
    responseStatus: "received",
    quotedTotal: 1_200_000,
    quotedUnitPrices: [],
    leadTimeDays: 7,
    substituteOffered: null,
    termsNotes: null,
    attachments: [],
    receivedAt: "2026-04-06T09:00:00.000Z",
    ...overrides,
  };
}

describe("mergeVendorResponsesIntoWorkqueueRows", () => {
  test("VRM1: supplier 매칭 시 responseStatus/quoteReceivedFlag 반영", () => {
    const rows = [makeRow({ vendorTargetId: "v1" })];
    const responses = [makeResponse({ supplierId: "v1" })];

    const result = mergeVendorResponsesIntoWorkqueueRows({
      rows,
      responses,
      procurementCaseId: "pc_001",
    });

    expect(result.updatedCount).toBe(1);
    expect(result.rows[0]!.responseStatus).toBe("quote_received");
    expect(result.rows[0]!.quoteReceivedFlag).toBe(true);
    expect(result.rows[0]!.vendorDisplayName).toBe("BioReagent Korea");
  });

  test("VRM2: 다른 case의 response는 무시", () => {
    const rows = [makeRow({ vendorTargetId: "v1" })];
    const responses = [
      makeResponse({ supplierId: "v1", procurementCaseId: "pc_999" }),
    ];

    const result = mergeVendorResponsesIntoWorkqueueRows({
      rows,
      responses,
      procurementCaseId: "pc_001",
    });

    expect(result.updatedCount).toBe(0);
    expect(result.rows[0]!.responseStatus).toBe("no_response");
    expect(result.rows[0]!.quoteReceivedFlag).toBe(false);
  });

  test("VRM3: 이미 ready_for_compare 이상인 row는 downgrade되지 않음", () => {
    const rows = [
      makeRow({
        vendorTargetId: "v1",
        responseStatus: "ready_for_compare",
        quoteReceivedFlag: true,
        compareReadinessStatus: "ready",
        nextAction: "비교 검토 대기",
      }),
    ];
    const responses = [makeResponse({ supplierId: "v1" })];

    const result = mergeVendorResponsesIntoWorkqueueRows({
      rows,
      responses,
      procurementCaseId: "pc_001",
    });

    // downgrade 없음
    expect(result.rows[0]!.responseStatus).toBe("ready_for_compare");
    expect(result.rows[0]!.compareReadinessStatus).toBe("ready");
    // nextAction도 그대로 유지
    expect(result.rows[0]!.nextAction).toBe("비교 검토 대기");
    // updatedCount는 증가하지 않음 (downgrade 차단)
    expect(result.updatedCount).toBe(0);
    // 관측성: lastUpdatedAt은 최신으로 갱신
    expect(result.rows[0]!.lastUpdatedAt).toBe("2026-04-06T09:00:00.000Z");
  });

  test("VRM4: 동일 pair 다중 response면 최신 receivedAt만 반영", () => {
    const rows = [makeRow({ vendorTargetId: "v1" })];
    const responses = [
      makeResponse({ supplierId: "v1", receivedAt: "2026-04-01T00:00:00.000Z" }),
      makeResponse({
        supplierId: "v1",
        receivedAt: "2026-04-05T00:00:00.000Z",
        supplierName: "BioReagent Korea v2",
      }),
      makeResponse({ supplierId: "v1", receivedAt: "2026-04-03T00:00:00.000Z" }),
    ];

    const result = mergeVendorResponsesIntoWorkqueueRows({
      rows,
      responses,
      procurementCaseId: "pc_001",
    });

    expect(result.updatedCount).toBe(1);
    expect(result.rows[0]!.vendorDisplayName).toBe("BioReagent Korea v2");
    expect(result.rows[0]!.lastUpdatedAt).toBe("2026-04-05T00:00:00.000Z");
  });

  test("VRM5: latestReceivedAt / updatedCount 출력 정확성", () => {
    const rows = [
      makeRow({ vendorTargetId: "v1" }),
      makeRow({ rowId: "qrow_v2", vendorTargetId: "v2", vendorDisplayName: "v2" }),
      makeRow({ rowId: "qrow_v3", vendorTargetId: "v3", vendorDisplayName: "v3" }),
    ];
    const responses = [
      makeResponse({ supplierId: "v1", receivedAt: "2026-04-06T09:00:00.000Z" }),
      makeResponse({
        supplierId: "v2",
        supplierName: "LabSupply Plus",
        receivedAt: "2026-04-07T12:00:00.000Z",
      }),
    ];

    const result = mergeVendorResponsesIntoWorkqueueRows({
      rows,
      responses,
      procurementCaseId: "pc_001",
    });

    expect(result.updatedCount).toBe(2);
    expect(result.latestReceivedAt).toBe("2026-04-07T12:00:00.000Z");
    // v3는 매칭이 없으므로 그대로
    expect(result.rows[2]!.responseStatus).toBe("no_response");
    expect(result.rows[2]!.quoteReceivedFlag).toBe(false);
  });

  test("VRM6: 입력 rows는 변형되지 않음 (immutability)", () => {
    const rows = [makeRow({ vendorTargetId: "v1" })];
    const rowsSnapshot = JSON.parse(JSON.stringify(rows));
    const responses = [makeResponse({ supplierId: "v1" })];

    mergeVendorResponsesIntoWorkqueueRows({
      rows,
      responses,
      procurementCaseId: "pc_001",
    });

    expect(rows).toEqual(rowsSnapshot);
  });
});
