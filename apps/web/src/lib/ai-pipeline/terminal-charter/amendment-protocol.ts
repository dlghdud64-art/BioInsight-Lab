/**
 * @module amendment-protocol
 * @description 개정 프로토콜 (9단계) — 개정 가능한 영역이라 하더라도
 * 반드시 9단계 프로토콜(영향 스캔 → 호환성 검사 → 제한적 파일럿 → 동료 검토 →
 * 승인 체인 → 해석 아카이브 → 단계적 배포 → 모니터링 → 최종화)을 거쳐야 한다.
 */

/** 개정 단계 */
export type AmendmentPhase =
  | "IMPACT_SCAN"
  | "COMPATIBILITY_CHECK"
  | "LIMITED_PILOT"
  | "PEER_REVIEW"
  | "APPROVAL_CHAIN"
  | "INTERPRETATION_ARCHIVE"
  | "PHASED_ROLLOUT"
  | "MONITORING"
  | "FINALIZED";

/** 개정 요청 */
export interface AmendmentRequest {
  /** 요청 고유 ID */
  id: string;
  /** 개정 대상 */
  target: string;
  /** 개정 설명 */
  description: string;
  /** 현재 단계 */
  phase: AmendmentPhase;
  /** 제안자 */
  proposedBy: string;
  /** 승인 기록 */
  approvals: AmendmentApproval[];
  /** 파일럿 결과 */
  pilotResults: string | null;
  /** 아카이브된 해석 */
  archivedInterpretation: string | null;
  /** 제안 일시 */
  proposedAt: Date;
}

/** 승인 기록 */
export interface AmendmentApproval {
  /** 승인자 */
  approver: string;
  /** 승인 일시 */
  approvedAt: Date;
  /** 의견 */
  comment: string;
}

/** 단계 순서 정의 */
const PHASE_ORDER: AmendmentPhase[] = [
  "IMPACT_SCAN",
  "COMPATIBILITY_CHECK",
  "LIMITED_PILOT",
  "PEER_REVIEW",
  "APPROVAL_CHAIN",
  "INTERPRETATION_ARCHIVE",
  "PHASED_ROLLOUT",
  "MONITORING",
  "FINALIZED",
];

/** 인메모리 개정 요청 저장소 */
const amendments: Map<string, AmendmentRequest> = new Map();

/** 개정 이력 (최종화된 요청 아카이브) */
const amendmentHistory: AmendmentRequest[] = [];

/**
 * 새 개정을 제안한다. 항상 IMPACT_SCAN 단계에서 시작한다.
 * @param target - 개정 대상
 * @param description - 개정 설명
 * @param proposedBy - 제안자
 * @returns 생성된 개정 요청
 */
export function proposeAmendment(
  target: string,
  description: string,
  proposedBy: string
): AmendmentRequest {
  const request: AmendmentRequest = {
    id: `AMEND-${Date.now()}-${amendments.size}`,
    target,
    description,
    phase: "IMPACT_SCAN",
    proposedBy,
    approvals: [],
    pilotResults: null,
    archivedInterpretation: null,
    proposedAt: new Date(),
  };

  amendments.set(request.id, request);
  return { ...request };
}

/**
 * 개정 요청을 다음 단계로 진행한다.
 * 단계를 건너뛸 수 없으며, 이미 FINALIZED된 요청은 진행 불가.
 * @param amendmentId - 개정 요청 ID
 * @returns 진행 결과 { success, currentPhase, error }
 */
export function advancePhase(
  amendmentId: string
): { success: boolean; currentPhase: AmendmentPhase; error: string | null } {
  const request = amendments.get(amendmentId);
  if (!request) {
    return {
      success: false,
      currentPhase: "IMPACT_SCAN",
      error: `개정 요청 [${amendmentId}]을(를) 찾을 수 없음`,
    };
  }

  if (request.phase === "FINALIZED") {
    return {
      success: false,
      currentPhase: "FINALIZED",
      error: "이미 최종화된 개정 요청은 진행할 수 없음",
    };
  }

  const currentIndex = PHASE_ORDER.indexOf(request.phase);
  const nextPhase = PHASE_ORDER[currentIndex + 1];

  // 단계별 전제조건 검증
  const prerequisiteError = checkPhasePrerequisite(request, nextPhase);
  if (prerequisiteError) {
    return {
      success: false,
      currentPhase: request.phase,
      error: prerequisiteError,
    };
  }

  request.phase = nextPhase;

  // FINALIZED 도달 시 이력에 아카이브
  if (nextPhase === "FINALIZED") {
    amendmentHistory.push({ ...request });
  }

  return { success: true, currentPhase: nextPhase, error: null };
}

/**
 * 개정 요청에 승인을 추가한다.
 * @param amendmentId - 개정 요청 ID
 * @param approver - 승인자
 * @param comment - 의견
 * @returns 승인 추가 성공 여부
 */
export function approveAmendment(
  amendmentId: string,
  approver: string,
  comment: string
): boolean {
  const request = amendments.get(amendmentId);
  if (!request || request.phase === "FINALIZED") return false;

  request.approvals.push({
    approver,
    approvedAt: new Date(),
    comment,
  });
  return true;
}

/**
 * 해석을 아카이브한다. INTERPRETATION_ARCHIVE 단계 전제조건.
 * @param amendmentId - 개정 요청 ID
 * @param interpretation - 아카이브할 해석 내용
 * @returns 아카이브 성공 여부
 */
export function archiveInterpretation(
  amendmentId: string,
  interpretation: string
): boolean {
  const request = amendments.get(amendmentId);
  if (!request) return false;

  request.archivedInterpretation = interpretation;
  return true;
}

/**
 * 파일럿 결과를 기록한다. LIMITED_PILOT 단계 전제조건.
 * @param amendmentId - 개정 요청 ID
 * @param results - 파일럿 결과
 * @returns 기록 성공 여부
 */
export function recordPilotResults(
  amendmentId: string,
  results: string
): boolean {
  const request = amendments.get(amendmentId);
  if (!request) return false;

  request.pilotResults = results;
  return true;
}

/**
 * 전체 개정 이력을 반환한다.
 * @returns 최종화된 개정 요청 배열
 */
export function getAmendmentHistory(): AmendmentRequest[] {
  return [...amendmentHistory];
}

/**
 * 현재 진행 중인 개정 요청을 반환한다.
 * @returns 진행 중인 개정 요청 배열
 */
export function getPendingAmendments(): AmendmentRequest[] {
  return Array.from(amendments.values()).filter(
    (a) => a.phase !== "FINALIZED"
  );
}

/** 단계별 전제조건 검증 */
function checkPhasePrerequisite(
  request: AmendmentRequest,
  nextPhase: AmendmentPhase
): string | null {
  switch (nextPhase) {
    case "PEER_REVIEW":
      if (!request.pilotResults) {
        return "파일럿 결과가 기록되지 않아 동료 검토로 진행할 수 없음";
      }
      return null;
    case "APPROVAL_CHAIN":
      if (request.approvals.length === 0) {
        return "최소 1건의 승인이 필요함";
      }
      return null;
    case "INTERPRETATION_ARCHIVE":
      if (!request.archivedInterpretation) {
        return "해석 아카이브가 완료되지 않아 진행 불가";
      }
      return null;
    default:
      return null;
  }
}
