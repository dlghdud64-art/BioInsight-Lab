/**
 * Request Draft AI — 회귀 방지 최소 테스트 세트
 *
 * 이 테스트는 request_draft supplier-local truth를 보호하기 위한 회귀 방지 세트.
 * selector truth / orchestration 순서 / async discard / supplier isolation이 핵심.
 * UI snapshot보다 semantic assertion 우선.
 *
 * 5개 그룹:
 *   1. Pure util (diff, preview, cooldown, dedupe)
 *   2. Selector (representative, active, actionability, surface)
 *   3. Orchestration (accept, dismiss, edit, recompute)
 *   4. Async generation race (inflight, stale, supplier switch)
 *   5. Surface / vocabulary (render gate, internal key leak)
 */

import { diffRequestDraftPatch, isNoOpPatch, buildRequestDraftPreviewCopy } from "../request-draft-diff";
import { isDuplicateInflight, shouldDiscardResult, buildGenerationRequest, hasResolutionAfterTimestamp } from "../request-generation-inflight";
import { isWithinGeneratedCooldown, isWithinResolvedCooldown } from "../request-generation-cooldown";
import { computeMeaningfulContextChange, isMeaningfulMessageChange } from "../request-meaningful-change";
import { shouldReplaceBaseline, buildRequestDraftGenerationBaselineSnapshot } from "../request-resolution-baseline";
import { buildContextKey, upsertSuggestion, pruneOrphans, createEmptyCandidateStore } from "../request-candidate-store";
import { computeFinalActiveSuggestion, buildSurfaceModel, buildEmptySurfaceModel } from "../request-active-suggestion-selector";
import type { SupplierRequestDraft, SupplierDraftPatch } from "../request-draft-patch";
import type { RequestDraftSuggestion } from "../request-suggestion-store";

// ── Fixtures ──

const NOW = "2026-03-26T09:00:00.000Z";
const LATER = "2026-03-26T09:01:00.000Z";
const MUCH_LATER = "2026-03-26T09:10:00.000Z";

function advanceSeconds(base: string, seconds: number): string {
  return new Date(new Date(base).getTime() + seconds * 1000).toISOString();
}

function buildDraft(overrides?: Partial<SupplierRequestDraft>): SupplierRequestDraft {
  return {
    supplierId: "sup-1",
    vendorName: "Sigma-Aldrich",
    itemIds: ["item-1", "item-2"],
    messageBody: "",
    attachments: [],
    leadTimeQuestionIncluded: false,
    substituteQuestionIncluded: false,
    questions: [],
    requestedFields: [],
    notes: "",
    missingFields: ["message_missing"],
    readiness: "draft",
    fieldMeta: {},
    editState: "pristine",
    mergeState: "clean",
    origin: "manual",
    lastPatchResult: null,
    ...overrides,
  };
}

function buildPatch(overrides?: Partial<SupplierDraftPatch>): SupplierDraftPatch {
  return {
    patchId: "patch-1",
    supplierId: "sup-1",
    contextHash: "hash-1",
    source: "ai_patch",
    fields: {},
    generatedAt: NOW,
    ...overrides,
  };
}

function buildSuggestion(overrides?: Partial<RequestDraftSuggestion>): RequestDraftSuggestion {
  return {
    id: "sug-1",
    status: "generated",
    generatedAt: NOW,
    payload: {
      supplierId: "sup-1",
      requestAssemblyId: "ra-1",
      patch: buildPatch(),
      preview: {},
    },
    sourceContext: {
      requestAssemblyId: "ra-1",
      supplierId: "sup-1",
      contextHash: "hash-1",
    },
    ...overrides,
  } as RequestDraftSuggestion;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Pure Util Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("request_draft pure util", () => {
  describe("diffRequestDraftPatch", () => {
    it("detects no-op when messageBody is identical after normalize", () => {
      const draft = buildDraft({ messageBody: "hello world" });
      const patch = buildPatch({ fields: { messageBody: "  hello world  " } });
      const diff = diffRequestDraftPatch({ draft, patch });
      expect(diff.hasEffectiveChanges).toBe(false);
    });

    it("detects effective change when messageBody differs", () => {
      const draft = buildDraft({ messageBody: "old message" });
      const patch = buildPatch({ fields: { messageBody: "completely new message content here" } });
      const diff = diffRequestDraftPatch({ draft, patch });
      expect(diff.hasEffectiveChanges).toBe(true);
      expect(diff.changes.find(c => c.key === "messageBody")?.changed).toBe(true);
    });

    it("detects no-op when boolean flag is same value", () => {
      const draft = buildDraft({ leadTimeQuestionIncluded: true });
      const patch = buildPatch({ fields: { leadTimeQuestionIncluded: true } });
      const diff = diffRequestDraftPatch({ draft, patch });
      expect(diff.changes.find(c => c.key === "leadTimeQuestionIncluded")?.changed).toBe(false);
    });

    it("detects effective toggle change", () => {
      const draft = buildDraft({ leadTimeQuestionIncluded: false });
      const patch = buildPatch({ fields: { leadTimeQuestionIncluded: true } });
      const diff = diffRequestDraftPatch({ draft, patch });
      expect(diff.changes.find(c => c.key === "leadTimeQuestionIncluded")?.changed).toBe(true);
    });
  });

  describe("isNoOpPatch", () => {
    it("returns true for identical draft and patch", () => {
      const draft = buildDraft({ messageBody: "test", leadTimeQuestionIncluded: true });
      const patch = buildPatch({ fields: { messageBody: "test", leadTimeQuestionIncluded: true } });
      expect(isNoOpPatch(draft, patch)).toBe(true);
    });
  });

  describe("buildRequestDraftPreviewCopy", () => {
    it("returns null for unchanged field", () => {
      const token = buildRequestDraftPreviewCopy({
        change: { key: "messageBody", kind: "replace", changed: false },
      });
      expect(token).toBeNull();
    });

    it("returns correct label for message replace", () => {
      const token = buildRequestDraftPreviewCopy({
        change: { key: "messageBody", kind: "replace", changed: true },
      });
      expect(token?.label).toBe("요청 메시지 초안 보강");
    });

    it("returns correct label for lead time toggle", () => {
      const token = buildRequestDraftPreviewCopy({
        change: { key: "leadTimeQuestionIncluded", kind: "toggle", changed: true },
      });
      expect(token?.label).toBe("납기 문의 포함");
    });
  });

  describe("cooldown helpers", () => {
    it("isWithinGeneratedCooldown returns true within 10s", () => {
      expect(isWithinGeneratedCooldown({ latestGeneratedAt: NOW, now: advanceSeconds(NOW, 5) })).toBe(true);
    });

    it("isWithinGeneratedCooldown returns false after 10s", () => {
      expect(isWithinGeneratedCooldown({ latestGeneratedAt: NOW, now: advanceSeconds(NOW, 15) })).toBe(false);
    });

    it("isWithinResolvedCooldown respects source-based threshold", () => {
      // noop = 60s
      expect(isWithinResolvedCooldown({ latestResolvedAt: NOW, latestResolvedSource: "noop", now: advanceSeconds(NOW, 30) })).toBe(true);
      expect(isWithinResolvedCooldown({ latestResolvedAt: NOW, latestResolvedSource: "noop", now: advanceSeconds(NOW, 65) })).toBe(false);
      // accepted = 20s
      expect(isWithinResolvedCooldown({ latestResolvedAt: NOW, latestResolvedSource: "accepted", now: advanceSeconds(NOW, 10) })).toBe(true);
      expect(isWithinResolvedCooldown({ latestResolvedAt: NOW, latestResolvedSource: "accepted", now: advanceSeconds(NOW, 25) })).toBe(false);
    });
  });

  describe("isDuplicateInflight", () => {
    it("blocks same context duplicate", () => {
      const req = buildGenerationRequest({
        requestAssemblyId: "ra-1", supplierId: "sup-1",
        draft: buildDraft(), source: "message_change", now: NOW,
      });
      expect(isDuplicateInflight({ inflight: req, next: req })).toBe(true);
    });

    it("allows different context", () => {
      const req1 = buildGenerationRequest({
        requestAssemblyId: "ra-1", supplierId: "sup-1",
        draft: buildDraft({ messageBody: "a" }), source: "message_change", now: NOW,
      });
      const req2 = buildGenerationRequest({
        requestAssemblyId: "ra-1", supplierId: "sup-1",
        draft: buildDraft({ messageBody: "b".repeat(100) }), source: "message_change", now: LATER,
      });
      expect(isDuplicateInflight({ inflight: req1, next: req2 })).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Selector Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("request_draft selector chain", () => {
  describe("contextKey", () => {
    it("builds consistent key for same inputs", () => {
      const key1 = buildContextKey({ requestAssemblyId: "ra-1", supplierId: "sup-1", contextHash: "h1" });
      const key2 = buildContextKey({ requestAssemblyId: "ra-1", supplierId: "sup-1", contextHash: "h1" });
      expect(key1).toBe(key2);
    });

    it("differs for different supplier", () => {
      const key1 = buildContextKey({ requestAssemblyId: "ra-1", supplierId: "sup-1", contextHash: "h1" });
      const key2 = buildContextKey({ requestAssemblyId: "ra-1", supplierId: "sup-2", contextHash: "h1" });
      expect(key1).not.toBe(key2);
    });
  });

  describe("computeFinalActiveSuggestion", () => {
    it("returns representative when gate is visible and status is generated", () => {
      const sug = buildSuggestion();
      expect(computeFinalActiveSuggestion({ representative: sug, gate: "visible" })).toBe(sug);
    });

    it("returns null when gate is hidden", () => {
      const sug = buildSuggestion();
      expect(computeFinalActiveSuggestion({ representative: sug, gate: "hidden_resolved" })).toBeNull();
    });

    it("returns null when status is not generated", () => {
      const sug = buildSuggestion({ status: "accepted" } as any);
      expect(computeFinalActiveSuggestion({ representative: sug, gate: "visible" })).toBeNull();
    });

    it("returns null when representative is null", () => {
      expect(computeFinalActiveSuggestion({ representative: null, gate: "visible" })).toBeNull();
    });
  });

  describe("surface model", () => {
    it("shouldRenderSuggestion is false when no suggestion", () => {
      const model = buildEmptySurfaceModel();
      expect(model.shouldRenderSuggestion).toBe(false);
      expect(model.previewItems).toEqual([]);
    });

    it("shouldRenderSuggestion requires visible gate and preview items", () => {
      const sug = buildSuggestion();
      const model = buildSurfaceModel({
        activeSuggestion: sug,
        previewItems: [{ key: "message", label: "요청 메시지 초안 보강" }],
        actionability: { gate: "visible", accept: { visible: true, disabled: false, reason: "none" }, review: { visible: true, disabled: false, reason: "none" }, dismiss: { visible: true, disabled: false, reason: "none" } } as any,
        reviewIntent: null,
        statusEcho: { kind: "none", label: null, tone: "muted", persistent: false },
      });
      expect(model.shouldRenderSuggestion).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Candidate Store Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("request_draft candidate store", () => {
  it("upserts representative by contextKey (no duplicate)", () => {
    let store = createEmptyCandidateStore();
    const sug1 = buildSuggestion({ id: "sug-1" });
    const result1 = upsertSuggestion(store, sug1);
    store = result1.store;
    expect(Object.keys(store.byId)).toHaveLength(1);

    const sug2 = buildSuggestion({ id: "sug-2" }); // same contextKey
    const result2 = upsertSuggestion(store, sug2);
    store = result2.store;
    expect(Object.keys(store.byId)).toHaveLength(1); // replaced, not appended
    expect(store.byId["sug-2"]).toBeDefined();
    expect(store.byId["sug-1"]).toBeUndefined();
  });

  it("prunes orphaned entities", () => {
    let store = createEmptyCandidateStore();
    store.byId["orphan-1"] = buildSuggestion({ id: "orphan-1" });
    // orphan-1 is not in byContextKey
    store = pruneOrphans(store, null);
    expect(store.byId["orphan-1"]).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Async Race Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("request_draft async generation race", () => {
  it("discards result when supplier mismatch", () => {
    const request = buildGenerationRequest({
      requestAssemblyId: "ra-1", supplierId: "sup-1",
      draft: buildDraft(), source: "message_change", now: NOW,
    });
    expect(shouldDiscardResult({
      request,
      currentSupplierId: "sup-2", // different!
      currentDraft: buildDraft({ supplierId: "sup-2" }),
      currentRequestAssemblyId: "ra-1",
      resolvedAfterStart: false,
      hasVisibleValidSuggestion: false,
    })).toBe(true);
  });

  it("discards result when resolution occurred after start", () => {
    expect(hasResolutionAfterTimestamp({
      resolvedHistory: [{ requestAssemblyId: "ra-1", supplierId: "sup-1", resolvedAt: LATER }],
      requestAssemblyId: "ra-1",
      supplierId: "sup-1",
      since: NOW,
    })).toBe(true);
  });

  it("does not discard when resolution is before start", () => {
    expect(hasResolutionAfterTimestamp({
      resolvedHistory: [{ requestAssemblyId: "ra-1", supplierId: "sup-1", resolvedAt: NOW }],
      requestAssemblyId: "ra-1",
      supplierId: "sup-1",
      since: LATER,
    })).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Resolution + Baseline Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("request_draft resolution baseline", () => {
  it("shouldReplaceBaseline returns true for different source", () => {
    const existing = buildRequestDraftGenerationBaselineSnapshot({
      requestAssemblyId: "ra-1", supplierId: "sup-1",
      draft: buildDraft(), source: "accepted", now: NOW,
    });
    const next = buildRequestDraftGenerationBaselineSnapshot({
      requestAssemblyId: "ra-1", supplierId: "sup-1",
      draft: buildDraft(), source: "edited", now: LATER,
    });
    expect(shouldReplaceBaseline(existing, next)).toBe(true);
  });

  it("shouldReplaceBaseline returns false for identical snapshot", () => {
    const snapshot = buildRequestDraftGenerationBaselineSnapshot({
      requestAssemblyId: "ra-1", supplierId: "sup-1",
      draft: buildDraft(), source: "accepted", now: NOW,
    });
    expect(shouldReplaceBaseline(snapshot, snapshot)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Meaningful Change Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("request_draft meaningful change", () => {
  it("message whitespace-only change is not meaningful", () => {
    expect(isMeaningfulMessageChange({
      baselineMessage: "hello world",
      currentMessage: "  hello world  ",
      baselineSource: null,
    })).toBe(false);
  });

  it("message with 15+ char difference is meaningful (normal)", () => {
    expect(isMeaningfulMessageChange({
      baselineMessage: "short",
      currentMessage: "this is a much longer message with new content",
      baselineSource: "accepted",
    })).toBe(true);
  });

  it("message with small change is not meaningful after dismissed (strict)", () => {
    expect(isMeaningfulMessageChange({
      baselineMessage: "hello world message",
      currentMessage: "hello world message!",
      baselineSource: "dismissed",
    })).toBe(false);
  });
});
