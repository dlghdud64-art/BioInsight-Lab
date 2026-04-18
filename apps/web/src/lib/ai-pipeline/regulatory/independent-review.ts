/**
 * @module independent-review
 * @description 독립 검토 관리 — 내부·외부 감사, 피어 리뷰, 규제 심사의 수행 및 발견 사항 추적 엔진
 */

/** 검토 유형 */
export type ReviewType = 'INTERNAL_AUDIT' | 'EXTERNAL_AUDIT' | 'PEER_REVIEW' | 'REGULATORY_EXAM';

/** 발견 사항 심각도 */
export type FindingSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';

/** 발견 사항 상태 */
export type FindingStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED' | 'DEFERRED';

/** 검토 발견 사항 */
export interface ReviewFinding {
  /** 발견 사항 ID */
  id: string;
  /** 검토 ID */
  reviewId: string;
  /** 심각도 */
  severity: FindingSeverity;
  /** 설명 */
  description: string;
  /** 권고사항 */
  recommendation: string;
  /** 경영진 응답 */
  managementResponse: string;
  /** 상태 */
  status: FindingStatus;
}

/** 전체 평가 결과 */
export type OverallAssessment = 'SATISFACTORY' | 'NEEDS_IMPROVEMENT' | 'UNSATISFACTORY' | 'IN_PROGRESS';

/** 검토 기록 */
export interface ReviewRecord {
  /** 검토 ID */
  id: string;
  /** 검토 유형 */
  type: ReviewType;
  /** 검토 범위 */
  scope: string;
  /** 검토자 */
  reviewer: string;
  /** 시작 일시 */
  startedAt: Date;
  /** 완료 일시 */
  completedAt: Date | null;
  /** 발견 사항 목록 */
  findings: ReviewFinding[];
  /** 전체 평가 */
  overallAssessment: OverallAssessment;
}

/** 인메모리 검토 저장소 */
const reviewStore: ReviewRecord[] = [];

/**
 * 새로운 검토를 시작한다.
 * @param params 검토 파라미터
 * @returns 생성된 검토 기록
 */
export function initiateReview(params: {
  id: string;
  type: ReviewType;
  scope: string;
  reviewer: string;
}): ReviewRecord {
  const review: ReviewRecord = {
    id: params.id,
    type: params.type,
    scope: params.scope,
    reviewer: params.reviewer,
    startedAt: new Date(),
    completedAt: null,
    findings: [],
    overallAssessment: 'IN_PROGRESS',
  };
  reviewStore.push(review);
  return review;
}

/**
 * 검토에 발견 사항을 기록한다.
 * @param finding 발견 사항
 * @returns 기록된 발견 사항 또는 null
 */
export function recordFinding(finding: ReviewFinding): ReviewFinding | null {
  const review = reviewStore.find((r) => r.id === finding.reviewId);
  if (!review) return null;

  review.findings.push(finding);
  return finding;
}

/**
 * 검토를 완료한다.
 * @param reviewId 검토 ID
 * @param overallAssessment 전체 평가
 * @returns 완료된 검토 기록 또는 null
 */
export function completeReview(reviewId: string, overallAssessment: OverallAssessment): ReviewRecord | null {
  const review = reviewStore.find((r) => r.id === reviewId);
  if (!review) return null;

  review.completedAt = new Date();
  review.overallAssessment = overallAssessment;
  return review;
}

/**
 * 검토 이력을 반환한다.
 * @param type 검토 유형 (선택, 미지정 시 전체)
 * @returns 검토 기록 배열 (최신순)
 */
export function getReviewHistory(type?: ReviewType): ReviewRecord[] {
  const records = type ? reviewStore.filter((r) => r.type === type) : [...reviewStore];
  return records.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
}

/**
 * 발견 사항의 해결 상태를 추적한다.
 * @param findingId 발견 사항 ID
 * @param status 새로운 상태
 * @param managementResponse 경영진 응답 (선택)
 * @returns 갱신된 발견 사항 또는 null
 */
export function trackFindingClosure(
  findingId: string,
  status: FindingStatus,
  managementResponse?: string
): ReviewFinding | null {
  for (const review of reviewStore) {
    const finding = review.findings.find((f) => f.id === findingId);
    if (finding) {
      finding.status = status;
      if (managementResponse) finding.managementResponse = managementResponse;
      return finding;
    }
  }
  return null;
}
