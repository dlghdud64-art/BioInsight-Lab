/**
 * @module mutual-assurance-framework
 * @description 상호 보증 프레임워크
 *
 * 기관 간 상호 보증 관계를 수립·검증·업그레이드하고,
 * 보증 네트워크를 시각화할 수 있는 데이터를 제공한다.
 */

/** 보증 티어 */
export type AssuranceTier =
  | 'TIER_1_BASIC'
  | 'TIER_2_STANDARD'
  | 'TIER_3_ENHANCED'
  | 'TIER_4_COMPREHENSIVE';

/** 보증 증거 */
export interface AssuranceEvidence {
  /** 증거 유형 */
  type: string;
  /** 증거 해시 */
  hash: string;
  /** 제출 일시 */
  submittedAt: Date;
}

/** 상호 보증 */
export interface MutualAssurance {
  /** 보증 제공 기관 ID */
  fromInstitution: string;
  /** 보증 수신 기관 ID */
  toInstitution: string;
  /** 보증 티어 */
  tier: AssuranceTier;
  /** 보증 범위 설명 */
  scope: string;
  /** 유효 시작일 */
  validFrom: Date;
  /** 유효 종료일 */
  validTo: Date;
  /** 보증 증거 목록 */
  evidence: AssuranceEvidence[];
}

/** 보증 네트워크 노드 */
export interface AssuranceNode {
  /** 기관 ID */
  institutionId: string;
  /** 제공하는 보증 수 */
  outgoingCount: number;
  /** 수신하는 보증 수 */
  incomingCount: number;
  /** 최고 보증 티어 */
  highestTier: AssuranceTier;
}

/** 보증 네트워크 */
export interface AssuranceNetwork {
  /** 노드 목록 */
  nodes: AssuranceNode[];
  /** 전체 보증 관계 수 */
  totalAssurances: number;
  /** 활성 보증 관계 수 */
  activeAssurances: number;
}

// ── 인메모리 저장소 ──
const assurances: MutualAssurance[] = [];

/** 티어 순서 (비교용) */
const TIER_ORDER: AssuranceTier[] = [
  'TIER_1_BASIC',
  'TIER_2_STANDARD',
  'TIER_3_ENHANCED',
  'TIER_4_COMPREHENSIVE',
];

/**
 * 상호 보증을 수립한다.
 *
 * @param assurance 보증 정보
 * @returns 수립된 보증
 */
export function establishAssurance(assurance: MutualAssurance): MutualAssurance {
  // 중복 확인
  const existing = assurances.find(
    (a) =>
      a.fromInstitution === assurance.fromInstitution &&
      a.toInstitution === assurance.toInstitution &&
      a.validTo > new Date(),
  );
  if (existing) {
    throw new Error(
      `기관 ${assurance.fromInstitution} → ${assurance.toInstitution} 간 유효한 보증이 이미 존재함`,
    );
  }

  const clone: MutualAssurance = {
    ...assurance,
    evidence: assurance.evidence.map((e) => ({ ...e })),
  };
  assurances.push(clone);
  return { ...clone, evidence: clone.evidence.map((e) => ({ ...e })) };
}

/**
 * 두 기관 간 상호 보증을 검증한다.
 *
 * @param fromId 보증 제공 기관 ID
 * @param toId 보증 수신 기관 ID
 * @returns 유효한 보증 또는 null
 */
export function verifyMutualAssurance(
  fromId: string,
  toId: string,
): MutualAssurance | null {
  const now = new Date();
  const found = assurances.find(
    (a) =>
      a.fromInstitution === fromId &&
      a.toInstitution === toId &&
      a.validFrom <= now &&
      a.validTo > now,
  );
  if (!found) return null;
  return { ...found, evidence: found.evidence.map((e) => ({ ...e })) };
}

/**
 * 보증 티어를 업그레이드한다.
 *
 * @param fromId 보증 제공 기관 ID
 * @param toId 보증 수신 기관 ID
 * @param newTier 새로운 티어
 * @param additionalEvidence 추가 증거
 * @returns 업그레이드된 보증
 */
export function upgradeAssuranceTier(
  fromId: string,
  toId: string,
  newTier: AssuranceTier,
  additionalEvidence: AssuranceEvidence[] = [],
): MutualAssurance {
  const now = new Date();
  const existing = assurances.find(
    (a) =>
      a.fromInstitution === fromId &&
      a.toInstitution === toId &&
      a.validTo > now,
  );
  if (!existing) {
    throw new Error(`기관 ${fromId} → ${toId} 간 유효한 보증을 찾을 수 없음`);
  }

  const currentTierIndex = TIER_ORDER.indexOf(existing.tier);
  const newTierIndex = TIER_ORDER.indexOf(newTier);
  if (newTierIndex <= currentTierIndex) {
    throw new Error(`새 티어(${newTier})는 현재 티어(${existing.tier})보다 높아야 함`);
  }

  existing.tier = newTier;
  existing.evidence.push(...additionalEvidence.map((e) => ({ ...e })));

  return { ...existing, evidence: existing.evidence.map((e) => ({ ...e })) };
}

/**
 * 보증 네트워크를 반환한다.
 */
export function getAssuranceNetwork(): AssuranceNetwork {
  const now = new Date();
  const active = assurances.filter((a) => a.validFrom <= now && a.validTo > now);

  const nodeMap = new Map<string, AssuranceNode>();

  const ensureNode = (id: string): AssuranceNode => {
    if (!nodeMap.has(id)) {
      nodeMap.set(id, {
        institutionId: id,
        outgoingCount: 0,
        incomingCount: 0,
        highestTier: 'TIER_1_BASIC',
      });
    }
    return nodeMap.get(id)!;
  };

  for (const a of active) {
    const fromNode = ensureNode(a.fromInstitution);
    const toNode = ensureNode(a.toInstitution);

    fromNode.outgoingCount++;
    toNode.incomingCount++;

    // 최고 티어 갱신
    if (TIER_ORDER.indexOf(a.tier) > TIER_ORDER.indexOf(fromNode.highestTier)) {
      fromNode.highestTier = a.tier;
    }
    if (TIER_ORDER.indexOf(a.tier) > TIER_ORDER.indexOf(toNode.highestTier)) {
      toNode.highestTier = a.tier;
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    totalAssurances: assurances.length,
    activeAssurances: active.length,
  };
}
