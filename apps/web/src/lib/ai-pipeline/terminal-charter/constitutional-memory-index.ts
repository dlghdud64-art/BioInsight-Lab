/**
 * @module constitutional-memory-index
 * @description 헌법적 기억 인덱스 — 모든 헌법적 결정, 해석, 선례를 영구 기록·보존한다.
 * Phase별, 주제별 검색이 가능하며, 분쟁 해결 시 선례로 참조된다.
 */

/** 기억 항목 */
export interface MemoryEntry {
  /** 기억 고유 ID */
  id: string;
  /** 관련 Phase */
  phase: string;
  /** 주제 */
  topic: string;
  /** 설명 */
  description: string;
  /** 선례 (분쟁 해결 시 참조) */
  precedent: string | null;
  /** 기록 일시 */
  recordedAt: Date;
}

/** 인메모리 기억 저장소 (삭제 불가) */
const memoryStore: MemoryEntry[] = [];

/** 검색 인덱스: 주제 → 항목 ID */
const topicIndex: Map<string, string[]> = new Map();

/** 검색 인덱스: Phase → 항목 ID */
const phaseIndex: Map<string, string[]> = new Map();

/**
 * 헌법적 기억을 기록한다. 한번 기록된 항목은 수정·삭제할 수 없다.
 * @param phase - 관련 Phase
 * @param topic - 주제
 * @param description - 설명
 * @param precedent - 선례 (선택)
 * @returns 기록된 기억 항목
 */
export function indexMemory(
  phase: string,
  topic: string,
  description: string,
  precedent?: string
): MemoryEntry {
  const entry: MemoryEntry = {
    id: `MEM-${Date.now()}-${memoryStore.length}`,
    phase,
    topic,
    description,
    precedent: precedent ?? null,
    recordedAt: new Date(),
  };

  memoryStore.push(entry);

  // 주제 인덱스 갱신
  const topicEntries = topicIndex.get(topic) ?? [];
  topicEntries.push(entry.id);
  topicIndex.set(topic, topicEntries);

  // Phase 인덱스 갱신
  const phaseEntries = phaseIndex.get(phase) ?? [];
  phaseEntries.push(entry.id);
  phaseIndex.set(phase, phaseEntries);

  return { ...entry };
}

/**
 * 키워드로 기억을 검색한다. 주제, 설명, 선례에서 검색한다.
 * @param keyword - 검색 키워드
 * @returns 매칭된 기억 항목 배열
 */
export function searchMemory(keyword: string): MemoryEntry[] {
  const lower = keyword.toLowerCase();
  return memoryStore.filter(
    (entry) =>
      entry.topic.toLowerCase().includes(lower) ||
      entry.description.toLowerCase().includes(lower) ||
      (entry.precedent && entry.precedent.toLowerCase().includes(lower))
  );
}

/**
 * Phase별 기억을 조회한다.
 * @param phase - 조회할 Phase
 * @returns 해당 Phase의 기억 항목 배열
 */
export function getMemoriesByPhase(phase: string): MemoryEntry[] {
  const ids = phaseIndex.get(phase) ?? [];
  return ids
    .map((id) => memoryStore.find((e) => e.id === id))
    .filter((e): e is MemoryEntry => e !== undefined);
}

/**
 * 헌법적 선례를 조회한다. 선례가 기록된 항목만 반환.
 * @returns 선례가 있는 기억 항목 배열
 */
export function getConstitutionalPrecedents(): MemoryEntry[] {
  return memoryStore.filter((e) => e.precedent !== null);
}

/**
 * 주제별 기억을 조회한다.
 * @param topic - 조회할 주제
 * @returns 해당 주제의 기억 항목 배열
 */
export function getMemoriesByTopic(topic: string): MemoryEntry[] {
  const ids = topicIndex.get(topic) ?? [];
  return ids
    .map((id) => memoryStore.find((e) => e.id === id))
    .filter((e): e is MemoryEntry => e !== undefined);
}

/**
 * 전체 기억 수를 반환한다.
 * @returns 기억 항목 총 수
 */
export function getMemoryCount(): number {
  return memoryStore.length;
}
