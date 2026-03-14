/**
 * @module institutional-memory-governor
 * @description 제도적 기억 거버넌스 — 조직의 의사결정 근거, 사고 학습, 프로세스 진화, 문화적 규범, 아키텍처 결정 등을 기록하고 검색합니다.
 */

/** 기억 카테고리 */
export type MemoryCategory =
  | 'DECISION_RATIONALE'
  | 'INCIDENT_LEARNINGS'
  | 'PROCESS_EVOLUTION'
  | 'CULTURAL_NORMS'
  | 'ARCHITECTURAL_DECISIONS';

/** 제도적 기억 */
export interface InstitutionalMemory {
  /** 고유 식별자 */
  id: string;
  /** 기억 카테고리 */
  category: MemoryCategory;
  /** 기억 내용 */
  content: string;
  /** 맥락 정보 */
  context: string;
  /** 기록 일시 */
  recordedAt: Date;
  /** 기록자 */
  recordedBy: string;
  /** 관련성 점수 (0-100) */
  relevanceScore: number;
  /** 접근 횟수 */
  accessCount: number;
}

/** 지식 맵 항목 */
export interface KnowledgeMapEntry {
  /** 카테고리 */
  category: MemoryCategory;
  /** 항목 수 */
  count: number;
  /** 평균 관련성 */
  averageRelevance: number;
  /** 최근 기록 일시 */
  latestRecordedAt: Date | null;
}

/** 인메모리 기억 저장소 */
const memoryStore: InstitutionalMemory[] = [];

/**
 * 새로운 제도적 기억을 기록합니다.
 * @param params - 기억 기록 정보
 * @returns 기록된 제도적 기억
 */
export function recordMemory(
  params: Pick<
    InstitutionalMemory,
    'category' | 'content' | 'context' | 'recordedBy'
  > & { relevanceScore?: number }
): InstitutionalMemory {
  const memory: InstitutionalMemory = {
    id: `im-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    category: params.category,
    content: params.content,
    context: params.context,
    recordedAt: new Date(),
    recordedBy: params.recordedBy,
    relevanceScore: params.relevanceScore ?? 50,
    accessCount: 0,
  };
  memoryStore.push(memory);
  return { ...memory };
}

/**
 * 키워드 기반으로 제도적 기억을 검색합니다.
 * @param query - 검색 키워드
 * @param category - 선택적 카테고리 필터
 * @returns 관련성 순으로 정렬된 기억 목록
 */
export function searchMemory(
  query: string,
  category?: MemoryCategory
): InstitutionalMemory[] {
  const lowerQuery = query.toLowerCase();

  const results = memoryStore
    .filter((m) => {
      if (category && m.category !== category) return false;
      return (
        m.content.toLowerCase().includes(lowerQuery) ||
        m.context.toLowerCase().includes(lowerQuery)
      );
    })
    .map((m) => {
      // 접근 횟수 증가
      m.accessCount += 1;
      return { ...m };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore);

  return results;
}

/**
 * 기억의 관련성을 재평가합니다.
 * @param memoryId - 기억 ID
 * @param newScore - 새 관련성 점수
 * @returns 업데이트된 기억 또는 null
 */
export function assessRelevance(
  memoryId: string,
  newScore: number
): InstitutionalMemory | null {
  const memory = memoryStore.find((m) => m.id === memoryId);
  if (!memory) return null;
  memory.relevanceScore = Math.max(0, Math.min(100, newScore));
  return { ...memory };
}

/**
 * 오래되고 관련성이 낮은 기억을 정리합니다.
 * @param maxAgeDays - 최대 보관 기간 (일)
 * @param minRelevance - 최소 관련성 점수
 * @returns 정리 결과
 */
export function pruneObsolete(
  maxAgeDays: number = 365,
  minRelevance: number = 10
): { prunedCount: number; prunedIds: string[] } {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxAgeDays);

  const toPrune = memoryStore.filter(
    (m) => m.recordedAt < cutoff && m.relevanceScore < minRelevance
  );
  const prunedIds = toPrune.map((m) => m.id);

  for (const id of prunedIds) {
    const idx = memoryStore.findIndex((m) => m.id === id);
    if (idx >= 0) memoryStore.splice(idx, 1);
  }

  return { prunedCount: prunedIds.length, prunedIds };
}

/**
 * 전체 지식 맵을 생성합니다.
 * @returns 카테고리별 지식 맵
 */
export function getKnowledgeMap(): KnowledgeMapEntry[] {
  const categories: MemoryCategory[] = [
    'DECISION_RATIONALE',
    'INCIDENT_LEARNINGS',
    'PROCESS_EVOLUTION',
    'CULTURAL_NORMS',
    'ARCHITECTURAL_DECISIONS',
  ];

  return categories.map((category) => {
    const items = memoryStore.filter((m) => m.category === category);
    const totalRelevance = items.reduce((s, m) => s + m.relevanceScore, 0);
    const latest =
      items.length > 0
        ? new Date(Math.max(...items.map((m) => m.recordedAt.getTime())))
        : null;

    return {
      category,
      count: items.length,
      averageRelevance:
        items.length > 0
          ? Math.round((totalRelevance / items.length) * 100) / 100
          : 0,
      latestRecordedAt: latest,
    };
  });
}
