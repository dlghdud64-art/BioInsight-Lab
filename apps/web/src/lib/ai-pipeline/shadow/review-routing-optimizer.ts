/**
 * review-routing-optimizer.ts
 * 리뷰 큐 동적 우선순위 라우팅 최적화.
 * FIFO가 아닌 위험도 x 해결 가치 기반으로 정렬한다.
 *
 * 우선순위 규칙:
 *   P0 — 위양성(false-safe) 후보, 자동 검증 위험
 *   P1 — 고신뢰 충돌 항목
 *   P2 — 문서 유형 차이 항목
 *   P3 — 기타
 */

// ──────────────────────────────────────────────
// 타입 정의
// ──────────────────────────────────────────────

/** 라우팅 우선순위 */
export type RoutingPriority = "P0" | "P1" | "P2" | "P3";

/** 리뷰 항목 유형 */
export type ReviewItemType =
  | "FALSE_SAFE_CANDIDATE"   // 위양성 안전 후보 → P0
  | "AUTO_VERIFY_RISK"       // 자동 검증 위험 → P0
  | "HIGH_CONFIDENCE_CONFLICT" // 고신뢰 충돌 → P1
  | "DOC_TYPE_DIFF"          // 문서 유형 차이 → P2
  | "GENERAL";               // 기타 → P3

/** 리뷰 항목 입력 */
export interface ReviewItem {
  reviewItemId: string;
  itemType: ReviewItemType;
  riskScore: number;            // 위험 점수 (0-100)
  resolutionValueScore: number; // 해결 가치 점수 (0-100)
  documentType: string;
  assigneeHint: string | null;  // 담당자 힌트 (특정 전문가 등)
  createdAt: Date;
}

/** 라우팅 점수 결과 */
export interface ReviewRoutingScore {
  reviewItemId: string;
  riskScore: number;
  resolutionValueScore: number;
  totalScore: number;           // riskScore * resolutionValueScore
  routingPriority: RoutingPriority;
  assignmentHint: string | null;
}

// ──────────────────────────────────────────────
// 우선순위 매핑
// ──────────────────────────────────────────────

/** 리뷰 항목 유형 → 라우팅 우선순위 매핑 */
const PRIORITY_MAP: Record<ReviewItemType, RoutingPriority> = {
  FALSE_SAFE_CANDIDATE: "P0",
  AUTO_VERIFY_RISK: "P0",
  HIGH_CONFIDENCE_CONFLICT: "P1",
  DOC_TYPE_DIFF: "P2",
  GENERAL: "P3",
};

/** 우선순위 숫자값 (정렬용, 낮을수록 높은 우선순위) */
const PRIORITY_ORDER: Record<RoutingPriority, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
};

// ──────────────────────────────────────────────
// 핵심 함수
// ──────────────────────────────────────────────

/**
 * 개별 리뷰 항목의 라우팅 점수 계산
 *
 * - 총합 점수 = riskScore * resolutionValueScore
 * - 우선순위는 항목 유형에 따라 결정 (P0 > P1 > P2 > P3)
 * - 담당자 힌트는 항목의 문서 유형 또는 명시적 힌트 기반
 */
export function computeReviewRouting(
  reviewItem: ReviewItem
): ReviewRoutingScore {
  const routingPriority = PRIORITY_MAP[reviewItem.itemType];
  const totalScore = reviewItem.riskScore * reviewItem.resolutionValueScore;

  // 담당자 힌트 결정
  let assignmentHint: string | null = reviewItem.assigneeHint;
  if (!assignmentHint) {
    // P0 항목은 시니어 리뷰어에게 자동 할당 힌트
    if (routingPriority === "P0") {
      assignmentHint = "SENIOR_REVIEWER";
    }
  }

  return {
    reviewItemId: reviewItem.reviewItemId,
    riskScore: reviewItem.riskScore,
    resolutionValueScore: reviewItem.resolutionValueScore,
    totalScore,
    routingPriority,
    assignmentHint,
  };
}

/**
 * 리뷰 큐 전체 최적화 라우팅
 *
 * 정렬 기준 (FIFO가 아닌 위험도 x 해결 가치 기반):
 * 1차: 우선순위 (P0 → P3)
 * 2차: 총합 점수 (내림차순, 높은 가치 먼저)
 */
export function optimizeQueueRouting(
  items: ReviewItem[]
): ReviewRoutingScore[] {
  // 각 항목의 라우팅 점수 계산
  const scores = items.map((item) => computeReviewRouting(item));

  // 정렬: 우선순위 오름차순 → 총합 점수 내림차순
  scores.sort((a, b) => {
    const priorityDiff =
      PRIORITY_ORDER[a.routingPriority] - PRIORITY_ORDER[b.routingPriority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.totalScore - a.totalScore; // 높은 점수 먼저
  });

  return scores;
}

/**
 * 우선순위별 항목 수 요약
 */
export function summarizeQueueDistribution(
  scores: ReviewRoutingScore[]
): Record<RoutingPriority, number> {
  const distribution: Record<RoutingPriority, number> = {
    P0: 0,
    P1: 0,
    P2: 0,
    P3: 0,
  };

  for (const score of scores) {
    distribution[score.routingPriority]++;
  }

  return distribution;
}
