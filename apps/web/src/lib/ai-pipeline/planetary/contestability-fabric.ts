/**
 * 이의 제기 패브릭 (Contestability Fabric)
 *
 * 이의 제기(contestation)의 수명주기를 관리.
 * CRITICAL: 이의 제기 접수 즉시 자산은 CAUTION 상태로 전환.
 * 미해결 건은 SUSPENDED로 전환.
 */

/** 이의 제기 단계 */
export type ContestationPhase =
  | "FILED"
  | "JURISDICTION_ROUTING"
  | "UNDER_REVIEW"
  | "CAUTION"
  | "SUSPENDED"
  | "RESOLVED";

/** 이의 제기 건 */
export interface ContestationCase {
  /** 고유 식별자 */
  id: string;
  /** 대상 단언 ID */
  assertionId: string;
  /** 제기자 */
  filedBy: string;
  /** 제기 관할권 */
  filedInJurisdiction: string;
  /** 현재 단계 */
  phase: ContestationPhase;
  /** 증거 목록 */
  evidence: string[];
  /** 해결 결과 (null이면 미해결) */
  resolution: string | null;
  /** 제기 시각 */
  filedAt: number;
  /** 해결 시각 */
  resolvedAt: number | null;
}

// ─── 인메모리 저장소 ───
const contestationStore = new Map<string, ContestationCase>();
// assertionId → ContestationCase.id[]
const assertionContestations = new Map<string, string[]>();

/**
 * 이의 제기 접수 — 즉시 CAUTION 상태로 전환
 */
export function fileContestation(
  assertionId: string,
  filedBy: string,
  filedInJurisdiction: string,
  evidence: string[]
): ContestationCase {
  const id = `contest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const contestation: ContestationCase = {
    id,
    assertionId,
    filedBy,
    filedInJurisdiction,
    phase: "CAUTION", // 즉시 CAUTION
    evidence,
    resolution: null,
    filedAt: Date.now(),
    resolvedAt: null,
  };

  contestationStore.set(id, contestation);

  const existing = assertionContestations.get(assertionId) ?? [];
  existing.push(id);
  assertionContestations.set(assertionId, existing);

  return contestation;
}

/**
 * 관할권 라우팅
 */
export function routeToJurisdiction(
  contestationId: string,
  targetJurisdiction: string
): ContestationCase {
  const contestation = getOrThrow(contestationId);
  contestation.phase = "JURISDICTION_ROUTING";
  contestation.filedInJurisdiction = targetJurisdiction;
  return contestation;
}

/**
 * CAUTION 마킹 (이미 CAUTION이면 무변경)
 */
export function markCaution(contestationId: string): ContestationCase {
  const contestation = getOrThrow(contestationId);
  contestation.phase = "CAUTION";
  return contestation;
}

/**
 * 자산 정지 — 미해결 이의 제기 시 SUSPENDED로 전환
 */
export function suspendAsset(contestationId: string): ContestationCase {
  const contestation = getOrThrow(contestationId);
  contestation.phase = "SUSPENDED";
  return contestation;
}

/**
 * 이의 제기 해결
 */
export function resolveContestation(
  contestationId: string,
  resolution: string
): ContestationCase {
  const contestation = getOrThrow(contestationId);
  contestation.phase = "RESOLVED";
  contestation.resolution = resolution;
  contestation.resolvedAt = Date.now();
  return contestation;
}

/**
 * 특정 단언에 대한 이의 제기 건 목록 조회
 */
export function getContestationsByAssertion(assertionId: string): ContestationCase[] {
  const ids = assertionContestations.get(assertionId) ?? [];
  return ids
    .map((id) => contestationStore.get(id))
    .filter((c): c is ContestationCase => c !== undefined);
}

// ─── 헬퍼 ───
function getOrThrow(contestationId: string): ContestationCase {
  const c = contestationStore.get(contestationId);
  if (!c) {
    throw new Error(`이의 제기 건을 찾을 수 없습니다: ${contestationId}`);
  }
  return c;
}
