/**
 * 영지식 증명 게이트웨이 (Zero-Knowledge Gateway)
 *
 * 민감한 정보를 노출하지 않고 특정 속성을 증명할 수 있는
 * 영지식 증명(ZKP) 생성·검증·이력 관리 시스템입니다.
 */

/** 증명 유형 */
export type ProofType =
  | "EXISTENCE"
  | "RANGE"
  | "MEMBERSHIP"
  | "COMPLIANCE"
  | "COMPUTATION";

/** 영지식 증명 */
export interface ZKProof {
  id: string;
  proofType: ProofType;
  /** 증명하려는 명제 */
  statement: string;
  /** 증명 데이터 (시뮬레이션용 문자열) */
  proof: string;
  verifiedAt: Date | null;
  /** 검증 참여자 수 */
  verifierCount: number;
  /** 유효 여부 */
  valid: boolean;
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------
const proofStore: ZKProof[] = [];

let nextId = 1;
function genId(): string {
  return `zkp-${Date.now()}-${nextId++}`;
}

/** 간이 증명 생성 (시뮬레이션) */
function simulateProof(statement: string, proofType: ProofType): string {
  const tag = proofType.toLowerCase();
  let h = 0;
  for (let i = 0; i < statement.length; i++) {
    h = ((h << 5) - h + statement.charCodeAt(i)) | 0;
  }
  return `zk_${tag}_${Math.abs(h).toString(16).padStart(12, "0")}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * 영지식 증명을 생성합니다.
 * @param proofType 증명 유형
 * @param statement 증명 대상 명제
 */
export function generateProof(
  proofType: ProofType,
  statement: string
): ZKProof {
  const proof: ZKProof = {
    id: genId(),
    proofType,
    statement,
    proof: simulateProof(statement, proofType),
    verifiedAt: null,
    verifierCount: 0,
    valid: false,
  };
  proofStore.push(proof);
  return proof;
}

/**
 * 단일 증명을 검증합니다.
 * @param proofId 증명 ID
 * @returns 검증 결과
 */
export function verifyProof(proofId: string): {
  valid: boolean;
  message: string;
} {
  const p = proofStore.find((x) => x.id === proofId);
  if (!p) return { valid: false, message: "증명을 찾을 수 없습니다." };

  // 시뮬레이션: proof 문자열이 올바른 접두사를 가지는지 확인
  const expectedPrefix = `zk_${p.proofType.toLowerCase()}_`;
  const isValid = p.proof.startsWith(expectedPrefix);

  p.valid = isValid;
  p.verifiedAt = new Date();
  p.verifierCount += 1;

  return {
    valid: isValid,
    message: isValid ? "증명이 유효합니다." : "증명 검증에 실패했습니다.",
  };
}

/**
 * 여러 증명을 일괄 검증합니다.
 * @param proofIds 증명 ID 배열
 */
export function batchVerify(
  proofIds: string[]
): { proofId: string; valid: boolean; message: string }[] {
  return proofIds.map((id) => {
    const result = verifyProof(id);
    return { proofId: id, ...result };
  });
}

/**
 * 특정 명제 또는 유형에 대한 증명 이력을 반환합니다.
 * @param filter 선택적 필터
 */
export function getProofHistory(filter?: {
  proofType?: ProofType;
  validOnly?: boolean;
}): ZKProof[] {
  let results = [...proofStore];
  if (filter?.proofType) {
    results = results.filter((p) => p.proofType === filter.proofType);
  }
  if (filter?.validOnly) {
    results = results.filter((p) => p.valid);
  }
  return results.sort(
    (a, b) =>
      (b.verifiedAt?.getTime() ?? 0) - (a.verifiedAt?.getTime() ?? 0)
  );
}
