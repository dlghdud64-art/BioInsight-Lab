// @ts-nocheck — vitest/jest 미설치 환경에서 타입 체크 bypass
/**
 * Fast-Track Similarity — findSimilarEligible spec
 *
 * S1: vendor 동일 + eligible + self 제외 → 후보 반환
 * S2: vendor 다른 건은 제외
 * S3: eligible 이 아닌 건 (stale/accepted/dismissed/not_eligible) 은 제외
 * S4: target 자기 자신은 제외
 * S5: amount_desc 정렬 (기본)
 * S6: limit cap 적용
 * S7: target 이 전체 목록에 없으면 빈 배열
 * S8: 금액 차이가 커도 vendor 같으면 포함 (금액 범위 필터 없음)
 * S9: hasUnseenEligible — dismissed 에 포함된 것은 unseen 으로 치지 않음
 * S10: selectUnseenEligible — amount_desc + limit
 */

import { describe, it, expect } from "vitest";

import {
  findSimilarEligible,
  hasUnseenEligible,
  selectUnseenEligible,
  DEFAULT_SIMILARITY_POLICY,
} from "../fast-track-similarity";
import type {
  FastTrackRecommendationObject,
  FastTrackStatus,
} from "@/lib/ontology/types";

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeRec(
  overrides: Partial<{
    objectId: string;
    caseId: string;
    vendorId: string;
    status: FastTrackStatus;
    totalAmount: number;
    evaluatedAt: string;
  }> = {},
): FastTrackRecommendationObject {
  return {
    objectId: overrides.objectId ?? `rec_${overrides.caseId ?? "x"}`,
    objectType: "FastTrackRecommendation",
    createdAt: "2026-04-09T09:00:00.000Z",
    updatedAt: "2026-04-09T09:00:00.000Z",
    procurementCaseId: overrides.caseId ?? "case_x",
    recommendationStatus: overrides.status ?? "eligible",
    safetyScore: 0.95,
    recommended: true,
    reasons: [],
    blockers: [],
    evaluationSnapshot: {
      vendorId: overrides.vendorId ?? "vendor_thermo",
      productIds: ["prod_1"],
      totalAmount: overrides.totalAmount ?? 100_000,
      historyCount: 5,
      hazardCodesSeen: [],
    },
    evaluatedAt: overrides.evaluatedAt ?? "2026-04-09T09:00:00.000Z",
  };
}

// ── S1 ──────────────────────────────────────────────────────────────────────

describe("findSimilarEligible", () => {
  it("S1: vendor 동일 + eligible 건만 반환한다", () => {
    const target = makeRec({ caseId: "a", vendorId: "v1", totalAmount: 500 });
    const similar = makeRec({ caseId: "b", vendorId: "v1", totalAmount: 300 });
    const other = makeRec({ caseId: "c", vendorId: "v2", totalAmount: 400 });

    const result = findSimilarEligible("a", [target, similar, other]);

    expect(result.map((r) => r.procurementCaseId)).toEqual(["b"]);
  });

  it("S2: vendor 다른 건은 제외된다", () => {
    const target = makeRec({ caseId: "a", vendorId: "v1" });
    const other = makeRec({ caseId: "b", vendorId: "v2" });

    expect(findSimilarEligible("a", [target, other])).toEqual([]);
  });

  it("S3: eligible 이 아닌 건은 제외된다", () => {
    const target = makeRec({ caseId: "a", vendorId: "v1" });
    const stale = makeRec({ caseId: "b", vendorId: "v1", status: "stale" });
    const accepted = makeRec({
      caseId: "c",
      vendorId: "v1",
      status: "accepted",
    });
    const dismissed = makeRec({
      caseId: "d",
      vendorId: "v1",
      status: "dismissed",
    });
    const notEligible = makeRec({
      caseId: "e",
      vendorId: "v1",
      status: "not_eligible",
    });

    const result = findSimilarEligible("a", [
      target,
      stale,
      accepted,
      dismissed,
      notEligible,
    ]);
    expect(result).toEqual([]);
  });

  it("S4: target 자기 자신은 제외된다", () => {
    const target = makeRec({ caseId: "a", vendorId: "v1" });
    expect(findSimilarEligible("a", [target])).toEqual([]);
  });

  it("S5: amount_desc 로 정렬된다 (기본)", () => {
    const target = makeRec({ caseId: "a", vendorId: "v1", totalAmount: 100 });
    const small = makeRec({ caseId: "b", vendorId: "v1", totalAmount: 200 });
    const big = makeRec({ caseId: "c", vendorId: "v1", totalAmount: 900 });
    const mid = makeRec({ caseId: "d", vendorId: "v1", totalAmount: 500 });

    const result = findSimilarEligible("a", [target, small, big, mid]);
    expect(result.map((r) => r.procurementCaseId)).toEqual(["c", "d", "b"]);
  });

  it("S6: limit 이 적용된다", () => {
    const target = makeRec({ caseId: "a", vendorId: "v1" });
    const others = Array.from({ length: 10 }, (_, i) =>
      makeRec({
        caseId: `case_${i}`,
        vendorId: "v1",
        totalAmount: 1000 - i,
      }),
    );
    const result = findSimilarEligible("a", [target, ...others], {
      ...DEFAULT_SIMILARITY_POLICY,
      limit: 3,
    });
    expect(result).toHaveLength(3);
  });

  it("S7: target 이 목록에 없으면 빈 배열", () => {
    expect(findSimilarEligible("missing", [makeRec({ caseId: "a" })])).toEqual(
      [],
    );
  });

  it("S8: 금액 차이가 커도 vendor 같으면 포함된다", () => {
    const target = makeRec({
      caseId: "a",
      vendorId: "v1",
      totalAmount: 100,
    });
    const huge = makeRec({
      caseId: "b",
      vendorId: "v1",
      totalAmount: 10_000_000,
    });
    const result = findSimilarEligible("a", [target, huge]);
    expect(result.map((r) => r.procurementCaseId)).toEqual(["b"]);
  });
});

// ── hasUnseenEligible ───────────────────────────────────────────────────────

describe("hasUnseenEligible", () => {
  it("S9a: eligible 이면서 dismissed 에 없으면 true", () => {
    const recs = [makeRec({ objectId: "o1", status: "eligible" })];
    expect(hasUnseenEligible(recs, new Set())).toBe(true);
  });

  it("S9b: 모든 eligible 이 dismissed 에 포함되면 false", () => {
    const recs = [makeRec({ objectId: "o1", status: "eligible" })];
    expect(hasUnseenEligible(recs, new Set(["o1"]))).toBe(false);
  });

  it("S9c: eligible 이 아예 없으면 false", () => {
    const recs = [makeRec({ objectId: "o1", status: "stale" })];
    expect(hasUnseenEligible(recs, new Set())).toBe(false);
  });
});

// ── selectUnseenEligible ────────────────────────────────────────────────────

describe("selectUnseenEligible", () => {
  it("S10a: amount_desc 로 정렬되며 dismissed 는 제외된다", () => {
    const recs = [
      makeRec({ objectId: "o1", caseId: "a", totalAmount: 100 }),
      makeRec({ objectId: "o2", caseId: "b", totalAmount: 900 }),
      makeRec({ objectId: "o3", caseId: "c", totalAmount: 500 }),
    ];
    const result = selectUnseenEligible(recs, new Set(["o3"]));
    expect(result.map((r) => r.procurementCaseId)).toEqual(["b", "a"]);
  });

  it("S10b: limit 기본값 5 적용", () => {
    const recs = Array.from({ length: 8 }, (_, i) =>
      makeRec({
        objectId: `o${i}`,
        caseId: `c${i}`,
        totalAmount: 1000 - i,
      }),
    );
    expect(selectUnseenEligible(recs, new Set())).toHaveLength(5);
  });
});
