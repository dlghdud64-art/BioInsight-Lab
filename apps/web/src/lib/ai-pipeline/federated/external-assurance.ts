/**
 * @module external-assurance
 * @description 외부 보증 수준 평가
 *
 * 연합 네트워크 파트너의 신뢰 보증 수준을 다양한 요인(인증서, 감사 이력,
 * 사고 기록 등)을 기반으로 평가하고 관리한다.
 */

/** 보증 수준 */
export type AssuranceLevel = "HIGH" | "MODERATE" | "LOW" | "UNASSURED";

/** 보증 평가 요인 */
export interface AssuranceFactor {
  name: string;
  weight: number;
  score: number;
  details: string;
}

/** 보증 평가 결과 */
export interface AssuranceAssessment {
  partnerId: string;
  level: AssuranceLevel;
  factors: AssuranceFactor[];
  score: number;
  assessedAt: Date;
  nextReviewAt: Date;
}

/** 인메모리 보증 평가 저장소 */
const assessmentStore: AssuranceAssessment[] = [];

/**
 * 점수를 보증 수준으로 변환한다.
 * @param score 0~100 범위의 점수
 * @returns 보증 수준
 */
function scoreToLevel(score: number): AssuranceLevel {
  if (score >= 80) return "HIGH";
  if (score >= 60) return "MODERATE";
  if (score >= 40) return "LOW";
  return "UNASSURED";
}

/**
 * 파트너의 보증 수준을 평가한다.
 * @param partnerId 평가할 파트너 ID
 * @param factors 평가 요인 목록
 * @param reviewIntervalDays 다음 평가까지의 일수 (기본: 90)
 * @returns 보증 평가 결과
 */
export function assessPartnerAssurance(
  partnerId: string,
  factors: AssuranceFactor[],
  reviewIntervalDays: number = 90,
): AssuranceAssessment {
  if (factors.length === 0) {
    throw new Error("보증 평가에는 최소 1개 이상의 요인이 필요합니다.");
  }

  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  if (totalWeight === 0) {
    throw new Error("요인의 총 가중치가 0일 수 없습니다.");
  }

  const weightedScore =
    factors.reduce((sum, f) => sum + f.score * f.weight, 0) / totalWeight;
  const normalizedScore = Math.round(Math.min(100, Math.max(0, weightedScore)));

  const now = new Date();
  const nextReview = new Date(now);
  nextReview.setDate(nextReview.getDate() + reviewIntervalDays);

  const assessment: AssuranceAssessment = {
    partnerId,
    level: scoreToLevel(normalizedScore),
    factors: [...factors],
    score: normalizedScore,
    assessedAt: now,
    nextReviewAt: nextReview,
  };

  // 기존 평가가 있으면 교체
  const existingIdx = assessmentStore.findIndex(
    (a) => a.partnerId === partnerId,
  );
  if (existingIdx >= 0) {
    assessmentStore[existingIdx] = assessment;
  } else {
    assessmentStore.push(assessment);
  }

  return assessment;
}

/**
 * 파트너의 현재 보증 수준을 조회한다.
 * @param partnerId 조회할 파트너 ID
 * @returns 보증 평가 결과 또는 undefined
 */
export function getAssuranceLevel(
  partnerId: string,
): AssuranceAssessment | undefined {
  return assessmentStore.find((a) => a.partnerId === partnerId);
}

/**
 * 파트너의 재평가 일정을 변경한다.
 * @param partnerId 대상 파트너 ID
 * @param nextReviewAt 다음 평가 일시
 * @returns 갱신된 보증 평가 결과
 * @throws 평가 기록을 찾을 수 없는 경우
 */
export function scheduleReassessment(
  partnerId: string,
  nextReviewAt: Date,
): AssuranceAssessment {
  const assessment = assessmentStore.find((a) => a.partnerId === partnerId);
  if (!assessment) {
    throw new Error(
      `파트너 '${partnerId}'의 보증 평가 기록을 찾을 수 없습니다.`,
    );
  }

  assessment.nextReviewAt = nextReviewAt;
  return assessment;
}
