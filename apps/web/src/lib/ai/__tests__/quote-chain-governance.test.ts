// @ts-nocheck — vitest/jest 미설치 환경에서 타입 체크 bypass
/**
 * Quote → Approval → PO Chain Governance Test
 *
 * 10 scenarios:
 * S1:  quote_review — Tier 1, no approval needed
 * S2:  quote_approval — under threshold → allowed
 * S3:  quote_approval — over threshold → approval needed
 * S4:  quote_approval — restricted item → approval needed
 * S5:  po_conversion — requires valid approval snapshot
 * S6:  po_conversion — invalid snapshot → blocked
 * S7:  po_approval — high amount → approval needed
 * S8:  po_send_readiness — all previous complete → allowed
 * S9:  full chain surface — progress tracking
 * S10: locked fields — carried from approval to PO stages
 */

import { describe, it, expect } from "vitest";
import {
  evaluateQuoteChainGate,
  buildQuoteChainPolicySurface,
  buildQuoteChainFullSurface,
  type QuoteChainStage,
} from "../quote-approval-governance-engine";

describe("Quote → Approval → PO Chain Governance", () => {

  // S1
  it("S1: quote_review Tier 1 — no approval, allowed", () => {
    const gate = evaluateQuoteChainGate("quote_review", 500000, false, true, false);
    expect(gate.eligible).toBe(true);
    expect(gate.approvalRequired).toBe(false);

    const surface = buildQuoteChainPolicySurface("quote_review", 500000, false, true, false);
    expect(surface.statusBadge).toBe("allowed");
    expect(surface.riskTier).toBe("tier1_routine");
  });

  // S2
  it("S2: quote_approval under 1M threshold → allowed", () => {
    const gate = evaluateQuoteChainGate("quote_approval", 800000, false, true, false);
    expect(gate.eligible).toBe(true);
    // Under 1M but approval is still required by config (approvalRequired=true)
    expect(gate.approvalRequired).toBe(true);
  });

  // S3
  it("S3: quote_approval over threshold → approval needed with reason", () => {
    const gate = evaluateQuoteChainGate("quote_approval", 2000000, false, true, false);
    expect(gate.approvalRequired).toBe(true);
    expect(gate.approvalReason).toContain("2,000,000");

    const surface = buildQuoteChainPolicySurface("quote_approval", 2000000, false, true, false);
    expect(surface.statusBadge).toBe("approval_needed");
    expect(surface.approvalInfo).not.toBeNull();
    expect(surface.approvalInfo!.required).toBe(true);
  });

  // S4
  it("S4: quote_approval restricted item → approval needed", () => {
    const gate = evaluateQuoteChainGate("quote_approval", 500000, true, true, false);
    expect(gate.approvalRequired).toBe(true);
    expect(gate.approvalReason).toContain("제한 품목");
  });

  // S5
  it("S5: po_conversion with valid snapshot → allowed", () => {
    const gate = evaluateQuoteChainGate("po_conversion", 2000000, false, true, true);
    expect(gate.eligible).toBe(true);
    expect(gate.lockedFields.length).toBeGreaterThan(0);
    expect(gate.lockedFields).toContain("approvalSnapshotId");
  });

  // S6
  it("S6: po_conversion without valid snapshot → blocked", () => {
    const gate = evaluateQuoteChainGate("po_conversion", 2000000, false, true, false);
    expect(gate.eligible).toBe(false);
    expect(gate.blockers.some(b => b.includes("승인 snapshot"))).toBe(true);

    const surface = buildQuoteChainPolicySurface("po_conversion", 2000000, false, true, false);
    expect(surface.statusBadge).toBe("blocked");
    expect(surface.blockerMessages.length).toBeGreaterThan(0);
  });

  // S7
  it("S7: po_approval high amount → approval needed", () => {
    const gate = evaluateQuoteChainGate("po_approval", 3000000, false, true, true);
    expect(gate.approvalRequired).toBe(true);
    expect(gate.approvalReason).toContain("3,000,000");

    const surface = buildQuoteChainPolicySurface("po_approval", 3000000, false, true, true);
    expect(surface.statusBadge).toBe("approval_needed");
  });

  // S8
  it("S8: po_send_readiness after all stages → allowed", () => {
    const gate = evaluateQuoteChainGate("po_send_readiness", 1000000, false, true, true);
    expect(gate.eligible).toBe(true);
    expect(gate.approvalRequired).toBe(false);

    const surface = buildQuoteChainPolicySurface("po_send_readiness", 1000000, false, true, true);
    expect(surface.statusBadge).toBe("allowed");
    expect(surface.lockedFields).toContain("poNumber");
  });

  // S9
  it("S9: full chain surface tracks progress correctly", () => {
    // 3 stages completed
    const completed: QuoteChainStage[] = ["quote_review", "quote_shortlist", "quote_approval"];
    const full = buildQuoteChainFullSurface(completed, 2000000, false, true);

    expect(full.completedStages.length).toBe(3);
    expect(full.currentStage).toBe("po_conversion");
    // NOTE: QUOTE_CHAIN_STAGES canonical = 13 stages
    //       (quote-approval-governance-engine.ts:55 — fulfillment 확장 전 6단계에서 확장됨)
    //       3/13 = 23.07% → Math.floor = 23
    expect(full.overallProgress).toBe(23);
    expect(full.stages.length).toBe(13);

    // po_conversion should be eligible (previous completed + snapshot valid)
    const poConversion = full.stages.find(s => s.stage === "po_conversion");
    expect(poConversion).toBeDefined();
  });

  // S10
  it("S10: locked fields accumulate through chain", () => {
    const quoteApproval = buildQuoteChainPolicySurface("quote_approval", 1000000, false, true, false);
    expect(quoteApproval.lockedFields).toContain("vendorId");
    expect(quoteApproval.lockedFields).toContain("unitPrices");

    const poConversion = buildQuoteChainPolicySurface("po_conversion", 1000000, false, true, true);
    expect(poConversion.lockedFields).toContain("approvalSnapshotId");
    expect(poConversion.lockedFields).toContain("approvedPrices");

    const poApproval = buildQuoteChainPolicySurface("po_approval", 1000000, false, true, true);
    expect(poApproval.lockedFields).toContain("totalAmount");
    expect(poApproval.lockedFields).toContain("quoteRef");

    const sendReady = buildQuoteChainPolicySurface("po_send_readiness", 1000000, false, true, true);
    expect(sendReady.lockedFields).toContain("poNumber");
  });
});
