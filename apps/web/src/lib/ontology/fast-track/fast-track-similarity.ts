/**
 * Fast-Track Similarity — Pure functions for Copilot Intercept UX.
 *
 * 설계 원칙:
 * - side effect 금지 (store touch X, event publish X, I/O X).
 * - input/output이 모두 이미 계산된 FastTrackRecommendationObject view.
 * - canonical truth 를 조회하지 않는다. "현재 이 세션에서 computed 된 것들 중"
 *   유사한 건을 찾을 뿐이며, 실제 승인 실행은 caller 가 기존 경로
 *   (useFastTrackStore.markAccepted → finalizeApproval) 로 진행한다.
 *
 * 확장성:
 * - vendor/budget/category 등 매칭 축을 추가할 때는 `SimilarityPolicy` 의
 *   새 필드와 predicate 를 추가하고, findSimilarEligible 내부에서 AND 조건으로
 *   합치면 된다. 기본 정책 `DEFAULT_SIMILARITY_POLICY` 는 최소(vendor 동일)만
 *   활성화되어 있다.
 */

import type { FastTrackRecommendationObject } from "@/lib/ontology/types";

/**
 * 유사도 판정 정책. 모든 필드는 optional 이고,
 * true 로 설정된 축만 predicate 에 반영된다.
 */
export interface SimilarityPolicy {
  /** vendorId 동일 (기본: true) */
  matchVendor: boolean;
  /** budgetId 동일 (기본: false — FastTrack snapshot 에 아직 미포함) */
  matchBudget?: boolean;
  /** 제품 카테고리 교집합 존재 (기본: false — 동일 이유) */
  matchCategory?: boolean;
  /** 결과 최대 개수 (기본: 5) */
  limit: number;
  /** 정렬 기준 (기본: "amount_desc") */
  sortBy: "amount_desc" | "amount_asc" | "evaluated_desc";
}

/**
 * 기본 정책: vendor 동일 + eligible + self 제외, 상위 5건을 금액 내림차순으로.
 *
 * 금액 범위 조건은 **의도적으로 제외**한다.
 * 이유: Fast-Track intercept 는 "같은 공급사에 어차피 발주 한 번 더 갈 거라면
 *      이번 호출에 묶어 보내자"라는 운영 효율화가 목적이므로,
 *      큰 건 + 작은 건을 함께 묶는 시나리오가 오히려 가치 있다.
 *      ±N% 금액 밴드를 걸면 이 시나리오를 막는 반직관적 동작이 된다.
 */
export const DEFAULT_SIMILARITY_POLICY: SimilarityPolicy = {
  matchVendor: true,
  matchBudget: false,
  matchCategory: false,
  limit: 5,
  sortBy: "amount_desc",
};

/**
 * 주어진 target 과 "유사"하고, 현재 eligible 상태이며, target 자기 자신이
 * 아닌 recommendation 들만 골라 policy 기준으로 정렬/제한하여 반환한다.
 *
 * @param targetCaseId   기준이 되는 procurementCaseId
 * @param all            현재 세션에 computed 된 모든 recommendation (store snapshot)
 * @param policy         매칭 축/정렬/제한 정책 (미지정 시 DEFAULT_SIMILARITY_POLICY)
 */
export function findSimilarEligible(
  targetCaseId: string,
  all: readonly FastTrackRecommendationObject[],
  policy: SimilarityPolicy = DEFAULT_SIMILARITY_POLICY,
): FastTrackRecommendationObject[] {
  const target = all.find((r) => r.procurementCaseId === targetCaseId);
  if (!target) return [];

  const candidates = all.filter((r) => {
    // 1) 자기 자신 제외 — intercept 는 "이 건 말고 또 N건" 이 핵심 문구
    if (r.procurementCaseId === targetCaseId) return false;
    // 2) eligible 만 — stale/dismissed/accepted 는 제안 대상 아님
    if (r.recommendationStatus !== "eligible") return false;
    // 3) vendor 동일 (정책 활성 시)
    if (policy.matchVendor) {
      if (r.evaluationSnapshot.vendorId !== target.evaluationSnapshot.vendorId) {
        return false;
      }
    }
    // 4) 확장 슬롯 — FastTrackEvaluationSnapshot 에 budgetId / category 가
    //    추가되는 시점에 아래 주석을 풀기만 하면 된다.
    // if (policy.matchBudget && r.evaluationSnapshot.budgetId !== target.evaluationSnapshot.budgetId) return false;
    // if (policy.matchCategory && !shareCategory(r, target)) return false;
    return true;
  });

  // 정렬
  const sorted = [...candidates].sort((a, b) => {
    switch (policy.sortBy) {
      case "amount_desc":
        return b.evaluationSnapshot.totalAmount - a.evaluationSnapshot.totalAmount;
      case "amount_asc":
        return a.evaluationSnapshot.totalAmount - b.evaluationSnapshot.totalAmount;
      case "evaluated_desc":
        return (
          new Date(b.evaluatedAt).getTime() - new Date(a.evaluatedAt).getTime()
        );
      default:
        return 0;
    }
  });

  return sorted.slice(0, Math.max(0, policy.limit));
}

/**
 * Proactive entry modal 게이트: 현재 eligible 중 아직 세션에서 사용자가
 * dismiss 하지 않은 recommendationObjectId 가 하나라도 있는지.
 *
 * dismissedObjectIds 는 proactive session store 가 관리한다.
 * 여기서는 순수 함수로만 두어 테스트/재사용을 쉽게 한다.
 */
export function hasUnseenEligible(
  recs: readonly FastTrackRecommendationObject[],
  dismissedObjectIds: ReadonlySet<string>,
): boolean {
  return recs.some(
    (r) =>
      r.recommendationStatus === "eligible" &&
      !dismissedObjectIds.has(r.objectId),
  );
}

/**
 * Proactive entry modal 에 노출할 "아직 못 본" eligible 목록.
 * dismissedObjectIds 에 포함된 것은 제외하며, 금액 내림차순 + 기본 cap 5건.
 */
export function selectUnseenEligible(
  recs: readonly FastTrackRecommendationObject[],
  dismissedObjectIds: ReadonlySet<string>,
  limit = 5,
): FastTrackRecommendationObject[] {
  return recs
    .filter(
      (r) =>
        r.recommendationStatus === "eligible" &&
        !dismissedObjectIds.has(r.objectId),
    )
    .sort(
      (a, b) =>
        b.evaluationSnapshot.totalAmount - a.evaluationSnapshot.totalAmount,
    )
    .slice(0, Math.max(0, limit));
}
