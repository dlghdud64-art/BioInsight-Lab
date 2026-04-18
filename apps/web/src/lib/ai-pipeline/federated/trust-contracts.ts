/**
 * @module trust-contracts
 * @description 조직 간 신뢰 계약 관리
 *
 * 연합 네트워크 내 파트너 조직 간의 데이터 공유, 증거 교환,
 * 정책 동기화 등에 대한 계약을 생성·관리한다.
 */

/** 계약 유형 */
export type ContractType =
  | "DATA_SHARING"
  | "EVIDENCE_EXCHANGE"
  | "POLICY_SYNC"
  | "AUDIT_ACCESS"
  | "BENCHMARKING";

/** 계약 상태 */
export type ContractStatus =
  | "DRAFT"
  | "ACTIVE"
  | "SUSPENDED"
  | "EXPIRED"
  | "TERMINATED";

/** 계약 조건 */
export interface ContractTerms {
  dataRetentionDays: number;
  maxExchangeFrequency: string;
  requiredEncryption: boolean;
  auditTrailRequired: boolean;
  customClauses: string[];
}

/** 신뢰 계약 */
export interface TrustContract {
  id: string;
  type: ContractType;
  parties: string[];
  status: ContractStatus;
  terms: ContractTerms;
  createdAt: Date;
  expiresAt: Date;
  autoRenew: boolean;
}

/** 계약 생성 요청 */
export interface CreateContractInput {
  type: ContractType;
  parties: string[];
  terms: ContractTerms;
  expiresAt: Date;
  autoRenew?: boolean;
}

/** 인메모리 계약 저장소 */
const contractStore: TrustContract[] = [];

/** 고유 ID 생성 */
let contractSeq = 0;
function nextContractId(): string {
  contractSeq += 1;
  return `contract-${contractSeq}`;
}

/**
 * 새 신뢰 계약을 생성한다. (초안 상태)
 * @param input 계약 생성 정보
 * @returns 생성된 계약
 */
export function createContract(input: CreateContractInput): TrustContract {
  if (input.parties.length < 2) {
    throw new Error("계약에는 최소 2개 이상의 당사자가 필요합니다.");
  }

  const contract: TrustContract = {
    id: nextContractId(),
    type: input.type,
    parties: [...input.parties],
    status: "DRAFT",
    terms: { ...input.terms },
    createdAt: new Date(),
    expiresAt: input.expiresAt,
    autoRenew: input.autoRenew ?? false,
  };

  contractStore.push(contract);
  return contract;
}

/**
 * 초안 계약을 활성화한다.
 * @param contractId 활성화할 계약 ID
 * @returns 활성화된 계약
 * @throws 계약을 찾을 수 없거나 DRAFT 상태가 아닌 경우
 */
export function activateContract(contractId: string): TrustContract {
  const contract = contractStore.find((c) => c.id === contractId);
  if (!contract) {
    throw new Error(`계약 '${contractId}'을(를) 찾을 수 없습니다.`);
  }
  if (contract.status !== "DRAFT") {
    throw new Error(
      `계약 상태가 '${contract.status}'이므로 활성화할 수 없습니다. DRAFT 상태여야 합니다.`,
    );
  }

  contract.status = "ACTIVE";
  return contract;
}

/**
 * 활성 계약을 일시 정지한다.
 * @param contractId 정지할 계약 ID
 * @param reason 정지 사유
 * @returns 정지된 계약
 */
export function suspendContract(
  contractId: string,
  reason: string,
): TrustContract {
  const contract = contractStore.find((c) => c.id === contractId);
  if (!contract) {
    throw new Error(`계약 '${contractId}'을(를) 찾을 수 없습니다.`);
  }
  if (contract.status !== "ACTIVE") {
    throw new Error(
      `활성 상태의 계약만 정지할 수 있습니다. 현재: ${contract.status}`,
    );
  }

  contract.status = "SUSPENDED";
  return contract;
}

/**
 * 계약을 영구 종료한다.
 * @param contractId 종료할 계약 ID
 * @param reason 종료 사유
 * @returns 종료된 계약
 */
export function terminateContract(
  contractId: string,
  reason: string,
): TrustContract {
  const contract = contractStore.find((c) => c.id === contractId);
  if (!contract) {
    throw new Error(`계약 '${contractId}'을(를) 찾을 수 없습니다.`);
  }
  if (contract.status === "TERMINATED") {
    throw new Error("이미 종료된 계약입니다.");
  }

  contract.status = "TERMINATED";
  return contract;
}

/**
 * 특정 파트너가 포함된 활성 계약 목록을 반환한다.
 * @param partnerId 조회할 파트너 ID (생략 시 전체 활성 계약)
 * @returns 활성 계약 배열
 */
export function getActiveContracts(partnerId?: string): TrustContract[] {
  return contractStore.filter((c) => {
    if (c.status !== "ACTIVE") return false;
    if (partnerId) return c.parties.includes(partnerId);
    return true;
  });
}
