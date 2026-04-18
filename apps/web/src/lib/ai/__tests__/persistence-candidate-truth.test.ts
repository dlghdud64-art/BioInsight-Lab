/**
 * Persistence & Candidate Truth Boundary Tests
 *
 * CLAUDE.md 누락 시나리오:
 * 8. outbound history hydration 후 re-entry 시 lineage 유지
 * 9. dedupe persistence가 reopen / invalidation 후 clear되는지 검증
 * 10. mock seed가 canonical candidate truth를 override하지 않는지 검증
 */

import {
  mergeCandidateWithSeed,
  detectCanonicalOverrideAttempts,
  CANONICAL_CANDIDATE_FIELD_KEYS,
} from "../candidate-truth-boundary";
import {
  persistOutboundHistory,
  loadOutboundHistory,
  clearOutboundHistory,
  hydrateOutboundHistoryIfEmpty,
} from "../outbound-history-persistence";
import {
  shouldPublish,
  markPublished,
  clearDedupeForPo,
} from "../governance-event-dedupe";
import {
  SessionStorageAdapter,
  setDedupeAdapter,
  setOutboundHistoryAdapter,
  type PersistenceAdapter,
  type DedupeRecord,
  type OutboundHistoryRecord,
} from "@/lib/persistence/persistence-adapter";
import type { DispatchOutboundRecord } from "@/lib/store/dispatch-outbound-store";

// ══════════════════════════════════════════════
// In-memory adapter for test isolation
// ══════════════════════════════════════════════

class InMemoryAdapter<T> implements PersistenceAdapter<T> {
  private store = new Map<string, T>();

  load(key: string): T | null {
    return this.store.get(key) ?? null;
  }

  persist(key: string, data: T): void {
    this.store.set(key, data);
  }

  clear(key: string): void {
    this.store.delete(key);
  }

  hydrateIfEmpty(key: string, current: T | null): T | null {
    if (current !== null && current !== undefined) return current;
    return this.load(key);
  }

  /** SessionStorageAdapter 호환 — clearByPrefix */
  clearByPrefix(keyPrefix: string): void {
    for (const key of [...this.store.keys()]) {
      if (key.startsWith(keyPrefix)) this.store.delete(key);
    }
  }

  /** 테스트 헬퍼 */
  size(): number {
    return this.store.size;
  }

  keys(): string[] {
    return [...this.store.keys()];
  }
}

// ══════════════════════════════════════════════
// Fixtures
// ══════════════════════════════════════════════

function createMockOutboundRecord(
  poId: string,
  status: string,
  index: number,
): DispatchOutboundRecord {
  return {
    id: `record_${index}`,
    poId,
    status: status as DispatchOutboundRecord["status"],
    createdAt: `2026-04-${String(10 + index).padStart(2, "0")}T09:00:00Z`,
    payload: { note: `Record ${index}` },
  } as unknown as DispatchOutboundRecord;
}

// ══════════════════════════════════════════════
// Scenario 8: outbound history hydration → re-entry lineage
// ══════════════════════════════════════════════

describe("Scenario 8: outbound history hydration 후 re-entry 시 lineage 유지", () => {
  let outboundAdapter: InMemoryAdapter<OutboundHistoryRecord[]>;

  beforeEach(() => {
    outboundAdapter = new InMemoryAdapter<OutboundHistoryRecord[]>();
    setOutboundHistoryAdapter(outboundAdapter);
  });

  it("persist → load 사이클에서 history 무손실", () => {
    const poId = "PO-2026-HYDRATE-001";
    const records: DispatchOutboundRecord[] = [
      createMockOutboundRecord(poId, "ready_to_send", 1),
      createMockOutboundRecord(poId, "scheduled", 2),
    ];

    persistOutboundHistory(poId, records);
    const loaded = loadOutboundHistory(poId);

    expect(loaded).toHaveLength(2);
    expect(loaded[0].poId).toBe(poId);
    expect(loaded[1].poId).toBe(poId);
  });

  it("hydrateIfEmpty: store 비어있으면 persisted history로 채움", () => {
    const poId = "PO-2026-HYDRATE-002";
    const records: DispatchOutboundRecord[] = [
      createMockOutboundRecord(poId, "ready_to_send", 1),
      createMockOutboundRecord(poId, "sent", 2),
    ];

    // 1) persist
    persistOutboundHistory(poId, records);

    // 2) store가 비어 있는 상태에서 hydrate
    const result = hydrateOutboundHistoryIfEmpty(poId, []);

    expect(result.shouldHydrate).toBe(true);
    if (result.shouldHydrate) {
      expect(result.history).toHaveLength(2);
      expect(result.latest.poId).toBe(poId);
    }
  });

  it("hydrateIfEmpty: store에 이미 데이터 있으면 no-op (in-memory 우선)", () => {
    const poId = "PO-2026-HYDRATE-003";
    const persisted = [createMockOutboundRecord(poId, "ready_to_send", 1)];
    const current = [createMockOutboundRecord(poId, "sent", 2)];

    persistOutboundHistory(poId, persisted);
    const result = hydrateOutboundHistoryIfEmpty(poId, current);

    // in-memory가 우선이므로 hydrate 하지 않음
    expect(result.shouldHydrate).toBe(false);
  });

  it("re-entry 후 lineage 순서 유지 (oldest → newest)", () => {
    const poId = "PO-2026-HYDRATE-004";
    const records: DispatchOutboundRecord[] = [
      createMockOutboundRecord(poId, "ready_to_send", 1),
      createMockOutboundRecord(poId, "scheduled", 2),
      createMockOutboundRecord(poId, "sent", 3),
    ];

    persistOutboundHistory(poId, records);
    const result = hydrateOutboundHistoryIfEmpty(poId, []);

    if (result.shouldHydrate) {
      // lineage 순서: 1 → 2 → 3
      expect(result.history[0].createdAt < result.history[1].createdAt).toBe(true);
      expect(result.history[1].createdAt < result.history[2].createdAt).toBe(true);
      // latest는 마지막 record
      expect(result.latest).toEqual(result.history[2]);
    }
  });

  it("clearOutboundHistory 후 hydrate 시 빈 결과", () => {
    const poId = "PO-2026-HYDRATE-005";
    persistOutboundHistory(poId, [createMockOutboundRecord(poId, "sent", 1)]);

    clearOutboundHistory(poId);
    const result = hydrateOutboundHistoryIfEmpty(poId, []);

    expect(result.shouldHydrate).toBe(false);
  });

  it("빈 배열 persist 시 기존 history 제거 (storage 오염 방지)", () => {
    const poId = "PO-2026-HYDRATE-006";
    persistOutboundHistory(poId, [createMockOutboundRecord(poId, "sent", 1)]);

    // 빈 배열로 persist → clear 효과
    persistOutboundHistory(poId, []);
    const loaded = loadOutboundHistory(poId);

    expect(loaded).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════
// Scenario 9: dedupe persistence → reopen/invalidation 후 clear
// ══════════════════════════════════════════════

describe("Scenario 9: dedupe persistence가 reopen / invalidation 후 clear되는지 검증", () => {
  let dedupeAdapter: InMemoryAdapter<DedupeRecord>;

  beforeEach(() => {
    dedupeAdapter = new InMemoryAdapter<DedupeRecord>();
    setDedupeAdapter(dedupeAdapter);
  });

  it("markPublished 후 shouldPublish가 false 반환 (중복 방지)", () => {
    const poNumber = "PO-DEDUPE-001";
    const eventType = "po_data_changed_after_approval";
    const signature = "updated_2026-04-10";

    markPublished(poNumber, eventType, signature);
    const result = shouldPublish(poNumber, eventType, signature);

    expect(result).toBe(false);
  });

  it("clearDedupeForPo 후 동일 이벤트 재발행 가능", () => {
    const poNumber = "PO-DEDUPE-002";
    const eventType = "snapshot_invalidated";
    const signature = "v1";

    // 1) 최초 발행 → 기록
    markPublished(poNumber, eventType, signature);
    expect(shouldPublish(poNumber, eventType, signature)).toBe(false);

    // 2) reopen → clear
    clearDedupeForPo(poNumber);

    // 3) 동일 조합 재발행 가능
    expect(shouldPublish(poNumber, eventType, signature)).toBe(true);
  });

  it("clearDedupeForPo는 해당 PO만 clear (다른 PO 유지)", () => {
    const po1 = "PO-DEDUPE-003";
    const po2 = "PO-DEDUPE-004";
    const eventType = "approval_expired";

    markPublished(po1, eventType, "sig1");
    markPublished(po2, eventType, "sig2");

    // PO1만 clear
    clearDedupeForPo(po1);

    expect(shouldPublish(po1, eventType, "sig1")).toBe(true); // cleared
    expect(shouldPublish(po2, eventType, "sig2")).toBe(false); // 유지
  });

  it("한 PO의 여러 이벤트 타입이 모두 clear됨", () => {
    const poNumber = "PO-DEDUPE-005";

    markPublished(poNumber, "po_data_changed_after_approval", "sig_a");
    markPublished(poNumber, "snapshot_invalidated", "sig_b");
    markPublished(poNumber, "supplier_profile_changed", "sig_c");

    clearDedupeForPo(poNumber);

    expect(shouldPublish(poNumber, "po_data_changed_after_approval", "sig_a")).toBe(true);
    expect(shouldPublish(poNumber, "snapshot_invalidated", "sig_b")).toBe(true);
    expect(shouldPublish(poNumber, "supplier_profile_changed", "sig_c")).toBe(true);
  });

  it("TTL 만료 후에는 clear 없이도 재발행 가능", () => {
    const poNumber = "PO-DEDUPE-006";
    const eventType = "policy_hold_changed";
    const signature = "hold_v1";

    markPublished(poNumber, eventType, signature);

    // TTL 0ms 로 확인 → 즉시 만료
    const result = shouldPublish(poNumber, eventType, signature, 0);
    expect(result).toBe(true);
  });
});

// ══════════════════════════════════════════════
// Scenario 10: mock seed가 canonical candidate truth를 override하지 않는지 검증
// ══════════════════════════════════════════════

describe("Scenario 10: mock seed가 canonical candidate truth를 override하지 않는지 검증", () => {
  // 테스트용 canonical truth 구조
  type TestCandidate = {
    // canonical fields
    supplierId: string;
    supplierName: string;
    supplierEmail: string;
    totalAmount: number;
    currency: string;
    approvalStatus: string;
    approvalDecisionId: string;
    executionStatus: string;
    sentAt: string | null;
    poNumber: string;
    // non-canonical (presentation) fields
    displayNote: string;
    uiColor: string;
    previewLabel: string;
  };

  const canonicalTruth: TestCandidate = {
    supplierId: "vendor_real_001",
    supplierName: "실제 공급사 A",
    supplierEmail: "real@supplier.com",
    totalAmount: 1500000,
    currency: "KRW",
    approvalStatus: "approved",
    approvalDecisionId: "decision_real_001",
    executionStatus: "pending",
    sentAt: null,
    poNumber: "PO-2026-REAL-001",
    displayNote: "",
    uiColor: "",
    previewLabel: "",
  };

  it("canonical field가 존재하면 mock seed가 override 불가", () => {
    const mockSeed = {
      __presentationSeed: true as const,
      supplierId: "vendor_mock_999",
      supplierName: "가짜 공급사",
      totalAmount: 999999,
      approvalStatus: "mock_approved",
      displayNote: "프리뷰용 메모",
      uiColor: "blue",
    };

    const merged = mergeCandidateWithSeed(canonicalTruth, mockSeed);

    // canonical fields → truth 유지
    expect(merged.supplierId).toBe("vendor_real_001");
    expect(merged.supplierName).toBe("실제 공급사 A");
    expect(merged.totalAmount).toBe(1500000);
    expect(merged.approvalStatus).toBe("approved");

    // non-canonical fields → seed로 보충
    expect(merged.displayNote).toBe("프리뷰용 메모");
    expect(merged.uiColor).toBe("blue");
  });

  it("detectCanonicalOverrideAttempts: override 시도를 감지", () => {
    const mockSeed = {
      supplierId: "vendor_mock_999",
      supplierName: "가짜 공급사",
      totalAmount: 999999,
      currency: "USD",
      displayNote: "메모",
    };

    const violations = detectCanonicalOverrideAttempts(canonicalTruth, mockSeed);

    // 4개 canonical field override 시도 감지
    expect(violations).toContain("supplierId");
    expect(violations).toContain("supplierName");
    expect(violations).toContain("totalAmount");
    expect(violations).toContain("currency");
    // non-canonical field는 violation 아님
    expect(violations).not.toContain("displayNote");
  });

  it("canonical truth에 null인 field는 seed로 채울 수 있음", () => {
    const truthWithNulls = {
      ...canonicalTruth,
      sentAt: null,
      executionStatus: undefined as unknown as string,
    };

    const seed = {
      __presentationSeed: true as const,
      sentAt: "2026-04-12T10:00:00Z" as string | null,
      executionStatus: "preview_pending",
      previewLabel: "발송 대기",
    };

    const merged = mergeCandidateWithSeed(truthWithNulls, seed as Partial<typeof truthWithNulls> & { __presentationSeed: true });

    // null/undefined canonical → seed로 채움
    expect(merged.sentAt).toBe("2026-04-12T10:00:00Z");
    expect(merged.executionStatus).toBe("preview_pending");
    // non-canonical도 채움
    expect(merged.previewLabel).toBe("발송 대기");
  });

  it("seed의 __presentationSeed marker는 merged 결과에 영향 없음", () => {
    const seed = {
      __presentationSeed: true as const,
      displayNote: "테스트 메모",
    };

    const merged = mergeCandidateWithSeed(canonicalTruth, seed);

    // __presentationSeed는 skip됨
    expect((merged as any).__presentationSeed).toBeUndefined();
    expect(merged.displayNote).toBe("테스트 메모");
  });

  it("모든 18개 canonical field key가 보호 대상에 포함", () => {
    const expectedKeys = [
      "supplierId", "supplierName", "supplierEmail",
      "totalAmount", "currency", "unitPrice",
      "approvalStatus", "approvalDecisionId", "approvalDecidedAt", "approvalSnapshotValid",
      "executionStatus", "sentAt", "scheduledAt", "outboundExecutionId",
      "poNumber", "conversionSnapshotValid", "poConversionDraftId",
    ];

    for (const key of expectedKeys) {
      expect(CANONICAL_CANDIDATE_FIELD_KEYS).toContain(key);
    }

    expect(CANONICAL_CANDIDATE_FIELD_KEYS).toHaveLength(expectedKeys.length);
  });

  it("seed가 canonical field 동일값이면 violation 아님 (값이 같으면 override 아님)", () => {
    const seed = {
      supplierId: "vendor_real_001", // truth와 동일
      totalAmount: 1500000,          // truth와 동일
      displayNote: "새 메모",
    };

    const violations = detectCanonicalOverrideAttempts(canonicalTruth, seed);

    // 값이 같으면 violation 아님
    expect(violations).not.toContain("supplierId");
    expect(violations).not.toContain("totalAmount");
  });

  it("빈 seed는 canonical truth를 변경하지 않음", () => {
    const emptySeed = { __presentationSeed: true as const };
    const merged = mergeCandidateWithSeed(canonicalTruth, emptySeed);

    expect(merged).toEqual(canonicalTruth);
  });
});

// ══════════════════════════════════════════════
// Scenario 11: Persistence Adapter 계약 일관성 검증
// ══════════════════════════════════════════════

describe("Scenario 11: PersistenceAdapter 계약 — load/persist/clear/hydrateIfEmpty 4종 일관성", () => {
  let adapter: InMemoryAdapter<{ value: string }>;

  beforeEach(() => {
    adapter = new InMemoryAdapter<{ value: string }>();
  });

  it("persist → load 사이클 무손실", () => {
    adapter.persist("key1", { value: "hello" });
    const loaded = adapter.load("key1");
    expect(loaded).toEqual({ value: "hello" });
  });

  it("clear 후 load 시 null", () => {
    adapter.persist("key1", { value: "hello" });
    adapter.clear("key1");
    expect(adapter.load("key1")).toBeNull();
  });

  it("hydrateIfEmpty: current 있으면 current 반환 (load 안 함)", () => {
    adapter.persist("key1", { value: "from_storage" });
    const result = adapter.hydrateIfEmpty("key1", { value: "current" });
    expect(result).toEqual({ value: "current" });
  });

  it("hydrateIfEmpty: current null이면 load 결과 반환", () => {
    adapter.persist("key1", { value: "from_storage" });
    const result = adapter.hydrateIfEmpty("key1", null);
    expect(result).toEqual({ value: "from_storage" });
  });

  it("hydrateIfEmpty: current null + storage 없으면 null", () => {
    const result = adapter.hydrateIfEmpty("key1", null);
    expect(result).toBeNull();
  });

  it("clearByPrefix: 특정 접두사 키만 삭제", () => {
    adapter.persist("PO-001::event_a", { value: "a" });
    adapter.persist("PO-001::event_b", { value: "b" });
    adapter.persist("PO-002::event_a", { value: "c" });

    adapter.clearByPrefix("PO-001::");

    expect(adapter.load("PO-001::event_a")).toBeNull();
    expect(adapter.load("PO-001::event_b")).toBeNull();
    expect(adapter.load("PO-002::event_a")).toEqual({ value: "c" });
  });
});

// ══════════════════════════════════════════════
// Scenario 12: Approval Baseline Adapter — store 계약 검증
// ══════════════════════════════════════════════

describe("Scenario 12: Approval Baseline adapter boundary — store 계약 검증", () => {
  it("approval-baseline-client exports가 올바른 시그니처", async () => {
    // Type-level 검증: import가 올바른 타입을 export하는지 확인
    // 실제 fetch는 하지 않지만 타입 계약이 유효한지 검증
    const clientModule = await import("@/lib/persistence/approval-baseline-client");

    expect(typeof clientModule.ensureApprovalSnapshotWithServer).toBe("function");
    expect(typeof clientModule.getApprovalSnapshotWithServer).toBe("function");
    expect(typeof clientModule.clearApprovalSnapshotWithServer).toBe("function");
    expect(typeof clientModule.hydrateApprovalSnapshotFromServer).toBe("function");
  });
});

// ══════════════════════════════════════════════
// Scenario 13: Dedupe Bridge — server bridge 계약 검증
// ══════════════════════════════════════════════

describe("Scenario 13: Dedupe Bridge — server bridge 계약 검증", () => {
  it("governance-event-dedupe-client exports가 올바른 시그니처", async () => {
    const clientModule = await import("@/lib/persistence/governance-event-dedupe-client");

    expect(typeof clientModule.shouldPublishWithServer).toBe("function");
    expect(typeof clientModule.shouldPublishWithServerAsync).toBe("function");
    expect(typeof clientModule.markPublishedWithServer).toBe("function");
    expect(typeof clientModule.clearDedupeForPoWithServer).toBe("function");
  });

  it("shouldPublishWithServer는 동기 함수 (boolean 반환)", async () => {
    // NOTE: vitest ESM 환경에서 `require()` 는 @/ alias 를 해석하지 못해 Cannot find module
    //       에러가 난다. 위 첫 케이스와 동일하게 `await import()` 로 접근.
    //       서버 없는 테스트 환경 — sessionStorage 도 없으므로 true 반환.
    const { shouldPublishWithServer } = await import("@/lib/persistence/governance-event-dedupe-client");
    const result = shouldPublishWithServer("PO-TEST", "test_event", "sig1");
    expect(typeof result).toBe("boolean");
  });

  it("shouldPublishWithServerAsync는 비동기 함수 (Promise<boolean> 반환)", async () => {
    const { shouldPublishWithServerAsync } = await import("@/lib/persistence/governance-event-dedupe-client");
    const result = shouldPublishWithServerAsync("PO-TEST", "test_event", "sig1");
    expect(result).toBeInstanceOf(Promise);
    // 서버 없는 환경에서 fallback → true
    const resolved = await result;
    expect(typeof resolved).toBe("boolean");
  });
});
