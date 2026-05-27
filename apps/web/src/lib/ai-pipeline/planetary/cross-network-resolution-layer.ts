/**
 * 교차 네트워크 해결 레이어 (Cross-Network Resolution Layer)
 *
 * 네트워크 간 이의 제기·분쟁을 해결하기 위한 다양한 해결 유형
 * (구속 중재, 조정 합의, 관할 존중, 에스컬레이션 거버넌스)을 지원.
 */

/** 해결 유형 */
export type ResolutionType =
  | "BINDING_ARBITRATION"
  | "MEDIATED_AGREEMENT"
  | "JURISDICTIONAL_DEFERENCE"
  | "ESCALATED_GOVERNANCE";

/** 해결 기록 */
export interface ResolutionRecord {
  /** 고유 식별자 */
  id: string;
  /** 관련 이의 제기 ID */
  contestationId: string;
  /** 해결 유형 */
  type: ResolutionType;
  /** 당사자 목록 */
  parties: string[];
  /** 해결 내용 */
  resolution: string;
  /** 선례 설정 여부 */
  precedentSet: boolean;
  /** 해결 시각 */
  resolvedAt: number | null;
}

// ─── 인메모리 저장소 ───
const resolutionStore = new Map<string, ResolutionRecord>();
const precedentStore: ResolutionRecord[] = [];

/**
 * 해결 프로세스 개시
 */
export function initiateResolution(
  contestationId: string,
  type: ResolutionType,
  parties: string[]
): ResolutionRecord {
  const id = `res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const record: ResolutionRecord = {
    id,
    contestationId,
    type,
    parties,
    resolution: "",
    precedentSet: false,
    resolvedAt: null,
  };

  resolutionStore.set(id, record);
  return record;
}

/**
 * 해결안 제안
 */
export function proposeResolution(
  resolutionId: string,
  proposedResolution: string
): ResolutionRecord {
  const record = resolutionStore.get(resolutionId);
  if (!record) {
    throw new Error(`해결 기록을 찾을 수 없습니다: ${resolutionId}`);
  }

  record.resolution = proposedResolution;
  return record;
}

/**
 * 해결 확정
 *
 * @param resolutionId 해결 기록 ID
 * @param setPrecedent 선례로 설정할지 여부
 */
export function finalizeResolution(
  resolutionId: string,
  setPrecedent: boolean = false
): ResolutionRecord {
  const record = resolutionStore.get(resolutionId);
  if (!record) {
    throw new Error(`해결 기록을 찾을 수 없습니다: ${resolutionId}`);
  }

  if (!record.resolution) {
    throw new Error("해결안이 제안되지 않은 상태에서 확정할 수 없습니다.");
  }

  record.resolvedAt = Date.now();
  record.precedentSet = setPrecedent;

  if (setPrecedent) {
    precedentStore.push({ ...record });
  }

  return record;
}

/**
 * 선례 목록 조회
 */
export function getResolutionPrecedents(): ResolutionRecord[] {
  return [...precedentStore];
}
