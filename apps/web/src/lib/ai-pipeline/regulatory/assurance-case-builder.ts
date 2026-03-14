/**
 * @module assurance-case-builder
 * @description 보증 케이스 빌더 — Goal Structuring Notation(GSN) 기반으로 보증 케이스를 구성하고 완전성을 검증하는 엔진
 */

/** GSN 노드 유형 */
export type NodeType = 'GOAL' | 'STRATEGY' | 'EVIDENCE' | 'CONTEXT' | 'ASSUMPTION';

/** 보증 케이스 노드 상태 */
export type NodeStatus = 'SATISFIED' | 'UNSATISFIED' | 'PARTIAL' | 'UNDEVELOPED';

/** 보증 케이스 노드 */
export interface AssuranceCaseNode {
  /** 노드 ID */
  id: string;
  /** 노드 유형 */
  type: NodeType;
  /** 노드 설명 */
  description: string;
  /** 부모 노드 ID */
  parentId: string | null;
  /** 자식 노드 ID 목록 */
  children: string[];
  /** 증거 링크 목록 */
  evidenceLinks: string[];
  /** 노드 상태 */
  status: NodeStatus;
}

/** 보증 케이스 */
export interface AssuranceCase {
  /** 케이스 ID */
  id: string;
  /** 케이스 제목 */
  title: string;
  /** 생성 일시 */
  createdAt: Date;
  /** 루트 노드 ID */
  rootNodeId: string | null;
  /** 노드 맵 */
  nodes: Map<string, AssuranceCaseNode>;
}

/** 완전성 검증 결과 */
export interface CompletenessResult {
  /** 완전 여부 */
  complete: boolean;
  /** 총 노드 수 */
  totalNodes: number;
  /** 충족된 노드 수 */
  satisfiedNodes: number;
  /** 미개발 노드 수 */
  undevelopedNodes: number;
  /** 증거 없는 목표 노드 */
  goalsWithoutEvidence: string[];
  /** 문제점 목록 */
  issues: string[];
}

/** 내보내기 형식 */
export interface ExportedCase {
  /** 케이스 ID */
  id: string;
  /** 케이스 제목 */
  title: string;
  /** 생성 일시 */
  createdAt: string;
  /** 노드 배열 */
  nodes: AssuranceCaseNode[];
}

/** 인메모리 케이스 저장소 */
const caseStore: Map<string, AssuranceCase> = new Map();

/**
 * 새로운 보증 케이스를 생성한다.
 * @param id 케이스 ID
 * @param title 케이스 제목
 * @returns 생성된 보증 케이스
 */
export function createCase(id: string, title: string): AssuranceCase {
  const ac: AssuranceCase = {
    id,
    title,
    createdAt: new Date(),
    rootNodeId: null,
    nodes: new Map(),
  };
  caseStore.set(id, ac);
  return ac;
}

/**
 * 보증 케이스에 노드를 추가한다.
 * @param caseId 케이스 ID
 * @param node 추가할 노드
 * @returns 추가된 노드 또는 null
 */
export function addNode(caseId: string, node: AssuranceCaseNode): AssuranceCaseNode | null {
  const ac = caseStore.get(caseId);
  if (!ac) return null;

  ac.nodes.set(node.id, node);

  // 루트 노드 설정 (부모가 없는 첫 번째 GOAL)
  if (node.parentId === null && node.type === 'GOAL' && ac.rootNodeId === null) {
    ac.rootNodeId = node.id;
  }

  // 부모 노드의 children 업데이트
  if (node.parentId) {
    const parent = ac.nodes.get(node.parentId);
    if (parent && !parent.children.includes(node.id)) {
      parent.children.push(node.id);
    }
  }

  return node;
}

/**
 * 노드에 증거 링크를 연결한다.
 * @param caseId 케이스 ID
 * @param nodeId 노드 ID
 * @param evidenceId 증거 ID
 * @returns 갱신된 노드 또는 null
 */
export function linkEvidence(caseId: string, nodeId: string, evidenceId: string): AssuranceCaseNode | null {
  const ac = caseStore.get(caseId);
  if (!ac) return null;

  const node = ac.nodes.get(nodeId);
  if (!node) return null;

  if (!node.evidenceLinks.includes(evidenceId)) {
    node.evidenceLinks.push(evidenceId);
  }
  return node;
}

/**
 * 보증 케이스의 완전성을 검증한다.
 * @param caseId 케이스 ID
 * @returns 완전성 검증 결과 또는 null
 */
export function validateCaseCompleteness(caseId: string): CompletenessResult | null {
  const ac = caseStore.get(caseId);
  if (!ac) return null;

  const nodes = Array.from(ac.nodes.values());
  const goals = nodes.filter((n) => n.type === 'GOAL');
  const satisfiedNodes = nodes.filter((n) => n.status === 'SATISFIED').length;
  const undevelopedNodes = nodes.filter((n) => n.status === 'UNDEVELOPED').length;
  const goalsWithoutEvidence = goals
    .filter((g) => g.evidenceLinks.length === 0 && g.children.length === 0)
    .map((g) => g.id);
  const issues: string[] = [];

  if (!ac.rootNodeId) issues.push('루트 노드가 설정되지 않았습니다.');
  if (undevelopedNodes > 0) issues.push(`미개발 노드 ${undevelopedNodes}개가 존재합니다.`);
  if (goalsWithoutEvidence.length > 0) issues.push(`증거 없는 목표 노드 ${goalsWithoutEvidence.length}개가 존재합니다.`);

  return {
    complete: issues.length === 0 && nodes.length > 0,
    totalNodes: nodes.length,
    satisfiedNodes,
    undevelopedNodes,
    goalsWithoutEvidence,
    issues,
  };
}

/**
 * 보증 케이스를 JSON 직렬화 가능한 형태로 내보낸다.
 * @param caseId 케이스 ID
 * @returns 내보낸 케이스 또는 null
 */
export function exportCase(caseId: string): ExportedCase | null {
  const ac = caseStore.get(caseId);
  if (!ac) return null;

  return {
    id: ac.id,
    title: ac.title,
    createdAt: ac.createdAt.toISOString(),
    nodes: Array.from(ac.nodes.values()),
  };
}
