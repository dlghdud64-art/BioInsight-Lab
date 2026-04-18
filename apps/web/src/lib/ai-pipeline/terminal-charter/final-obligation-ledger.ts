/**
 * @module final-obligation-ledger
 * @description 최종 의무 원장 — 시스템이 영구적으로 이행해야 하는 의무를 등록·관리한다.
 * 데이터 보존, 공익 지원, 감사 연속성, 구제 완료, 승계 의무 카테고리로 분류된다.
 * 의무는 Phase 종료 후에도 영구 존속한다.
 */

/** 의무 카테고리 */
export type ObligationCategory =
  | "DATA_PRESERVATION"
  | "PUBLIC_INTEREST_SUPPORT"
  | "AUDIT_CONTINUITY"
  | "REMEDIATION_COMPLETION"
  | "SUCCESSION_DUTY";

/** 영구 의무 */
export interface PerpetualObligation {
  /** 의무 고유 ID */
  id: string;
  /** 의무 설명 */
  description: string;
  /** 담당 역할 */
  assignedRole: string;
  /** 카테고리 */
  category: ObligationCategory;
  /** 등록 일시 */
  registeredAt: Date;
  /** 만료 없음 — 항상 true */
  neverExpires: true;
}

/** 이행 검증 결과 */
export interface FulfillmentVerification {
  /** 의무 ID */
  obligationId: string;
  /** 이행 상태 */
  fulfilled: boolean;
  /** 검증 일시 */
  verifiedAt: Date;
  /** 증거 설명 */
  evidence: string;
  /** 검증자 */
  verifiedBy: string;
}

/** 인메모리 의무 저장소 */
const obligations: Map<string, PerpetualObligation> = new Map();

/** 이행 검증 이력 */
const fulfillmentLog: FulfillmentVerification[] = [];

/**
 * 영구 의무를 등록한다. 한번 등록된 의무는 삭제할 수 없다.
 * @param description - 의무 설명
 * @param assignedRole - 담당 역할
 * @param category - 의무 카테고리
 * @returns 등록된 의무
 */
export function registerObligation(
  description: string,
  assignedRole: string,
  category: ObligationCategory
): PerpetualObligation {
  const obligation: PerpetualObligation = {
    id: `OBL-${Date.now()}-${obligations.size}`,
    description,
    assignedRole,
    category,
    registeredAt: new Date(),
    neverExpires: true,
  };

  obligations.set(obligation.id, obligation);
  return { ...obligation };
}

/**
 * 역할별 의무를 조회한다.
 * @param role - 조회할 역할
 * @returns 해당 역할에 할당된 의무 배열
 */
export function getObligationsByRole(role: string): PerpetualObligation[] {
  return Array.from(obligations.values()).filter(
    (o) => o.assignedRole === role
  );
}

/**
 * 카테고리별 의무를 조회한다.
 * @param category - 조회할 카테고리
 * @returns 해당 카테고리의 의무 배열
 */
export function getObligationsByCategory(
  category: ObligationCategory
): PerpetualObligation[] {
  return Array.from(obligations.values()).filter(
    (o) => o.category === category
  );
}

/**
 * 의무 이행을 검증하고 기록한다.
 * @param obligationId - 검증할 의무 ID
 * @param fulfilled - 이행 여부
 * @param evidence - 증거 설명
 * @param verifiedBy - 검증자
 * @returns 검증 성공 여부
 */
export function verifyFulfillment(
  obligationId: string,
  fulfilled: boolean,
  evidence: string,
  verifiedBy: string
): boolean {
  if (!obligations.has(obligationId)) return false;

  fulfillmentLog.push({
    obligationId,
    fulfilled,
    verifiedAt: new Date(),
    evidence,
    verifiedBy,
  });

  return true;
}

/**
 * 미이행 의무를 반환한다.
 * 최근 검증에서 미이행 판정을 받았거나 검증되지 않은 의무.
 * @returns 미이행 의무 배열
 */
export function getUnfulfilledObligations(): PerpetualObligation[] {
  const latestVerification = new Map<string, FulfillmentVerification>();

  // 각 의무별 최신 검증 결과 수집
  for (const entry of fulfillmentLog) {
    const existing = latestVerification.get(entry.obligationId);
    if (
      !existing ||
      entry.verifiedAt.getTime() > existing.verifiedAt.getTime()
    ) {
      latestVerification.set(entry.obligationId, entry);
    }
  }

  return Array.from(obligations.values()).filter((o) => {
    const verification = latestVerification.get(o.id);
    // 검증 기록 없거나 미이행
    return !verification || !verification.fulfilled;
  });
}

/**
 * 전체 의무 원장을 반환한다.
 * @returns 전체 의무 배열
 */
export function getAllObligations(): PerpetualObligation[] {
  return Array.from(obligations.values());
}

/**
 * 이행 검증 이력을 반환한다.
 * @returns 이행 검증 이력 배열
 */
export function getFulfillmentLog(): FulfillmentVerification[] {
  return [...fulfillmentLog];
}
