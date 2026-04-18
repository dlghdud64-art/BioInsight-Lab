/**
 * Vendor Response Inbox — Tests
 *
 * VRI1-VRI5: vendor portal event → canonical SupplierQuoteResponse 매핑,
 * listener dedupe, case/supplier selector, inbox reset
 */

import {
  getGlobalGovernanceEventBus,
  resetGlobalGovernanceEventBus,
  createGovernanceEvent,
} from "@/lib/ai/governance-event-bus";
import {
  useVendorResponseInbox,
  mapVendorSubmitEventToResponse,
} from "../vendor-response-inbox";
import { emitVendorQuoteSubmitted } from "@/lib/vendor-portal/vendor-portal-events";

function resetAll() {
  useVendorResponseInbox.getState().reset();
  resetGlobalGovernanceEventBus();
  useVendorResponseInbox.getState().start();
}

describe("VendorResponseInbox", () => {
  beforeEach(() => {
    resetAll();
  });

  it("VRI1: vendor_quote_submitted 이벤트 → SupplierQuoteResponse 기록", () => {
    emitVendorQuoteSubmitted({
      procurementCaseId: "pc_test_1",
      vendorId: "v1",
      vendorName: "BioReagent Korea",
      quotedTotal: 1_500_000,
      leadTimeDays: 7,
    });

    const responses = useVendorResponseInbox.getState().responses;
    expect(responses).toHaveLength(1);

    const record = responses[0]!;
    expect(record.procurementCaseId).toBe("pc_test_1");
    expect(record.supplierId).toBe("v1");
    expect(record.supplierName).toBe("BioReagent Korea");
    expect(record.responseStatus).toBe("received");
    expect(record.quotedTotal).toBe(1_500_000);
    expect(record.leadTimeDays).toBe(7);
    expect(record.receivedAt).toBeTruthy();
  });

  it("VRI2: 동일 (case, supplier) 재제출 시 최신 record로 대체", () => {
    emitVendorQuoteSubmitted({
      procurementCaseId: "pc_test_2",
      vendorId: "v1",
      vendorName: "BioReagent Korea",
      quotedTotal: 1_000_000,
      leadTimeDays: 10,
    });
    emitVendorQuoteSubmitted({
      procurementCaseId: "pc_test_2",
      vendorId: "v1",
      vendorName: "BioReagent Korea",
      quotedTotal: 950_000,
      leadTimeDays: 5,
    });

    const responses = useVendorResponseInbox.getState().responses;
    expect(responses).toHaveLength(1);
    expect(responses[0]!.quotedTotal).toBe(950_000);
    expect(responses[0]!.leadTimeDays).toBe(5);
  });

  it("VRI3: getByCaseId / getBySupplierId selector", () => {
    emitVendorQuoteSubmitted({
      procurementCaseId: "pc_a",
      vendorId: "v1",
      vendorName: "V1",
      quotedTotal: 100,
      leadTimeDays: 3,
    });
    emitVendorQuoteSubmitted({
      procurementCaseId: "pc_a",
      vendorId: "v2",
      vendorName: "V2",
      quotedTotal: 200,
      leadTimeDays: 5,
    });
    emitVendorQuoteSubmitted({
      procurementCaseId: "pc_b",
      vendorId: "v1",
      vendorName: "V1",
      quotedTotal: 300,
      leadTimeDays: 4,
    });

    const inbox = useVendorResponseInbox.getState();
    expect(inbox.getByCaseId("pc_a")).toHaveLength(2);
    expect(inbox.getByCaseId("pc_b")).toHaveLength(1);
    expect(inbox.getBySupplierId("v1")).toHaveLength(2);
    expect(inbox.getBySupplierId("v2")).toHaveLength(1);
  });

  it("VRI4: 다른 eventType은 무시 (vendor_quote_acknowledged 등)", () => {
    const bus = getGlobalGovernanceEventBus();
    const ackEvent = createGovernanceEvent("quote_chain", "vendor_quote_acknowledged", {
      caseId: "pc_test_3",
      poNumber: "",
      fromStatus: "request_for_quote",
      toStatus: "request_for_quote",
      actor: "vendor:v1",
      detail: "ack",
    });
    bus.publish(ackEvent);

    expect(useVendorResponseInbox.getState().responses).toHaveLength(0);
  });

  it("VRI5: mapVendorSubmitEventToResponse — payload 누락 시 null-safe", () => {
    const event = createGovernanceEvent("quote_chain", "vendor_quote_submitted", {
      caseId: "pc_partial",
      poNumber: "",
      fromStatus: "request_for_quote",
      toStatus: "quote_received",
      actor: "vendor:v9",
      detail: "partial",
      // payload 없음
    });

    const record = mapVendorSubmitEventToResponse(event);
    expect(record.supplierId).toBe("v9");
    expect(record.supplierName).toBe("v9"); // vendorName 없으면 supplierId fallback
    expect(record.quotedTotal).toBeNull();
    expect(record.leadTimeDays).toBeNull();
    expect(record.responseStatus).toBe("received");
    expect(record.quotedUnitPrices).toEqual([]);
  });
});
