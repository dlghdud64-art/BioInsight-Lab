/**
 * @module cross-institution-conflict-resolution
 * @description 기관 간 충돌 해결 프레임워크
 *
 * 기관 간 분쟁을 체계적으로 해결하기 위한 프레임워크.
 * 단계는 반드시 순서대로 진행해야 한다:
 * FREEZE → EVIDENCE_COLLECTION → INTERIM_RULING → FINAL_RESOLUTION
 */

/** 충돌 단계 — 반드시 순서대로 진행 */
export type ConflictPhase =
  | 'FREEZE'
  | 'EVIDENCE_COLLECTION'
  | 'INTERIM_RULING'
  | 'FINAL_RESOLUTION';

/** 충돌 유형 */
export type ConflictType =
  | 'CHARTER_INTERPRETATION'
  | 'EVIDENCE_DISCREPANCY'
  | 'RECOVERY_RESPONSIBILITY'
  | 'SCOPE_DISPUTE'
  | 'TRUST_VIOLATION';

/** 증거 항목 */
export interface ConflictEvidence {
  /** 제출 기관 ID */
  submittedBy: string;
  /** 증거 설명 */
  description: string;
  /** 증거 해시 */
  evidenceHash: string;
  /** 제출 일시 */
  submittedAt: Date;
}

/** 잠정 판결 */
export interface InterimRuling {
  /** 판결 내용 */
  ruling: string;
  /** 판결자 */
  issuedBy: string;
  /** 판결 일시 */
  issuedAt: Date;
  /** 잠정 조치 */
  provisionalMeasures: string[];
}

/** 최종 해결 */
export interface FinalResolution {
  /** 해결 내용 */
  resolution: string;
  /** 해결자 */
  resolvedBy: string;
  /** 해결 일시 */
  resolvedAt: Date;
  /** 구속력 있는 조치 */
  bindingActions: string[];
  /** 후속 모니터링 필요 여부 */
  requiresFollowUp: boolean;
}

/** 충돌 사건 */
export interface ConflictCase {
  /** 사건 고유 ID */
  id: string;
  /** 충돌 유형 */
  type: ConflictType;
  /** 원고 기관 ID */
  complainant: string;
  /** 피고 기관 ID */
  respondent: string;
  /** 현재 단계 */
  phase: ConflictPhase;
  /** 수집된 증거 */
  evidence: ConflictEvidence[];
  /** 잠정 판결 (해당 단계 이전에는 null) */
  interimRuling: InterimRuling | null;
  /** 최종 해결 (해당 단계 이전에는 null) */
  finalResolution: FinalResolution | null;
  /** 개시 일시 */
  openedAt: Date;
  /** 해결 일시 (미해결 시 null) */
  resolvedAt: Date | null;
}

// ── 인메모리 저장소 ──
const conflicts: ConflictCase[] = [];

/** 단계 순서 정의 */
const PHASE_ORDER: ConflictPhase[] = [
  'FREEZE',
  'EVIDENCE_COLLECTION',
  'INTERIM_RULING',
  'FINAL_RESOLUTION',
];

/**
 * 충돌 사건을 개시한다. 초기 단계는 FREEZE이다.
 *
 * @param params 사건 개시 파라미터
 * @returns 생성된 사건
 */
export function openConflict(params: {
  id: string;
  type: ConflictType;
  complainant: string;
  respondent: string;
}): ConflictCase {
  const existing = conflicts.find((c) => c.id === params.id);
  if (existing) {
    throw new Error(`이미 존재하는 사건 ID: ${params.id}`);
  }

  const conflict: ConflictCase = {
    id: params.id,
    type: params.type,
    complainant: params.complainant,
    respondent: params.respondent,
    phase: 'FREEZE',
    evidence: [],
    interimRuling: null,
    finalResolution: null,
    openedAt: new Date(),
    resolvedAt: null,
  };

  conflicts.push(conflict);
  return cloneConflict(conflict);
}

/**
 * 사건을 다음 단계로 진행한다.
 * 단계 순서: FREEZE → EVIDENCE_COLLECTION → INTERIM_RULING → FINAL_RESOLUTION
 *
 * @param conflictId 사건 ID
 * @returns 진행된 사건
 */
export function advancePhase(conflictId: string): ConflictCase {
  const conflict = conflicts.find((c) => c.id === conflictId);
  if (!conflict) {
    throw new Error(`존재하지 않는 사건: ${conflictId}`);
  }

  const currentIndex = PHASE_ORDER.indexOf(conflict.phase);
  if (currentIndex === PHASE_ORDER.length - 1) {
    throw new Error(`이미 최종 단계(FINAL_RESOLUTION)에 도달한 사건: ${conflictId}`);
  }

  // EVIDENCE_COLLECTION으로 진행 시 최소 증거 확인
  if (conflict.phase === 'EVIDENCE_COLLECTION' && conflict.evidence.length === 0) {
    throw new Error('증거가 수집되지 않은 상태에서 다음 단계로 진행할 수 없음');
  }

  conflict.phase = PHASE_ORDER[currentIndex + 1];
  return cloneConflict(conflict);
}

/**
 * 증거를 제출한다. EVIDENCE_COLLECTION 단계에서만 허용된다.
 *
 * @param conflictId 사건 ID
 * @param evidence 증거 항목
 */
export function submitEvidence(
  conflictId: string,
  evidence: Omit<ConflictEvidence, 'submittedAt'>,
): ConflictCase {
  const conflict = conflicts.find((c) => c.id === conflictId);
  if (!conflict) {
    throw new Error(`존재하지 않는 사건: ${conflictId}`);
  }

  // FREEZE 또는 EVIDENCE_COLLECTION 단계에서만 증거 제출 가능
  if (conflict.phase !== 'FREEZE' && conflict.phase !== 'EVIDENCE_COLLECTION') {
    throw new Error(`현재 단계(${conflict.phase})에서는 증거를 제출할 수 없음`);
  }

  conflict.evidence.push({
    ...evidence,
    submittedAt: new Date(),
  });

  return cloneConflict(conflict);
}

/**
 * 잠정 판결을 내린다. INTERIM_RULING 단계에서만 가능하다.
 *
 * @param conflictId 사건 ID
 * @param ruling 잠정 판결 내용
 */
export function issueInterimRuling(
  conflictId: string,
  ruling: Omit<InterimRuling, 'issuedAt'>,
): ConflictCase {
  const conflict = conflicts.find((c) => c.id === conflictId);
  if (!conflict) {
    throw new Error(`존재하지 않는 사건: ${conflictId}`);
  }
  if (conflict.phase !== 'INTERIM_RULING') {
    throw new Error(`잠정 판결은 INTERIM_RULING 단계에서만 가능 (현재: ${conflict.phase})`);
  }

  conflict.interimRuling = {
    ...ruling,
    issuedAt: new Date(),
  };

  return cloneConflict(conflict);
}

/**
 * 사건을 최종 해결한다. FINAL_RESOLUTION 단계에서만 가능하다.
 *
 * @param conflictId 사건 ID
 * @param resolution 최종 해결 내용
 */
export function resolveConflict(
  conflictId: string,
  resolution: Omit<FinalResolution, 'resolvedAt'>,
): ConflictCase {
  const conflict = conflicts.find((c) => c.id === conflictId);
  if (!conflict) {
    throw new Error(`존재하지 않는 사건: ${conflictId}`);
  }
  if (conflict.phase !== 'FINAL_RESOLUTION') {
    throw new Error(`최종 해결은 FINAL_RESOLUTION 단계에서만 가능 (현재: ${conflict.phase})`);
  }

  conflict.finalResolution = {
    ...resolution,
    resolvedAt: new Date(),
  };
  conflict.resolvedAt = new Date();

  return cloneConflict(conflict);
}

/**
 * 활성 사건(미해결) 목록을 반환한다.
 */
export function getActiveConflicts(): ConflictCase[] {
  return conflicts
    .filter((c) => c.resolvedAt === null)
    .map(cloneConflict);
}

/**
 * 전체 사건 목록을 반환한다.
 */
export function getAllConflicts(): ConflictCase[] {
  return conflicts.map(cloneConflict);
}

/** 사건 객체 깊은 복사 */
function cloneConflict(c: ConflictCase): ConflictCase {
  return {
    ...c,
    evidence: c.evidence.map((e) => ({ ...e })),
    interimRuling: c.interimRuling ? { ...c.interimRuling, provisionalMeasures: [...c.interimRuling.provisionalMeasures] } : null,
    finalResolution: c.finalResolution ? { ...c.finalResolution, bindingActions: [...c.finalResolution.bindingActions] } : null,
  };
}
