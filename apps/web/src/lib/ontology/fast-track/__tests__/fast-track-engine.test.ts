/**
 * Fast-Track Recommendation Engine tests
 *
 * Spec:
 * F1: 모든 조건 충족 시나리오 — recommended=true, eligible, reasons 3개, blockers 0
 * F2: 위험물질(H-code) 존재 — recommended=false, blocker=hazardous_item_present
 * F3: 규제 플래그 존재 — recommended=false, blocker=regulated_item_present
 * F4: 과거 이력 부족 — recommended=false, blocker=insufficient_history
 * F5: 이력 있어도 issue가 1개 이상 — insufficient_history로 간주
 * F6: safetyScore threshold 경계 테스트 (hazard 없음 + 규제 없음만 있고 history 없음 → 미달)
 * F7: manual_review_required 지정 시 blocker 포함
 * F8: deterministic — 동일 input → 동일 safetyScore + 동일 objectId
 * F9: detectFastTrackSnapshotDrift — vendor/product/amount/hazard 변경 감지
 * F10: hazard code 빈 문자열은 무시 (false positive 방지)
 */

import { describe, it, expect } from "vitest";

import {
  evaluateFastTrack,
  detectFastTrackSnapshotDrift,
  FAST_TRACK_THRESHOLDS,
  type FastTrackEvaluationInput,
  type FastTrackCandidateItem,
  type FastTrackHistoryRecord,
} from "../fast-track-engine";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const FIXED_TS = "2026-04-08T09:00:00.000Z";

function makeItem(partial: Partial<FastTrackCandidateItem> = {}): FastTrackCandidateItem {
  return {
    productId: partial.productId ?? "prod_safe_pipette_tip",
    productName: partial.productName ?? "피펫 팁 1000uL",
    category: partial.category ?? "tool",
    safetyProfile: partial.safetyProfile ?? {
      hazardCodes: [],
      pictograms: [],
      ppe: [],
      storageClass: null,
    },
    regulatedFlag: partial.regulatedFlag ?? false,
    manualReviewRequired: partial.manualReviewRequired ?? false,
  };
}

function makeHistory(partial: Partial<FastTrackHistoryRecord> = {}): FastTrackHistoryRecord {
  return {
    vendorId: partial.vendorId ?? "vendor_a",
    productId: partial.productId ?? "prod_safe_pipette_tip",
    successfulOrders: partial.successfulOrders ?? FAST_TRACK_THRESHOLDS.minHistoryCount + 2,
    lastOrderedAt: partial.lastOrderedAt ?? "2026-03-15T00:00:00.000Z",
    issueCount: partial.issueCount ?? 0,
  };
}

function makeInput(overrides: Partial<FastTrackEvaluationInput> = {}): FastTrackEvaluationInput {
  const items = overrides.items ?? [makeItem()];
  const histories =
    overrides.histories ??
    items.map((i) => makeHistory({ productId: i.productId, vendorId: overrides.vendorId ?? "vendor_a" }));
  return {
    procurementCaseId: overrides.procurementCaseId ?? "case_001",
    vendorId: overrides.vendorId ?? "vendor_a",
    vendorName: overrides.vendorName ?? "바이오마트",
    totalAmount: overrides.totalAmount ?? 250_000,
    items,
    histories,
    evaluatedAt: overrides.evaluatedAt ?? FIXED_TS,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("evaluateFastTrack — F1: 모든 조건 충족", () => {
  it("recommended=true, eligible, reasons=3, blockers=0", () => {
    const rec = evaluateFastTrack(makeInput());
    expect(rec.recommended).toBe(true);
    expect(rec.recommendationStatus).toBe("eligible");
    expect(rec.reasons).toHaveLength(3);
    expect(rec.blockers).toHaveLength(0);
    expect(rec.safetyScore).toBeGreaterThanOrEqual(FAST_TRACK_THRESHOLDS.minSafetyScore);
    // 세 reason code 모두 포함
    const codes = rec.reasons.map((r) => r.code).sort();
    expect(codes).toEqual(["no_hazard_flags", "no_regulatory_flags", "repeat_purchase_history"]);
  });
});

describe("evaluateFastTrack — F2: 위험물질 존재", () => {
  it("H-code가 있으면 recommended=false, blocker=hazardous_item_present", () => {
    const rec = evaluateFastTrack(
      makeInput({
        items: [
          makeItem({
            productName: "Methanol 99.9%",
            safetyProfile: {
              hazardCodes: ["H225", "H301"],
              pictograms: ["GHS02", "GHS06"],
              ppe: ["gloves", "goggles"],
              storageClass: "flammable",
            },
          }),
        ],
      }),
    );
    expect(rec.recommended).toBe(false);
    expect(rec.blockers.some((b) => b.code === "hazardous_item_present")).toBe(true);
    // reason에는 no_hazard_flags가 있으면 안 됨
    expect(rec.reasons.some((r) => r.code === "no_hazard_flags")).toBe(false);
  });
});

describe("evaluateFastTrack — F3: 규제 플래그", () => {
  it("regulatedFlag=true면 blocker=regulated_item_present", () => {
    const rec = evaluateFastTrack(
      makeInput({
        items: [makeItem({ regulatedFlag: true, productName: "향정신성 의약품 원료" })],
      }),
    );
    expect(rec.recommended).toBe(false);
    expect(rec.blockers.some((b) => b.code === "regulated_item_present")).toBe(true);
  });
});

describe("evaluateFastTrack — F4: 이력 부족", () => {
  it("successfulOrders < minHistoryCount → insufficient_history", () => {
    const rec = evaluateFastTrack(
      makeInput({
        histories: [makeHistory({ successfulOrders: 1 })],
      }),
    );
    expect(rec.recommended).toBe(false);
    expect(rec.blockers.some((b) => b.code === "insufficient_history")).toBe(true);
  });

  it("history record 자체가 없으면 insufficient_history", () => {
    const rec = evaluateFastTrack(makeInput({ histories: [] }));
    expect(rec.recommended).toBe(false);
    expect(rec.blockers.some((b) => b.code === "insufficient_history")).toBe(true);
  });
});

describe("evaluateFastTrack — F5: 이슈 이력", () => {
  it("issueCount > 0 이면 insufficient_history로 처리", () => {
    const rec = evaluateFastTrack(
      makeInput({
        histories: [makeHistory({ successfulOrders: 10, issueCount: 1 })],
      }),
    );
    expect(rec.recommended).toBe(false);
    expect(rec.blockers.some((b) => b.code === "insufficient_history")).toBe(true);
  });
});

describe("evaluateFastTrack — F6: safetyScore threshold", () => {
  it("hazard/regulation은 clean하지만 history 0 → threshold 미달", () => {
    const rec = evaluateFastTrack(makeInput({ histories: [] }));
    // reasons: no_hazard_flags (0.35) + no_regulatory_flags (0.25) = 0.60 < 0.70
    expect(rec.safetyScore).toBeLessThan(FAST_TRACK_THRESHOLDS.minSafetyScore);
    expect(rec.recommended).toBe(false);
  });
});

describe("evaluateFastTrack — F7: manual_review_required", () => {
  it("manualReviewRequired=true 면 blocker 포함", () => {
    const rec = evaluateFastTrack(
      makeInput({
        items: [makeItem({ manualReviewRequired: true })],
      }),
    );
    expect(rec.recommended).toBe(false);
    expect(rec.blockers.some((b) => b.code === "manual_review_required")).toBe(true);
  });
});

describe("evaluateFastTrack — F8: deterministic", () => {
  it("동일 input → 동일 safetyScore + 동일 objectId + 동일 snapshot", () => {
    const input = makeInput();
    const a = evaluateFastTrack(input);
    const b = evaluateFastTrack(input);
    expect(a.safetyScore).toBe(b.safetyScore);
    expect(a.objectId).toBe(b.objectId);
    expect(a.evaluationSnapshot).toEqual(b.evaluationSnapshot);
  });
});

describe("detectFastTrackSnapshotDrift — F9", () => {
  const baseInput = makeInput();
  const baseRec = evaluateFastTrack(baseInput);

  it("변경 없음 → isStale=false", () => {
    expect(detectFastTrackSnapshotDrift(baseRec, baseInput).isStale).toBe(false);
  });

  it("vendor 변경 감지", () => {
    const drift = detectFastTrackSnapshotDrift(baseRec, makeInput({ vendorId: "vendor_b" }));
    expect(drift.isStale).toBe(true);
    expect(drift.reason).toContain("공급사");
  });

  it("품목 구성 변경 감지", () => {
    const drift = detectFastTrackSnapshotDrift(
      baseRec,
      makeInput({
        items: [makeItem({ productId: "prod_other" })],
        histories: [makeHistory({ productId: "prod_other", successfulOrders: 5 })],
      }),
    );
    expect(drift.isStale).toBe(true);
    expect(drift.reason).toContain("품목");
  });

  it("금액 변경 감지", () => {
    const drift = detectFastTrackSnapshotDrift(baseRec, makeInput({ totalAmount: 999_999 }));
    expect(drift.isStale).toBe(true);
    expect(drift.reason).toContain("금액");
  });

  it("hazard 추가 감지", () => {
    const drift = detectFastTrackSnapshotDrift(
      baseRec,
      makeInput({
        items: [
          makeItem({
            safetyProfile: {
              hazardCodes: ["H225"],
              pictograms: [],
              ppe: [],
              storageClass: null,
            },
          }),
        ],
      }),
    );
    expect(drift.isStale).toBe(true);
    expect(drift.reason).toContain("안전");
  });
});

describe("evaluateFastTrack — F10: hazard code 빈 값 처리", () => {
  it("빈 문자열/공백 hazard code는 무시", () => {
    const rec = evaluateFastTrack(
      makeInput({
        items: [
          makeItem({
            safetyProfile: {
              hazardCodes: ["", "   "],
              pictograms: [],
              ppe: [],
              storageClass: null,
            },
          }),
        ],
      }),
    );
    expect(rec.recommended).toBe(true);
    expect(rec.blockers.some((b) => b.code === "hazardous_item_present")).toBe(false);
  });
});
