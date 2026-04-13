// @ts-nocheck — shadow pipeline: experimental code, type-check deferred
/**
 * Exclusion Learning - 제외 패턴 추가/제거 학습기
 *
 * 처리 이력을 분석하여 제외 패턴의 추가(ADD) 및 제거(REMOVE)를 제안합니다.
 *
 * 안전 규칙:
 * - ADD 제안: 안전성 향상이므로 자동 승인 (승인 절차 불필요)
 * - REMOVE 제안: 최소 90일 안정성 + false-safe 제로 조건 필수
 * - false-safe 이력이 있는 패턴의 REMOVE는 절대 차단
 */

import { db } from "@/lib/db";

// --- 타입 정의 ---

/** 패턴 유형 */
export type PatternType = "VENDOR" | "TEMPLATE";

/** 제안 액션 */
export type ExclusionAction = "ADD" | "REMOVE";

/** 제외 패턴 제안 */
export interface ExclusionProposal {
  /** 제안 고유 식별자 */
  proposalId: string;
  /** 문서 유형 */
  documentType: string;
  /** 제외 패턴 (정규식 또는 문자열) */
  pattern: string;
  /** 패턴 유형 */
  patternType: PatternType;
  /** 제안 액션 */
  action: ExclusionAction;
  /** 제안 근거 */
  rationale: string;
  /** 패턴의 안정적 유지 일수 */
  stabilityDays: number;
  /** false-safe 이력 건수 */
  falseSafeHistory: number;
  /** 차단 여부 */
  blocked: boolean;
  /** 차단 사유 (차단 시에만 존재) */
  blockReason: string | null;
}

// --- 상수 ---

/** REMOVE 제안에 필요한 최소 안정 일수 */
const MINIMUM_STABILITY_DAYS = 90;

// --- 인메모리 제외 패턴 저장소 (production: DB-backed) ---
const exclusionStore = new Map<
  string,
  Array<{
    pattern: string;
    patternType: PatternType;
    addedAt: Date;
  }>
>();

/**
 * 제외 패턴을 등록합니다 (테스트/초기화 용도).
 */
export function registerExclusion(
  documentType: string,
  pattern: string,
  patternType: PatternType,
  addedAt?: Date
): void {
  const existing = exclusionStore.get(documentType) ?? [];
  existing.push({ pattern, patternType, addedAt: addedAt ?? new Date() });
  exclusionStore.set(documentType, existing);
}

/**
 * 고유 제안 ID를 생성합니다.
 */
function generateProposalId(
  documentType: string,
  action: ExclusionAction,
  pattern: string
): string {
  const timestamp = Date.now();
  const patternHash = pattern.slice(0, 8).replace(/[^a-zA-Z0-9]/g, "");
  return `EX-${documentType}-${action}-${patternHash}-${timestamp}`;
}

/**
 * 특정 문서 유형에 대해 제외 패턴 추가/제거를 제안합니다.
 *
 * ADD 제안: 자동 승인 가능 (안전성 향상)
 * REMOVE 제안: 아래 조건을 모두 충족해야 함
 *   - 최소 90일 이상 안정적으로 유지
 *   - false-safe 이력 제로
 *
 * HARD BLOCK:
 * - false-safe 이력이 하나라도 있는 패턴의 REMOVE는 절대 차단
 *
 * @param documentType 분석할 문서 유형
 * @returns 제외 패턴 제안 배열
 */
export async function proposeExclusionChanges(
  documentType: string
): Promise<ExclusionProposal[]> {
  const proposals: ExclusionProposal[] = [];

  // --- ADD 제안: 반복적으로 리뷰 트리거되는 패턴 감지 ---
  const frequentPatterns = await db.$queryRawUnsafe<
    Array<{
      pattern: string;
      pattern_type: string;
      occurrence_count: number;
      false_safe_count: number;
    }>
  >(
    `
    SELECT
      vendor_pattern as pattern,
      pattern_type,
      COUNT(*) as occurrence_count,
      SUM(CASE WHEN is_false_safe = true THEN 1 ELSE 0 END) as false_safe_count
    FROM "ProcessingLog"
    WHERE document_type = $1
      AND review_triggered = true
      AND vendor_pattern IS NOT NULL
      AND vendor_pattern NOT IN (
        SELECT pattern FROM "ExclusionPattern" WHERE document_type = $1
      )
    GROUP BY vendor_pattern, pattern_type
    HAVING COUNT(*) >= 5
    ORDER BY COUNT(*) DESC
    `,
    documentType
  );

  for (const fp of frequentPatterns) {
    // ADD 제안은 안전성 향상이므로 자동 승인 (차단 없음)
    proposals.push({
      proposalId: generateProposalId(documentType, "ADD", fp.pattern),
      documentType,
      pattern: fp.pattern,
      patternType: fp.pattern_type as PatternType,
      action: "ADD",
      rationale: `${fp.occurrence_count}회 반복적으로 리뷰가 트리거된 패턴 → 제외 목록 추가로 불필요한 리뷰 감소`,
      stabilityDays: 0,
      falseSafeHistory: Number(fp.false_safe_count),
      blocked: false, // ADD는 항상 비차단 (안전성 향상)
      blockReason: null,
    });
  }

  // --- REMOVE 제안: 기존 제외 패턴 중 제거 가능한 것 검토 ---
  const currentExclusions = exclusionStore.get(documentType) ?? [];
  const now = new Date();

  for (const exclusion of currentExclusions) {
    // 안정 유지 일수 계산
    const stabilityDays = Math.floor(
      (now.getTime() - exclusion.addedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // DB에서 해당 패턴의 false-safe 이력 조회
    const falseSafeResult = await db.$queryRawUnsafe<
      Array<{ false_safe_count: number }>
    >(
      `
      SELECT COUNT(*) as false_safe_count
      FROM "ProcessingLog"
      WHERE document_type = $1
        AND vendor_pattern = $2
        AND is_false_safe = true
      `,
      documentType,
      exclusion.pattern
    );

    const falseSafeHistory = Number(falseSafeResult[0]?.false_safe_count ?? 0);

    let blocked = false;
    let blockReason: string | null = null;

    // HARD BLOCK: false-safe 이력이 하나라도 있으면 REMOVE 절대 차단
    if (falseSafeHistory > 0) {
      blocked = true;
      blockReason = `False-safe 이력이 ${falseSafeHistory}건 존재하여 제외 패턴 제거가 차단됩니다`;
    }

    // 안정 기간 미달 시 차단
    if (!blocked && stabilityDays < MINIMUM_STABILITY_DAYS) {
      blocked = true;
      blockReason = `안정 유지 기간 부족: ${stabilityDays}일 < 최소 ${MINIMUM_STABILITY_DAYS}일`;
    }

    proposals.push({
      proposalId: generateProposalId(
        documentType,
        "REMOVE",
        exclusion.pattern
      ),
      documentType,
      pattern: exclusion.pattern,
      patternType: exclusion.patternType,
      action: "REMOVE",
      rationale: `제외 패턴 '${exclusion.pattern}'의 제거 가능성 검토 (안정 유지: ${stabilityDays}일)`,
      stabilityDays,
      falseSafeHistory,
      blocked,
      blockReason,
    });
  }

  return proposals;
}
