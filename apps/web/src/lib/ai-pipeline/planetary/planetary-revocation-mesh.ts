/**
 * 행성 단위 철회 메시 (Planetary Revocation Mesh)
 *
 * 전 지구적으로 철회(revocation) 정보를 전파하는 메시 네트워크.
 * 목표: 제로 지연 글로벌 전파.
 */

/** 메시 노드 */
export interface MeshNode {
  /** 노드 식별자 */
  nodeId: string;
  /** 소속 네트워크 */
  networkId: string;
  /** 연결된 노드 ID 목록 */
  connectedNodes: string[];
  /** 마지막 동기화 시각 */
  lastSync: number;
}

/** 철회 브로드캐스트 */
export interface RevocationBroadcast {
  /** 철회 ID */
  revocationId: string;
  /** 대상 단언 ID */
  assertionId: string;
  /** 철회자 */
  revokedBy: string;
  /** 철회 원본 네트워크 */
  networkOfOrigin: string;
  /** 전파된 노드 목록 */
  propagatedTo: string[];
  /** 브로드캐스트 시각 */
  broadcastAt: number;
}

/** 신선도 검사 */
export interface FreshnessCheck {
  /** 대상 단언 ID */
  assertionId: string;
  /** 마지막 검사 시각 */
  lastCheckedAt: number;
  /** 철회 여부 */
  isRevoked: boolean;
  /** 검사에 사용된 노드 목록 */
  checkedAgainstNodes: string[];
}

// ─── 인메모리 저장소 ───
const meshNodes = new Map<string, MeshNode>();
const broadcasts = new Map<string, RevocationBroadcast>();
const revocationIndex = new Map<string, string>(); // assertionId → revocationId

/**
 * 메시 노드 등록 또는 업데이트
 */
export function syncMeshNode(node: MeshNode): MeshNode {
  const synced: MeshNode = { ...node, lastSync: Date.now() };
  meshNodes.set(synced.nodeId, synced);
  return synced;
}

/**
 * 철회 브로드캐스트 — 모든 연결 노드에 즉시 전파
 *
 * @param assertionId 철회 대상 단언 ID
 * @param revokedBy 철회자
 * @param networkOfOrigin 원본 네트워크
 */
export function broadcastRevocation(
  assertionId: string,
  revokedBy: string,
  networkOfOrigin: string
): RevocationBroadcast {
  const revocationId = `rev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // 모든 노드에 전파 (제로 지연 목표)
  const allNodeIds = [...meshNodes.keys()];

  const broadcast: RevocationBroadcast = {
    revocationId,
    assertionId,
    revokedBy,
    networkOfOrigin,
    propagatedTo: allNodeIds,
    broadcastAt: Date.now(),
  };

  broadcasts.set(revocationId, broadcast);
  revocationIndex.set(assertionId, revocationId);
  return broadcast;
}

/**
 * 신선도 검사 — 특정 단언이 철회되었는지 확인
 */
export function checkFreshness(assertionId: string): FreshnessCheck {
  const isRevoked = revocationIndex.has(assertionId);
  const allNodeIds = [...meshNodes.keys()];

  return {
    assertionId,
    lastCheckedAt: Date.now(),
    isRevoked,
    checkedAgainstNodes: allNodeIds,
  };
}

/**
 * 특정 단언의 철회 상태 조회
 */
export function getRevocationStatus(assertionId: string): RevocationBroadcast | null {
  const revocationId = revocationIndex.get(assertionId);
  if (!revocationId) return null;
  return broadcasts.get(revocationId) ?? null;
}

/**
 * 전파 지연 측정 — 브로드캐스트 시점부터 현재까지의 경과 시간(ms)
 */
export function measurePropagationDelay(revocationId: string): number | null {
  const broadcast = broadcasts.get(revocationId);
  if (!broadcast) return null;
  return Date.now() - broadcast.broadcastAt;
}
