/**
 * @module dispute-resolution
 * @description 분쟁 해결 프로세스
 *
 * 연합 네트워크 파트너 간 발생하는 분쟁을 접수하고, 조사, 중재,
 * 해결 또는 에스컬레이션하는 프로세스를 관리한다.
 */

/** 분쟁 상태 */
export type DisputeStatus =
  | "OPENED"
  | "INVESTIGATING"
  | "MEDIATION"
  | "RESOLVED"
  | "ESCALATED";

/** 분쟁 카테고리 */
export type DisputeCategory =
  | "DATA_MISUSE"
  | "CONTRACT_VIOLATION"
  | "EVIDENCE_TAMPERING"
  | "POLICY_BREACH"
  | "SLA_VIOLATION"
  | "CONSENT_VIOLATION";

/** 분쟁 증거 */
export interface DisputeEvidence {
  evidenceId: string;
  description: string;
  submittedBy: string;
  submittedAt: Date;
}

/** 분쟁 */
export interface Dispute {
  id: string;
  complainantId: string;
  respondentId: string;
  category: DisputeCategory;
  status: DisputeStatus;
  evidence: DisputeEvidence[];
  resolution: string | null;
  openedAt: Date;
  resolvedAt: Date | null;
}

/** 분쟁 개시 요청 */
export interface OpenDisputeInput {
  complainantId: string;
  respondentId: string;
  category: DisputeCategory;
  initialEvidence?: DisputeEvidence;
}

/** 인메모리 분쟁 저장소 */
const disputeStore: Dispute[] = [];

/** 고유 ID 생성 */
let disputeSeq = 0;
function nextDisputeId(): string {
  disputeSeq += 1;
  return `dispute-${disputeSeq}`;
}

/**
 * 분쟁을 개시한다.
 * @param input 분쟁 개시 정보
 * @returns 생성된 분쟁
 */
export function openDispute(input: OpenDisputeInput): Dispute {
  if (input.complainantId === input.respondentId) {
    throw new Error("자기 자신에 대한 분쟁은 개시할 수 없습니다.");
  }

  const dispute: Dispute = {
    id: nextDisputeId(),
    complainantId: input.complainantId,
    respondentId: input.respondentId,
    category: input.category,
    status: "OPENED",
    evidence: input.initialEvidence ? [input.initialEvidence] : [],
    resolution: null,
    openedAt: new Date(),
    resolvedAt: null,
  };

  disputeStore.push(dispute);
  return dispute;
}

/**
 * 분쟁 조사를 시작한다.
 * @param disputeId 조사할 분쟁 ID
 * @param additionalEvidence 추가 증거 (선택)
 * @returns 갱신된 분쟁
 * @throws 분쟁을 찾을 수 없거나 상태가 부적합한 경우
 */
export function investigateDispute(
  disputeId: string,
  additionalEvidence?: DisputeEvidence,
): Dispute {
  const dispute = disputeStore.find((d) => d.id === disputeId);
  if (!dispute) {
    throw new Error(`분쟁 '${disputeId}'을(를) 찾을 수 없습니다.`);
  }
  if (dispute.status !== "OPENED") {
    throw new Error(
      `분쟁 상태가 '${dispute.status}'이므로 조사를 시작할 수 없습니다. OPENED 상태여야 합니다.`,
    );
  }

  dispute.status = "INVESTIGATING";
  if (additionalEvidence) {
    dispute.evidence.push(additionalEvidence);
  }

  return dispute;
}

/**
 * 분쟁에 대한 해결안을 제안한다. (중재 단계)
 * @param disputeId 대상 분쟁 ID
 * @param proposedResolution 제안 해결안
 * @returns 갱신된 분쟁
 */
export function proposeResolution(
  disputeId: string,
  proposedResolution: string,
): Dispute {
  const dispute = disputeStore.find((d) => d.id === disputeId);
  if (!dispute) {
    throw new Error(`분쟁 '${disputeId}'을(를) 찾을 수 없습니다.`);
  }
  if (
    dispute.status !== "INVESTIGATING" &&
    dispute.status !== "OPENED"
  ) {
    throw new Error(
      `분쟁 상태가 '${dispute.status}'이므로 해결안을 제안할 수 없습니다.`,
    );
  }

  dispute.status = "MEDIATION";
  dispute.resolution = proposedResolution;
  return dispute;
}

/**
 * 분쟁을 해결한다.
 * @param disputeId 해결할 분쟁 ID
 * @param finalResolution 최종 해결 내용
 * @returns 해결된 분쟁
 */
export function resolveDispute(
  disputeId: string,
  finalResolution: string,
): Dispute {
  const dispute = disputeStore.find((d) => d.id === disputeId);
  if (!dispute) {
    throw new Error(`분쟁 '${disputeId}'을(를) 찾을 수 없습니다.`);
  }
  if (dispute.status === "RESOLVED") {
    throw new Error("이미 해결된 분쟁입니다.");
  }

  dispute.status = "RESOLVED";
  dispute.resolution = finalResolution;
  dispute.resolvedAt = new Date();
  return dispute;
}

/**
 * 분쟁을 상위 단계로 에스컬레이션한다.
 * @param disputeId 에스컬레이션할 분쟁 ID
 * @param reason 에스컬레이션 사유
 * @returns 에스컬레이션된 분쟁
 */
export function escalateDispute(
  disputeId: string,
  reason: string,
): Dispute {
  const dispute = disputeStore.find((d) => d.id === disputeId);
  if (!dispute) {
    throw new Error(`분쟁 '${disputeId}'을(를) 찾을 수 없습니다.`);
  }
  if (dispute.status === "RESOLVED") {
    throw new Error("이미 해결된 분쟁은 에스컬레이션할 수 없습니다.");
  }

  dispute.status = "ESCALATED";
  dispute.evidence.push({
    evidenceId: `escalation-${dispute.evidence.length + 1}`,
    description: `에스컬레이션 사유: ${reason}`,
    submittedBy: "SYSTEM",
    submittedAt: new Date(),
  });

  return dispute;
}
