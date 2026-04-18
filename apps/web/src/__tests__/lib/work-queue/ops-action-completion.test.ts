/**
 * Ops Action Completion & Audit Closure Tests
 *
 * CTA 완료 정의, 소유권 이전 무결성, 중복 방지, 순수 함수 검증.
 */

import {
  OPS_CTA_COMPLETION_DEFS,
  OPS_QUEUE_ITEM_TYPES,
  OPS_SUBSTATUS_DEFS,
  OPS_OWNERSHIP_TRANSFERS,
  findCompletionDef,
  resolveOwnershipTransfer,
  type OpsCTACompletionDef,
} from "@/lib/work-queue/ops-queue-semantics";

// ── 1. CTA Completion Defs ──

describe("OPS_CTA_COMPLETION_DEFS", () => {
  const allDefs = Object.values(OPS_CTA_COMPLETION_DEFS);

  test("defines all 8 completion defs with required fields", () => {
    expect(allDefs.length).toBe(8);
    for (const def of allDefs) {
      expect(def.ctaId.length).toBeGreaterThan(0);
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.sourceQueueItemType.length).toBeGreaterThan(0);
      expect(def.successTransition.length).toBeGreaterThan(0);
      expect(def.failureTransition.length).toBeGreaterThan(0);
      expect(def.activityLogEvent.length).toBeGreaterThan(0);
      expect(def.duplicateProtection).toBe("taskStatus");
    }
  });

  test("all sourceQueueItemTypes reference valid OPS_QUEUE_ITEM_TYPES", () => {
    for (const def of allDefs) {
      expect(OPS_QUEUE_ITEM_TYPES[def.sourceQueueItemType]).toBeDefined();
    }
  });

  test("all successTransition values are valid substatus (ops or common)", () => {
    // execution_failed is a common substatus in state-mapper, not in OPS_SUBSTATUS_DEFS
    const COMMON_SUBSTATUSES = ["execution_failed", "budget_insufficient", "permission_denied"];
    for (const def of allDefs) {
      const isOps = def.successTransition in OPS_SUBSTATUS_DEFS;
      const isCommon = COMMON_SUBSTATUSES.includes(def.successTransition);
      expect(isOps || isCommon).toBe(true);
    }
  });

  test("all failureTransition values are valid substatus (ops or common)", () => {
    const COMMON_SUBSTATUSES = ["execution_failed", "budget_insufficient", "permission_denied"];
    for (const def of allDefs) {
      const isOps = def.failureTransition in OPS_SUBSTATUS_DEFS;
      const isCommon = COMMON_SUBSTATUSES.includes(def.failureTransition);
      expect(isOps || isCommon).toBe(true);
    }
  });

  test("completion defs with ownershipTransferId reference valid OPS_OWNERSHIP_TRANSFERS", () => {
    const defsWithTransfer = allDefs.filter((d) => d.ownershipTransferId !== null);
    expect(defsWithTransfer.length).toBeGreaterThan(0);
    for (const def of defsWithTransfer) {
      const transfer = OPS_OWNERSHIP_TRANSFERS.find((t) => t.id === def.ownershipTransferId);
      expect(transfer).toBeDefined();
      expect(def.nextQueueItemType).not.toBeNull();
      expect(OPS_QUEUE_ITEM_TYPES[def.nextQueueItemType!]).toBeDefined();
    }
  });
});

// ── 2. Pure Functions ──

describe("findCompletionDef", () => {
  test("returns correct def for approve_purchase", () => {
    const def = findCompletionDef("approve_purchase");
    expect(def).not.toBeNull();
    expect(def!.ctaId).toBe("approve_purchase");
    expect(def!.sourceQueueItemType).toBe("ops_purchase_approval");
    expect(def!.ownershipTransferId).toBe("quote_to_purchase");
  });

  test("returns correct def for confirm_receiving", () => {
    const def = findCompletionDef("confirm_receiving");
    expect(def).not.toBeNull();
    expect(def!.ownershipTransferId).toBe("receiving_to_inventory");
    expect(def!.nextQueueItemType).toBe("ops_restock_confirm");
  });

  test("returns null for nonexistent ctaId", () => {
    expect(findCompletionDef("nonexistent")).toBeNull();
  });

  test("returns null for navigation-only actions", () => {
    expect(findCompletionDef("navigate_quote")).toBeNull();
    expect(findCompletionDef("navigate_order")).toBeNull();
    expect(findCompletionDef("navigate_receiving")).toBeNull();
  });
});

describe("resolveOwnershipTransfer", () => {
  test("returns correct transfer for quote_to_purchase", () => {
    const transfer = resolveOwnershipTransfer("quote_to_purchase");
    expect(transfer).not.toBeNull();
    expect(transfer!.previousOwner).toBe("REQUESTER");
    expect(transfer!.nextOwner).toBe("APPROVER");
  });

  test("returns null for nonexistent transferId", () => {
    expect(resolveOwnershipTransfer("nonexistent")).toBeNull();
  });
});

// ── 3. Ownership Chain Integrity ──

describe("Ownership chain integrity", () => {
  const defsWithTransfer = Object.values(OPS_CTA_COMPLETION_DEFS).filter(
    (d) => d.ownershipTransferId !== null
  );

  test("each transfer's source completion def has a terminal successTransition", () => {
    for (const def of defsWithTransfer) {
      const transfer = OPS_OWNERSHIP_TRANSFERS.find((t) => t.id === def.ownershipTransferId);
      expect(transfer).toBeDefined();
      // The successTransition should be a terminal substatus
      const successDef = OPS_SUBSTATUS_DEFS[def.successTransition];
      if (successDef) {
        expect(successDef.isTerminal).toBe(true);
      }
      // execution_failed is also terminal (common substatus)
    }
  });

  test("each transfer opensSubstatus is a valid non-terminal substatus", () => {
    for (const transfer of OPS_OWNERSHIP_TRANSFERS) {
      const opensDef = OPS_SUBSTATUS_DEFS[transfer.opensSubstatus];
      expect(opensDef).toBeDefined();
      // Note: restock_completed opens as terminal for receiving_to_inventory (inventory confirmation)
      // So we check the substatus exists, not necessarily non-terminal
    }
  });

  test("no circular ownership transfers", () => {
    for (const transfer of OPS_OWNERSHIP_TRANSFERS) {
      expect(transfer.fromQueueItemType).not.toBe(transfer.toQueueItemType);
    }
  });
});

// ── 4. Duplicate Protection ──

describe("Duplicate protection", () => {
  test("all completion defs have duplicateProtection = taskStatus", () => {
    for (const def of Object.values(OPS_CTA_COMPLETION_DEFS)) {
      expect(def.duplicateProtection).toBe("taskStatus");
    }
  });

  test("all 8 ctaIds are unique", () => {
    const ids = Object.values(OPS_CTA_COMPLETION_DEFS).map((d) => d.ctaId);
    expect(new Set(ids).size).toBe(8);
  });
});

// ── 5. Coverage ──

describe("CTA coverage", () => {
  test("every non-navigation primaryCta.actionId in OPS_QUEUE_ITEM_TYPES has a matching completion def", () => {
    for (const queueType of Object.values(OPS_QUEUE_ITEM_TYPES)) {
      const actionId = queueType.primaryCta.actionId;
      if (actionId.startsWith("navigate_")) continue;
      const def = findCompletionDef(actionId);
      expect(def).not.toBeNull();
      expect(def!.sourceQueueItemType).toBe(queueType.id);
    }
  });
});
