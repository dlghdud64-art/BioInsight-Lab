/**
 * @module protocol-admission-gate
 * @description 프로토콜 진입 게이트
 *
 * 새로운 참여자가 보증 생태계에 진입할 때의 자격 요건을 평가한다.
 * 호환성 검사 통과 + 계층별 최소 요건 충족이 필수이며,
 * 진입 이력을 기록하고 조회할 수 있다.
 */

import {
  checkCompatibility,
  type SystemDeclaration,
  type CompatibilityResult,
} from "./protocol-compatibility-engine";

/** 참여자 계층 */
export type AdmissionTier =
  | "OBSERVER"
  | "CONSUMER"
  | "VERIFIED_PARTICIPANT"
  | "ASSERTION_ISSUER"
  | "PROTOCOL_STEWARD";

/** 진입 평가 결과 */
export interface AdmissionResult {
  /** 진입 허용 여부 */
  admitted: boolean;
  /** 배정된 계층 */
  assignedTier: AdmissionTier;
  /** 진입 조건 (부합한 항목) */
  conditions: string[];
  /** 진입 차단 사유 */
  blockers: string[];
}

/** 진입 이력 레코드 */
export interface AdmissionRecord {
  /** 참여자 ID */
  participantId: string;
  /** 요청 계층 */
  requestedTier: AdmissionTier;
  /** 평가 결과 */
  result: AdmissionResult;
  /** 평가 시각 */
  evaluatedAt: number;
}

/** 계층별 최소 요건 */
interface TierRequirement {
  /** 최소 성숙도 점수 */
  minMaturityScore: number;
  /** 호환성 검사 필요 여부 */
  requiresCompatibilityCheck: boolean;
  /** 최소 호환성 결과 */
  minCompatibility: CompatibilityResult;
  /** 추가 요건 설명 */
  additionalRequirements: string[];
}

/** 계층별 최소 요건 맵 */
const TIER_REQUIREMENTS: Record<AdmissionTier, TierRequirement> = {
  OBSERVER: {
    minMaturityScore: 0,
    requiresCompatibilityCheck: false,
    minCompatibility: "INCOMPATIBLE",
    additionalRequirements: [],
  },
  CONSUMER: {
    minMaturityScore: 10,
    requiresCompatibilityCheck: false,
    minCompatibility: "INCOMPATIBLE",
    additionalRequirements: ["기본 신원 확인 필요"],
  },
  VERIFIED_PARTICIPANT: {
    minMaturityScore: 40,
    requiresCompatibilityCheck: true,
    minCompatibility: "ADAPTER_REQUIRED",
    additionalRequirements: ["신원 인증 완료", "기본 호환성 검사 통과"],
  },
  ASSERTION_ISSUER: {
    minMaturityScore: 70,
    requiresCompatibilityCheck: true,
    minCompatibility: "FULLY_COMPATIBLE",
    additionalRequirements: [
      "완전 호환성 검사 통과",
      "철회 경로 구현 확인",
      "이의 제기 처리 역량 보유",
    ],
  },
  PROTOCOL_STEWARD: {
    minMaturityScore: 90,
    requiresCompatibilityCheck: true,
    minCompatibility: "FULLY_COMPATIBLE",
    additionalRequirements: [
      "완전 호환성 검사 통과",
      "거버넌스 참여 이력 보유",
      "프로토콜 수정 제안 경험",
    ],
  },
};

const COMPATIBILITY_RANK: Record<CompatibilityResult, number> = {
  INCOMPATIBLE: 0,
  ADAPTER_REQUIRED: 1,
  FULLY_COMPATIBLE: 2,
};

// --- 인메모리 저장소 ---
const admissionHistory: AdmissionRecord[] = [];

/**
 * 참여자의 진입 자격을 평가한다.
 * @param participantId - 참여자 ID
 * @param requestedTier - 요청 계층
 * @param maturityScore - 성숙도 점수
 * @param systemDeclaration - 시스템 선언 (호환성 검사용)
 * @returns 진입 평가 결과
 */
export function evaluateAdmission(
  participantId: string,
  requestedTier: AdmissionTier,
  maturityScore: number,
  systemDeclaration: SystemDeclaration
): AdmissionResult {
  const req = TIER_REQUIREMENTS[requestedTier];
  const conditions: string[] = [];
  const blockers: string[] = [];

  // 성숙도 검사
  if (maturityScore >= req.minMaturityScore) {
    conditions.push(`성숙도 점수 충족: ${maturityScore} >= ${req.minMaturityScore}`);
  } else {
    blockers.push(`성숙도 점수 미달: ${maturityScore} < ${req.minMaturityScore}`);
  }

  // 호환성 검사
  if (req.requiresCompatibilityCheck) {
    const report = checkCompatibility(systemDeclaration);
    const achieved = COMPATIBILITY_RANK[report.result];
    const required = COMPATIBILITY_RANK[req.minCompatibility];
    if (achieved >= required) {
      conditions.push(`호환성 검사 통과: ${report.result}`);
    } else {
      blockers.push(`호환성 부족: ${report.result} (필요: ${req.minCompatibility})`);
    }
  }

  const admitted = blockers.length === 0;

  const result: AdmissionResult = {
    admitted,
    assignedTier: admitted ? requestedTier : "OBSERVER",
    conditions,
    blockers,
  };

  admissionHistory.push({
    participantId,
    requestedTier,
    result,
    evaluatedAt: Date.now(),
  });

  return result;
}

/**
 * 특정 계층의 진입 요건을 반환한다.
 * @param tier - 계층
 * @returns 진입 요건 설명
 */
export function getAdmissionRequirements(
  tier: AdmissionTier
): { minMaturityScore: number; requirements: string[] } {
  const req = TIER_REQUIREMENTS[tier];
  return {
    minMaturityScore: req.minMaturityScore,
    requirements: [
      ...(req.requiresCompatibilityCheck
        ? [`최소 호환성: ${req.minCompatibility}`]
        : []),
      ...req.additionalRequirements,
    ],
  };
}

/**
 * 진입 이력을 기록한다 (evaluateAdmission 내부에서 자동 기록됨).
 * 외부에서 수동 기록 시 사용.
 * @param record - 진입 이력 레코드
 */
export function recordAdmission(record: AdmissionRecord): void {
  admissionHistory.push(record);
}

/**
 * 특정 참여자의 진입 이력을 반환한다.
 * @param participantId - 참여자 ID
 * @returns 진입 이력 배열
 */
export function getAdmissionHistory(participantId: string): AdmissionRecord[] {
  return admissionHistory.filter((r) => r.participantId === participantId);
}
