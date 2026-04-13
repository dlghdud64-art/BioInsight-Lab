// @ts-nocheck — vitest/jest 미설치 환경에서 타입 체크 bypass
/**
 * PO → Dispatch Governance Tests
 *
 * 8 scenarios:
 * S1: Complete input → ready_to_send
 * S2: Missing supplier email → hard blocked
 * S3: Snapshot invalidated → blocked + reapproval badge
 * S4: Missing required document → hard blocked
 * S5: Data changed after approval → hard blocked
 * S6: Soft blockers only → needs_review
 * S7: Confirmation checklist → required items tracked
 * S8: Policy surface maps readiness correctly
 */

import { describe, it, expect } from "vitest";
import {
  evaluateDispatchGovernance,
  buildDispatchPolicySurface,
  type DispatchGovernanceInput,
} from "../po-dispatch-governance-engine";

function makeInput(overrides: Partial<DispatchGovernanceInput> = {}): DispatchGovernanceInput {
  return {
    caseId: "case_1", poNumber: "PO-001",
    approvalSnapshotValid: true, conversionSnapshotValid: true, snapshotInvalidationReason: "",
    supplierContactEmail: "vendor@example.com", supplierContactName: "Vendor Kim",
    shippingAddress: "Seoul Lab, 123 Science Rd", billingAddress: "Seoul HQ, 456 Finance St",
    paymentTerms: "Net 30", deliveryTerms: "FOB Origin",
    requiredDocuments: ["spec_sheet"], attachedDocuments: ["spec_sheet"],
    policyHoldActive: false, policyHoldReason: "",
    dataChangedAfterApproval: false, changeDetails: [],
    supplierProfileChanged: false, supplierProfileChangeDetail: "",
    lockedFields: ["vendorId", "lineItems", "totalAmount"],
    actor: "op_1",
    ...overrides,
  };
}

describe("PO → Dispatch Governance", () => {

  it("S1: complete input → ready_to_send", () => {
    const state = evaluateDispatchGovernance(makeInput());
    expect(state.readiness).toBe("ready_to_send");
    expect(state.hardBlockers.length).toBe(0);
    expect(state.allConfirmed).toBe(true);

    const surface = buildDispatchPolicySurface(state);
    expect(surface.statusBadge).toBe("allowed");
    expect(surface.primaryMessage).toContain("발송 준비 완료");
  });

  it("S2: missing supplier email → blocked", () => {
    const state = evaluateDispatchGovernance(makeInput({ supplierContactEmail: "" }));
    expect(state.readiness).toBe("blocked");
    expect(state.hardBlockers.some(b => b.type === "shipping_contact_incomplete")).toBe(true);

    const surface = buildDispatchPolicySurface(state);
    expect(surface.statusBadge).toBe("blocked");
  });

  it("S3: snapshot invalidated → blocked + reapproval", () => {
    const state = evaluateDispatchGovernance(makeInput({
      approvalSnapshotValid: false,
      snapshotInvalidationReason: "Policy drift detected",
    }));
    expect(state.readiness).toBe("blocked");
    expect(state.hardBlockers.some(b => b.type === "snapshot_invalidated")).toBe(true);

    const surface = buildDispatchPolicySurface(state);
    expect(surface.statusBadge).toBe("reapproval_needed");
    expect(surface.statusColor).toBe("red");
  });

  it("S4: missing required document → blocked", () => {
    const state = evaluateDispatchGovernance(makeInput({
      requiredDocuments: ["spec_sheet", "msds"],
      attachedDocuments: ["spec_sheet"], // msds missing
    }));
    expect(state.readiness).toBe("blocked");
    expect(state.hardBlockers.some(b => b.type === "required_document_missing")).toBe(true);
    expect(state.hardBlockers.find(b => b.type === "required_document_missing")!.detail).toContain("msds");
  });

  it("S5: data changed after approval → blocked", () => {
    const state = evaluateDispatchGovernance(makeInput({
      dataChangedAfterApproval: true,
      changeDetails: ["unitPrice changed from 10000 to 12000"],
    }));
    expect(state.readiness).toBe("blocked");
    expect(state.hardBlockers.some(b => b.type === "po_data_changed_after_approval")).toBe(true);
  });

  it("S6: soft blockers only → needs_review", () => {
    const state = evaluateDispatchGovernance(makeInput({
      billingAddress: "", // soft
      deliveryTerms: "", // soft
      supplierProfileChanged: true, supplierProfileChangeDetail: "Address updated",
    }));
    expect(state.readiness).toBe("needs_review");
    expect(state.hardBlockers.length).toBe(0);
    expect(state.softBlockers.length).toBeGreaterThan(0);

    const surface = buildDispatchPolicySurface(state);
    expect(surface.statusBadge).toBe("approval_needed");
    expect(surface.statusColor).toBe("amber");
  });

  it("S7: confirmation checklist tracks required items", () => {
    const state = evaluateDispatchGovernance(makeInput());
    const requiredItems = state.confirmationChecklist.filter(c => c.required);
    expect(requiredItems.length).toBeGreaterThan(0);
    // All required confirmed in complete input
    expect(requiredItems.every(c => c.confirmed)).toBe(true);
    expect(state.allConfirmed).toBe(true);

    // With missing email → checklist item unchecked
    const blocked = evaluateDispatchGovernance(makeInput({ supplierContactEmail: "" }));
    const contactItem = blocked.confirmationChecklist.find(c => c.key === "supplier_contact");
    expect(contactItem!.confirmed).toBe(false);
    expect(blocked.allConfirmed).toBe(false);
  });

  it("S8: locked vs editable fields separated correctly", () => {
    const state = evaluateDispatchGovernance(makeInput());
    expect(state.lockedFields).toContain("vendorId");
    expect(state.lockedFields).toContain("totalAmount");
    expect(state.editableFields).toContain("billingAddress");
    expect(state.editableFields).toContain("deliveryTerms");
    // Locked and editable should not overlap
    const overlap = state.lockedFields.filter(f => state.editableFields.includes(f));
    expect(overlap.length).toBe(0);
  });
});
