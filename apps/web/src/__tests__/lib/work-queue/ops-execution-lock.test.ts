/**
 * Ops Execution Lock Tests
 *
 * 운영 큐 실행 표면 검증: 큐 아이템 타입, 소유권 이전, CTA 매핑, 상태 결정 함수.
 */

import {
  OPS_QUEUE_ITEM_TYPES,
  OPS_QUEUE_CTA_MAP,
  OPS_OWNERSHIP_TRANSFERS,
  OPS_SUBSTATUS_DEFS,
  determineOpsQueueItemType,
  type OpsQueueItemTypeInput,
} from "@/lib/work-queue/ops-queue-semantics";

// ── 1. OPS_QUEUE_ITEM_TYPES ──

describe("OPS_QUEUE_ITEM_TYPES", () => {
  const expectedTypes = [
    "ops_quote_followup",
    "ops_purchase_approval",
    "ops_order_tracking",
    "ops_receiving_pending",
    "ops_receiving_issue",
    "ops_restock_confirm",
    "ops_stalled_handoff",
  ];

  test("defines all 7 canonical queue item types", () => {
    for (const typeId of expectedTypes) {
      expect(OPS_QUEUE_ITEM_TYPES[typeId]).toBeDefined();
    }
    expect(Object.keys(OPS_QUEUE_ITEM_TYPES).length).toBe(7);
  });

  test("all types have required fields: id, label, meaning, stage, owner, primaryCta", () => {
    for (const [key, def] of Object.entries(OPS_QUEUE_ITEM_TYPES)) {
      expect(def.id).toBe(key);
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.meaning.length).toBeGreaterThan(0);
      expect(["quote", "order", "receiving", "inventory"]).toContain(def.stage);
      expect(["REQUESTER", "APPROVER", "OPERATOR"]).toContain(def.owner);
      expect(def.primaryCta.label.length).toBeGreaterThan(0);
      expect(def.primaryCta.actionId.length).toBeGreaterThan(0);
      expect(["default", "destructive", "outline"]).toContain(def.primaryCta.variant);
    }
  });

  test("all non-stall types have valid sourceEntityType", () => {
    const validEntityTypes = ["QUOTE", "PURCHASE_REQUEST", "ORDER", "INVENTORY_RESTOCK", "MIXED"];
    for (const def of Object.values(OPS_QUEUE_ITEM_TYPES)) {
      expect(validEntityTypes).toContain(def.sourceEntityType);
    }
  });
});

// ── 2. determineOpsQueueItemType ──

describe("determineOpsQueueItemType", () => {
  test("Quote SENT → ops_quote_followup", () => {
    const input: OpsQueueItemTypeInput = { entityType: "QUOTE", quoteStatus: "SENT" };
    expect(determineOpsQueueItemType(input)).toBe("ops_quote_followup");
  });

  test("Quote RESPONDED → ops_quote_followup", () => {
    const input: OpsQueueItemTypeInput = { entityType: "QUOTE", quoteStatus: "RESPONDED" };
    expect(determineOpsQueueItemType(input)).toBe("ops_quote_followup");
  });

  test("Quote COMPLETED → null (terminal, no queue item)", () => {
    const input: OpsQueueItemTypeInput = { entityType: "QUOTE", quoteStatus: "COMPLETED" };
    expect(determineOpsQueueItemType(input)).toBeNull();
  });

  test("PurchaseRequest PENDING → ops_purchase_approval", () => {
    const input: OpsQueueItemTypeInput = { entityType: "PURCHASE_REQUEST", purchaseRequestStatus: "PENDING" };
    expect(determineOpsQueueItemType(input)).toBe("ops_purchase_approval");
  });

  test("PurchaseRequest APPROVED → null (terminal)", () => {
    const input: OpsQueueItemTypeInput = { entityType: "PURCHASE_REQUEST", purchaseRequestStatus: "APPROVED" };
    expect(determineOpsQueueItemType(input)).toBeNull();
  });

  test("Order ORDERED → ops_order_tracking", () => {
    const input: OpsQueueItemTypeInput = { entityType: "ORDER", orderStatus: "ORDERED" };
    expect(determineOpsQueueItemType(input)).toBe("ops_order_tracking");
  });

  test("Order CONFIRMED → ops_order_tracking", () => {
    const input: OpsQueueItemTypeInput = { entityType: "ORDER", orderStatus: "CONFIRMED" };
    expect(determineOpsQueueItemType(input)).toBe("ops_order_tracking");
  });

  test("Order SHIPPING → ops_order_tracking", () => {
    const input: OpsQueueItemTypeInput = { entityType: "ORDER", orderStatus: "SHIPPING" };
    expect(determineOpsQueueItemType(input)).toBe("ops_order_tracking");
  });

  test("Order DELIVERED → null (terminal)", () => {
    const input: OpsQueueItemTypeInput = { entityType: "ORDER", orderStatus: "DELIVERED" };
    expect(determineOpsQueueItemType(input)).toBeNull();
  });

  test("InventoryRestock PENDING → ops_receiving_pending", () => {
    const input: OpsQueueItemTypeInput = { entityType: "INVENTORY_RESTOCK", receivingStatus: "PENDING", inventoryReflected: false };
    expect(determineOpsQueueItemType(input)).toBe("ops_receiving_pending");
  });

  test("InventoryRestock PARTIAL → ops_receiving_pending", () => {
    const input: OpsQueueItemTypeInput = { entityType: "INVENTORY_RESTOCK", receivingStatus: "PARTIAL", inventoryReflected: false };
    expect(determineOpsQueueItemType(input)).toBe("ops_receiving_pending");
  });

  test("InventoryRestock ISSUE → ops_receiving_issue", () => {
    const input: OpsQueueItemTypeInput = { entityType: "INVENTORY_RESTOCK", receivingStatus: "ISSUE", inventoryReflected: false };
    expect(determineOpsQueueItemType(input)).toBe("ops_receiving_issue");
  });

  test("InventoryRestock COMPLETED (not reflected) → ops_restock_confirm", () => {
    const input: OpsQueueItemTypeInput = { entityType: "INVENTORY_RESTOCK", receivingStatus: "COMPLETED", inventoryReflected: false };
    expect(determineOpsQueueItemType(input)).toBe("ops_restock_confirm");
  });

  test("InventoryRestock COMPLETED (reflected) → null", () => {
    const input: OpsQueueItemTypeInput = { entityType: "INVENTORY_RESTOCK", receivingStatus: "COMPLETED", inventoryReflected: true };
    expect(determineOpsQueueItemType(input)).toBeNull();
  });

  test("SLA 2x breach → ops_stalled_handoff", () => {
    const input: OpsQueueItemTypeInput = { entityType: "QUOTE", quoteStatus: "SENT", ageDays: 20, slaWarningDays: 7 };
    expect(determineOpsQueueItemType(input)).toBe("ops_stalled_handoff");
  });

  test("returns single type per entity (no duplicates)", () => {
    const inputs: OpsQueueItemTypeInput[] = [
      { entityType: "QUOTE", quoteStatus: "SENT" },
      { entityType: "PURCHASE_REQUEST", purchaseRequestStatus: "PENDING" },
      { entityType: "ORDER", orderStatus: "ORDERED" },
      { entityType: "INVENTORY_RESTOCK", receivingStatus: "PENDING", inventoryReflected: false },
    ];
    for (const input of inputs) {
      const result = determineOpsQueueItemType(input);
      expect(typeof result).toBe("string");
    }
  });
});

// ── 3. OPS_OWNERSHIP_TRANSFERS ──

describe("OPS_OWNERSHIP_TRANSFERS", () => {
  test("defines 3 transfer rules", () => {
    expect(OPS_OWNERSHIP_TRANSFERS.length).toBe(3);
  });

  test("all transfers have unique IDs", () => {
    const ids = OPS_OWNERSHIP_TRANSFERS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("quote→purchase transfer exists with correct ownership", () => {
    const rule = OPS_OWNERSHIP_TRANSFERS.find((t) => t.id === "quote_to_purchase");
    expect(rule).toBeDefined();
    expect(rule!.previousOwner).toBe("REQUESTER");
    expect(rule!.nextOwner).toBe("APPROVER");
    expect(rule!.fromQueueItemType).toBe("ops_quote_followup");
    expect(rule!.toQueueItemType).toBe("ops_purchase_approval");
  });

  test("order→receiving transfer exists with correct ownership", () => {
    const rule = OPS_OWNERSHIP_TRANSFERS.find((t) => t.id === "order_to_receiving");
    expect(rule).toBeDefined();
    expect(rule!.previousOwner).toBe("OPERATOR");
    expect(rule!.nextOwner).toBe("OPERATOR");
    expect(rule!.fromQueueItemType).toBe("ops_order_tracking");
    expect(rule!.toQueueItemType).toBe("ops_receiving_pending");
  });

  test("receiving→inventory transfer exists with correct ownership", () => {
    const rule = OPS_OWNERSHIP_TRANSFERS.find((t) => t.id === "receiving_to_inventory");
    expect(rule).toBeDefined();
    expect(rule!.previousOwner).toBe("OPERATOR");
    expect(rule!.nextOwner).toBe("OPERATOR");
    expect(rule!.fromQueueItemType).toBe("ops_receiving_pending");
    expect(rule!.toQueueItemType).toBe("ops_restock_confirm");
  });

  test("no overlapping ownership — each transfer closes one type and opens another", () => {
    for (const transfer of OPS_OWNERSHIP_TRANSFERS) {
      expect(transfer.fromQueueItemType).not.toBe(transfer.toQueueItemType);
      expect(transfer.closesSubstatus.length).toBeGreaterThan(0);
      expect(transfer.opensSubstatus.length).toBeGreaterThan(0);
    }
  });
});

// ── 4. OPS_QUEUE_CTA_MAP ──

describe("OPS_QUEUE_CTA_MAP", () => {
  test("all non-terminal ops substatuses have a CTA mapping", () => {
    const nonTerminal = Object.values(OPS_SUBSTATUS_DEFS).filter((d) => !d.isTerminal);
    for (const def of nonTerminal) {
      expect(OPS_QUEUE_CTA_MAP[def.substatus]).toBeDefined();
      expect(OPS_QUEUE_CTA_MAP[def.substatus].label.length).toBeGreaterThan(0);
    }
  });

  test("CTA labels match canonical definitions", () => {
    for (const [substatus, ctaDef] of Object.entries(OPS_QUEUE_CTA_MAP)) {
      const opsDef = OPS_SUBSTATUS_DEFS[substatus];
      if (opsDef) {
        expect(ctaDef.label).toBe(opsDef.cta);
      }
    }
  });

  test("CTA variants are valid", () => {
    for (const cta of Object.values(OPS_QUEUE_CTA_MAP)) {
      expect(["default", "destructive", "outline"]).toContain(cta.variant);
    }
  });
});
