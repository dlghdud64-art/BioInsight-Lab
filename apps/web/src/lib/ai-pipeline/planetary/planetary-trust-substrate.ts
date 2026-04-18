/**
 * 지구 단위 신뢰 기저 (Planetary Trust Substrate)
 *
 * 네트워크 간 최소한의 신뢰 의미소(assertions, limitations, revocations)만을
 * 교환하는 행성 규모의 기저 레이어.
 * 원시 데이터가 아닌 신뢰 보증 단위만 전달한다.
 */

/** 기저 레이어 종류 */
export type SubstrateLayer =
  | "ASSERTION"
  | "LIMITATION"
  | "REVOCATION"
  | "COORDINATION";

/** 기저 메시지 */
export interface SubstrateMessage {
  /** 고유 식별자 */
  id: string;
  /** 레이어 종류 */
  layer: SubstrateLayer;
  /** 발신 네트워크 */
  sourceNetwork: string;
  /** 페이로드 (최소 의미소) */
  payload: Record<string, unknown>;
  /** 적용된 한계 목록 */
  limitations: string[];
  /** 철회 상태 */
  revocationStatus: "ACTIVE" | "REVOKED" | "PENDING_REVOCATION";
  /** 타임스탬프 */
  timestamp: number;
  /** 무결성 증명 */
  integrityProof: string;
}

/** 기저 초기화 결과 */
export interface SubstrateState {
  /** 활성 메시지 저장소 */
  messages: Map<string, SubstrateMessage>;
  /** 초기화 시각 */
  initializedAt: number;
}

// ─── 인메모리 저장소 ───
let substrateState: SubstrateState | null = null;

/**
 * 기저 초기화
 * @returns 초기화된 기저 상태
 */
export function initializeSubstrate(): SubstrateState {
  substrateState = {
    messages: new Map(),
    initializedAt: Date.now(),
  };
  return substrateState;
}

/**
 * 무결성 증명 생성 (단순 해시 시뮬레이션)
 */
function computeIntegrityProof(msg: Omit<SubstrateMessage, "integrityProof">): string {
  const raw = `${msg.id}:${msg.layer}:${msg.sourceNetwork}:${msg.timestamp}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return `proof_${Math.abs(hash).toString(16)}`;
}

/**
 * 메시지 발행
 * 한계(limitations)가 비어 있는 단언(ASSERTION) 메시지는 거부된다.
 */
export function publishMessage(
  layer: SubstrateLayer,
  sourceNetwork: string,
  payload: Record<string, unknown>,
  limitations: string[],
  revocationStatus?: SubstrateMessage["revocationStatus"]
): SubstrateMessage {
  if (!substrateState) {
    throw new Error("Substrate가 초기화되지 않았습니다. initializeSubstrate()를 먼저 호출하세요.");
  }

  // CRITICAL: 한계 없는 단언은 무효
  if (layer === "ASSERTION" && limitations.length === 0) {
    throw new Error("한계(limitations) 없는 단언(ASSERTION)은 무효입니다.");
  }

  const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const timestamp = Date.now();

  const partial: Omit<SubstrateMessage, "integrityProof"> = {
    id,
    layer,
    sourceNetwork,
    payload,
    limitations,
    revocationStatus: revocationStatus ?? "ACTIVE",
    timestamp,
  };

  const message: SubstrateMessage = {
    ...partial,
    integrityProof: computeIntegrityProof(partial),
  };

  substrateState.messages.set(id, message);
  return message;
}

/**
 * 메시지 소비 (조회 후 반환)
 * @param messageId 메시지 ID
 */
export function consumeMessage(messageId: string): SubstrateMessage | null {
  if (!substrateState) {
    throw new Error("Substrate가 초기화되지 않았습니다.");
  }
  return substrateState.messages.get(messageId) ?? null;
}

/**
 * 메시지 무결성 검증
 * @returns 무결성이 유효하면 true
 */
export function verifyMessageIntegrity(message: SubstrateMessage): boolean {
  const { integrityProof, ...rest } = message;
  const expected = computeIntegrityProof(rest as Omit<SubstrateMessage, "integrityProof">);
  return integrityProof === expected;
}
