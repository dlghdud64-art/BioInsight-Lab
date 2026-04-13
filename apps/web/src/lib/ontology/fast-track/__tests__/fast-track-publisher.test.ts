// @ts-nocheck — vitest/jest 미설치 환경에서 타입 체크 bypass
/**
 * Fast-Track Publisher tests — 상태 전이 이벤트 발행 검증
 *
 * Spec:
 * P1: 최초 평가 eligible → fast_track_eligible 이벤트 1건
 * P2: 최초 평가 not_eligible → 이벤트 0건 (noise 억제)
 * P3: eligible → eligible (변화 없음) → 이벤트 0건
 * P4: eligible → drift 발생 → fast_track_stale + 재평가 후 새 eligible 이벤트
 * P5: eligible → 조건 악화(not_eligible, drift 아님) → fast_track_not_eligible
 * P6: not_eligible → eligible (이력 보정) → fast_track_eligible
 * P7: publishFastTrackDismissed → fast_track_dismissed 이벤트 발행
 * P8: 이벤트 payload에 procurementCaseId/vendorId/totalAmount 포함
 * P9: affectedObjectIds에 case/vendor/product prefix 포함
 */

import { describe, it, expect, beforeEach } from "vitest";

import {
  getGlobalGovernanceEventBus,
  resetGlobalGovernanceEventBus,
  type GovernanceEvent,
} from "@/lib/ai/governance-event-bus";

import {
  evaluateAndPublishFastTrack,
  publishFastTrackDismissed,
  FAST_TRACK_EVENT_TYPES,
} from "../fast-track-publisher";
import { FAST_TRACK_THRESHOLDS, type FastTrackEvaluationInput } from "../fast-track-engine";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const FIXED_TS = "2026-04-08T09:00:00.000Z";

function goodInput(overrides: Partial<FastTrackEvaluationInput> = {}): FastTrackEvaluationInput {
  return {
    procurementCaseId: overrides.procurementCaseId ?? "case_p001",
    vendorId: overrides.vendorId ?? "vendor_a",
    vendorName: overrides.vendorName ?? "바이오마트",
    totalAmount: overrides.totalAmount ?? 300_000,
    items: overrides.items ?? [
      {
        productId: "prod_tip",
        productName: "피펫 팁 1000uL",
        category: "tool",
        safetyProfile: { hazardCodes: [], pictograms: [], ppe: [], storageClass: null },
        regulatedFlag: false,
        manualReviewRequired: false,
      },
    ],
    histories: overrides.histories ?? [
      {
        vendorId: "vendor_a",
        productId: "prod_tip",
        successfulOrders: FAST_TRACK_THRESHOLDS.minHistoryCount + 2,
        lastOrderedAt: "2026-03-15T00:00:00.000Z",
        issueCount: 0,
      },
    ],
    evaluatedAt: overrides.evaluatedAt ?? FIXED_TS,
  };
}

function collectBusEvents(): GovernanceEvent[] {
  return getGlobalGovernanceEventBus().getHistory();
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("fast-track-publisher", () => {
  beforeEach(() => {
    resetGlobalGovernanceEventBus();
  });

  it("P1: 최초 평가 eligible → fast_track_eligible 이벤트 1건", () => {
    const result = evaluateAndPublishFastTrack(goodInput(), null);
    expect(result.recommendation.recommended).toBe(true);
    expect(result.publishedEvents).toHaveLength(1);
    expect(result.publishedEvents[0].eventType).toBe(FAST_TRACK_EVENT_TYPES.eligible);
    expect(result.transitioned).toBe(true);
  });

  it("P2: 최초 평가 not_eligible → 이벤트 0건 (noise 억제)", () => {
    const result = evaluateAndPublishFastTrack(
      goodInput({ histories: [] }), // 이력 없음 → not_eligible
      null,
    );
    expect(result.recommendation.recommended).toBe(false);
    expect(result.publishedEvents).toHaveLength(0);
    expect(result.transitioned).toBe(false);
  });

  it("P3: eligible → eligible (변화 없음) → 이벤트 0건", () => {
    const first = evaluateAndPublishFastTrack(goodInput(), null);
    resetGlobalGovernanceEventBus(); // 첫 이벤트는 관심사 밖
    const second = evaluateAndPublishFastTrack(goodInput(), first.recommendation);
    expect(second.publishedEvents).toHaveLength(0);
    expect(second.transitioned).toBe(false);
    expect(second.recommendation.recommended).toBe(true);
  });

  it("P4: eligible → drift(hazard 추가) → fast_track_stale 이벤트", () => {
    const first = evaluateAndPublishFastTrack(goodInput(), null);
    resetGlobalGovernanceEventBus();
    const staleResult = evaluateAndPublishFastTrack(
      goodInput({
        items: [
          {
            productId: "prod_tip",
            productName: "피펫 팁 1000uL",
            category: "tool",
            // hazard 추가 → drift 감지
            safetyProfile: { hazardCodes: ["H225"], pictograms: [], ppe: [], storageClass: null },
            regulatedFlag: false,
            manualReviewRequired: false,
          },
        ],
      }),
      first.recommendation,
    );
    // drift → stale 이벤트 + 재평가는 blocker로 not_eligible (not_eligible은 최초 평가로 취급되어 이벤트 없음)
    const types = staleResult.publishedEvents.map((e) => e.eventType);
    expect(types).toContain(FAST_TRACK_EVENT_TYPES.stale);
  });

  it("P5: eligible → not_eligible(drift 아닌 조건 변화) → fast_track_not_eligible", () => {
    const first = evaluateAndPublishFastTrack(goodInput(), null);
    resetGlobalGovernanceEventBus();
    // snapshot은 동일하게 유지하되(자동 drift 감지 대상 바깥 필드) histories만 비워 조건 악화
    // → 주의: 현재 drift detector는 vendor/product/amount/hazard만 감시하므로
    //   histories 변경은 drift 처리되지 않는다 → not_eligible 직행 경로 검증
    const degraded = evaluateAndPublishFastTrack(
      goodInput({ histories: [] }),
      first.recommendation,
    );
    const types = degraded.publishedEvents.map((e) => e.eventType);
    expect(types).toContain(FAST_TRACK_EVENT_TYPES.notEligible);
  });

  it("P6: not_eligible → eligible 전환 → fast_track_eligible", () => {
    // 먼저 not_eligible 상태로 시작 (publisher는 첫 평가에서 이벤트 발행하지 않음)
    const first = evaluateAndPublishFastTrack(goodInput({ histories: [] }), null);
    expect(first.recommendation.recommended).toBe(false);
    resetGlobalGovernanceEventBus();

    // 이력이 보정되어 eligible로 전환
    const recovered = evaluateAndPublishFastTrack(goodInput(), first.recommendation);
    const types = recovered.publishedEvents.map((e) => e.eventType);
    expect(types).toContain(FAST_TRACK_EVENT_TYPES.eligible);
  });

  it("P7: publishFastTrackDismissed → dismissed 이벤트", () => {
    const first = evaluateAndPublishFastTrack(goodInput(), null);
    resetGlobalGovernanceEventBus();
    const event = publishFastTrackDismissed(
      goodInput(),
      first.recommendation,
      "사용자가 수동 검토를 원함",
    );
    expect(event.eventType).toBe(FAST_TRACK_EVENT_TYPES.dismissed);
    expect(event.detail).toContain("사용자가 수동 검토를 원함");
    // bus에도 남아 있어야 함
    expect(collectBusEvents().some((e) => e.eventType === FAST_TRACK_EVENT_TYPES.dismissed)).toBe(true);
  });

  it("P8: 이벤트 payload에 vendorId/totalAmount/procurementCaseId 포함", () => {
    const result = evaluateAndPublishFastTrack(goodInput(), null);
    const evt = result.publishedEvents[0];
    expect(evt.payload).toMatchObject({
      source: "fast_track",
      procurementCaseId: "case_p001",
      vendorId: "vendor_a",
      totalAmount: 300_000,
    });
  });

  it("P9: affectedObjectIds에 case/vendor/product prefix 포함", () => {
    const result = evaluateAndPublishFastTrack(goodInput(), null);
    const evt = result.publishedEvents[0];
    expect(evt.affectedObjectIds).toContain("case:case_p001");
    expect(evt.affectedObjectIds).toContain("vendor:vendor_a");
    expect(evt.affectedObjectIds).toContain("product:prod_tip");
  });
});
