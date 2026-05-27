/**
 * @module shared-assurance-network
 * @description 공유 보증 네트워크 (중계 패브릭)
 *
 * 분산형 중계 노드 네트워크를 통해 보증 신호를 전파한다.
 * 중앙 마스터 노드 없이 탈중앙화된 메시 토폴로지로 동작하며,
 * 전파 지연 시간을 측정하고 네트워크 상태를 모니터링한다.
 */

/** 중계 노드 */
export interface RelayNode {
  /** 노드 고유 식별자 */
  nodeId: string;
  /** 소속 참여자 ID */
  participantId: string;
  /** 지원 기능 목록 */
  capabilities: string[];
  /** 연결된 노드 ID 목록 */
  connectedNodes: string[];
  /** 마지막 하트비트 시각 */
  lastHeartbeat: number;
}

/** 전파 레코드 */
export interface PropagationRecord {
  /** 신호 고유 식별자 */
  signalId: string;
  /** 신호 유형 */
  type: string;
  /** 출발 노드 ID */
  originNode: string;
  /** 도달한 노드 ID 목록 */
  reachedNodes: string[];
  /** 전파 소요 시간 (ms) */
  propagationTimeMs: number;
}

/** 네트워크 토폴로지 정보 */
export interface NetworkTopology {
  /** 총 노드 수 */
  totalNodes: number;
  /** 활성 노드 수 (하트비트 기준) */
  activeNodes: number;
  /** 총 연결 수 */
  totalConnections: number;
  /** 평균 연결 수 */
  averageConnections: number;
  /** 고립 노드 수 (연결 0개) */
  isolatedNodes: number;
}

// --- 인메모리 저장소 ---
const nodeStore: RelayNode[] = [];
const propagationLog: PropagationRecord[] = [];

/** 하트비트 유효 시간 (5분) */
const HEARTBEAT_TTL_MS = 5 * 60 * 1000;

/**
 * 중계 노드를 등록한다.
 * @param participantId - 소속 참여자 ID
 * @param capabilities - 지원 기능
 * @returns 등록된 노드
 */
export function registerNode(
  participantId: string,
  capabilities: string[]
): RelayNode {
  const node: RelayNode = {
    nodeId: `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    participantId,
    capabilities,
    connectedNodes: [],
    lastHeartbeat: Date.now(),
  };
  nodeStore.push(node);
  return node;
}

/**
 * 두 노드를 연결한다.
 * @param nodeIdA - 노드 A ID
 * @param nodeIdB - 노드 B ID
 * @returns 연결 성공 여부
 */
export function connectNodes(nodeIdA: string, nodeIdB: string): boolean {
  const nodeA = nodeStore.find((n) => n.nodeId === nodeIdA);
  const nodeB = nodeStore.find((n) => n.nodeId === nodeIdB);
  if (!nodeA || !nodeB) return false;

  if (!nodeA.connectedNodes.includes(nodeIdB)) {
    nodeA.connectedNodes.push(nodeIdB);
  }
  if (!nodeB.connectedNodes.includes(nodeIdA)) {
    nodeB.connectedNodes.push(nodeIdA);
  }
  return true;
}

/**
 * 신호를 네트워크를 통해 전파한다. BFS 방식으로 모든 연결된 노드에 도달.
 * @param originNodeId - 출발 노드 ID
 * @param signalType - 신호 유형
 * @returns 전파 레코드
 */
export function propagateSignal(
  originNodeId: string,
  signalType: string
): PropagationRecord {
  const startTime = Date.now();
  const reachedNodes: string[] = [];
  const visited = new Set<string>();
  const queue: string[] = [originNodeId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    if (currentId !== originNodeId) {
      reachedNodes.push(currentId);
    }

    const node = nodeStore.find((n) => n.nodeId === currentId);
    if (node) {
      for (const connectedId of node.connectedNodes) {
        if (!visited.has(connectedId)) {
          queue.push(connectedId);
        }
      }
    }
  }

  const record: PropagationRecord = {
    signalId: `sig-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: signalType,
    originNode: originNodeId,
    reachedNodes,
    propagationTimeMs: Date.now() - startTime,
  };
  propagationLog.push(record);
  return record;
}

/**
 * 네트워크 토폴로지 정보를 반환한다.
 * @returns 네트워크 토폴로지
 */
export function getNetworkTopology(): NetworkTopology {
  const now = Date.now();
  const activeNodes = nodeStore.filter(
    (n) => now - n.lastHeartbeat < HEARTBEAT_TTL_MS
  ).length;

  const totalConnections = nodeStore.reduce(
    (sum, n) => sum + n.connectedNodes.length,
    0
  ) / 2; // 양방향이므로 2로 나눔

  const isolatedNodes = nodeStore.filter(
    (n) => n.connectedNodes.length === 0
  ).length;

  return {
    totalNodes: nodeStore.length,
    activeNodes,
    totalConnections: Math.floor(totalConnections),
    averageConnections:
      nodeStore.length > 0
        ? nodeStore.reduce((sum, n) => sum + n.connectedNodes.length, 0) / nodeStore.length
        : 0,
    isolatedNodes,
  };
}

/**
 * 전파 지연 시간을 측정한다.
 * @param limit - 최근 N건 기준
 * @returns 평균, 최소, 최대 전파 시간 (ms)
 */
export function measurePropagationLatency(
  limit: number = 50
): { avgMs: number; minMs: number; maxMs: number } {
  const recent = propagationLog.slice(-limit);
  if (recent.length === 0) {
    return { avgMs: 0, minMs: 0, maxMs: 0 };
  }

  const times = recent.map((r) => r.propagationTimeMs);
  return {
    avgMs: times.reduce((a, b) => a + b, 0) / times.length,
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
  };
}
