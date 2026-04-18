/**
 * Strategic Command Layer (Phase P) — 전략적 의사결정 영구 감사 추적 로그
 * 모든 전략적 행동을 영구 기록한다.
 * 규칙: 항목은 추가만 가능(append-only), 삭제/수정 절대 불가.
 */

/** 감사 항목 유형 */
export type StrategicEntryType =
  | 'RECOMMENDATION'
  | 'SIMULATION'
  | 'DECISION'
  | 'OVERRIDE'
  | 'VETO';

/** 전략적 감사 항목 인터페이스 */
export interface StrategicAuditEntry {
  entryId: string;
  entryType: StrategicEntryType;
  /** 행동 주체 (사용자 ID 또는 시스템) */
  actor: string;
  /** 수행한 행동 설명 */
  action: string;
  /** 행동 근거 */
  rationale: string;
  /** 연관된 증거 ID 목록 */
  linkedEvidence: string[];
  timestamp: Date;
  /** 불변 플래그 — 항상 true */
  immutable: true;
}

/** 감사 로그 필터 옵션 */
export interface AuditLogFilter {
  entryType?: StrategicEntryType;
  actor?: string;
  startDate?: Date;
  endDate?: Date;
}

// 인메모리 저장소 (production: DB-backed)
// append-only 배열 — 삭제/수정 메서드 없음
const auditLog: StrategicAuditEntry[] = [];

/** 고유 ID 생성 유틸 */
function generateEntryId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 전략적 행동을 감사 로그에 기록한다.
 * 규칙: 한 번 기록된 항목은 절대 삭제하거나 수정할 수 없다.
 */
export function logStrategicAction(
  entry: Omit<StrategicAuditEntry, 'entryId' | 'timestamp' | 'immutable'>
): void {
  const fullEntry: StrategicAuditEntry = {
    ...entry,
    entryId: generateEntryId(),
    timestamp: new Date(),
    immutable: true,
  };

  // append-only: push만 허용
  auditLog.push(Object.freeze(fullEntry) as StrategicAuditEntry);
}

/**
 * 감사 로그를 조회한다 (필터 적용 가능).
 * 반환값은 불변 복사본이다.
 */
export function getStrategicAuditLog(
  filters?: AuditLogFilter
): StrategicAuditEntry[] {
  let results = [...auditLog];

  if (filters) {
    if (filters.entryType) {
      results = results.filter((e) => e.entryType === filters.entryType);
    }
    if (filters.actor) {
      results = results.filter((e) => e.actor === filters.actor);
    }
    if (filters.startDate) {
      const start = filters.startDate;
      results = results.filter((e) => e.timestamp >= start);
    }
    if (filters.endDate) {
      const end = filters.endDate;
      results = results.filter((e) => e.timestamp <= end);
    }
  }

  // 불변 복사본 반환
  return results.map((e) => ({ ...e }));
}
