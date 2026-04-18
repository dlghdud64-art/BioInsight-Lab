/**
 * 기계 간 신뢰 협상기 (Machine-to-Machine Trust Negotiator)
 *
 * 시스템 간 자동 신뢰 협상 프로토콜을 구현합니다.
 * 챌린지-응답, 상호 증명, 능력 교환, 평판 기반 등 다양한 프로토콜을 지원합니다.
 */

/** 협상 프로토콜 */
export type NegotiationProtocol =
  | "CHALLENGE_RESPONSE"
  | "MUTUAL_ATTESTATION"
  | "CAPABILITY_EXCHANGE"
  | "REPUTATION_BASED";

/** 협상 상태 */
export type NegotiationStatus =
  | "INITIATED"
  | "CHALLENGE_SENT"
  | "RESPONSE_RECEIVED"
  | "ESTABLISHED"
  | "REVOKED"
  | "FAILED";

/** 신뢰 협상 */
export interface TrustNegotiation {
  id: string;
  /** 협상 시작 측 */
  initiatorId: string;
  /** 응답 측 */
  responderId: string;
  protocol: NegotiationProtocol;
  status: NegotiationStatus;
  /** 합의된 능력 목록 */
  agreedCapabilities: string[];
  establishedAt: Date | null;
  /** 챌린지 데이터 */
  challengeData: string | null;
  /** 응답 데이터 */
  responseData: string | null;
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------
const negotiations: TrustNegotiation[] = [];

let nextId = 1;
function genId(): string {
  return `tn-${Date.now()}-${nextId++}`;
}

function generateChallenge(protocol: NegotiationProtocol): string {
  const nonce = Math.random().toString(36).slice(2, 14);
  return `${protocol}:challenge:${nonce}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * 신뢰 협상을 시작합니다.
 * @param initiatorId 시작 측 ID
 * @param responderId 응답 측 ID
 * @param protocol 사용할 프로토콜
 * @param requestedCapabilities 요청 능력 목록
 */
export function initiateNegotiation(
  initiatorId: string,
  responderId: string,
  protocol: NegotiationProtocol,
  requestedCapabilities: string[] = []
): TrustNegotiation {
  const negotiation: TrustNegotiation = {
    id: genId(),
    initiatorId,
    responderId,
    protocol,
    status: "INITIATED",
    agreedCapabilities: [],
    establishedAt: null,
    challengeData: generateChallenge(protocol),
    responseData: null,
  };

  if (protocol === "CHALLENGE_RESPONSE") {
    negotiation.status = "CHALLENGE_SENT";
  }

  // 능력 교환인 경우 요청 능력을 기록
  if (protocol === "CAPABILITY_EXCHANGE" && requestedCapabilities.length > 0) {
    negotiation.agreedCapabilities = [...requestedCapabilities];
  }

  negotiations.push(negotiation);
  return negotiation;
}

/**
 * 챌린지에 응답합니다.
 * @param negotiationId 협상 ID
 * @param response 응답 데이터
 */
export function respondToChallenge(
  negotiationId: string,
  response: string
): TrustNegotiation | null {
  const neg = negotiations.find((n) => n.id === negotiationId);
  if (!neg) return null;
  if (neg.status === "REVOKED" || neg.status === "ESTABLISHED") return neg;

  neg.responseData = response;
  neg.status = "RESPONSE_RECEIVED";
  return neg;
}

/**
 * 신뢰를 수립합니다. 응답이 유효하면 ESTABLISHED 상태로 전환합니다.
 * @param negotiationId 협상 ID
 * @param agreedCapabilities 최종 합의 능력 목록
 */
export function establishTrust(
  negotiationId: string,
  agreedCapabilities: string[] = []
): { success: boolean; negotiation: TrustNegotiation | null } {
  const neg = negotiations.find((n) => n.id === negotiationId);
  if (!neg) return { success: false, negotiation: null };

  if (neg.status === "REVOKED") {
    return { success: false, negotiation: neg };
  }

  if (
    neg.protocol === "CHALLENGE_RESPONSE" &&
    neg.status !== "RESPONSE_RECEIVED"
  ) {
    return { success: false, negotiation: neg };
  }

  neg.status = "ESTABLISHED";
  neg.establishedAt = new Date();
  if (agreedCapabilities.length > 0) {
    neg.agreedCapabilities = agreedCapabilities;
  }

  return { success: true, negotiation: neg };
}

/**
 * 기계 간 신뢰를 폐기합니다.
 * @param negotiationId 협상 ID
 * @param reason 폐기 사유
 */
export function revokeMachineTrust(
  negotiationId: string,
  reason: string
): { success: boolean; message: string } {
  const neg = negotiations.find((n) => n.id === negotiationId);
  if (!neg) return { success: false, message: "협상을 찾을 수 없습니다." };

  neg.status = "REVOKED";
  neg.agreedCapabilities = [];
  return { success: true, message: `신뢰 폐기 완료: ${reason}` };
}
