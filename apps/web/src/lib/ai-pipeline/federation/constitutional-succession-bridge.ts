/**
 * @module constitutional-succession-bridge
 * @description 헌법적 세대교체 브릿지
 *
 * 기관 내부의 승계 불안정성을 감지하고,
 * 연합 전체에 영향이 퍼지지 않도록 즉시 범위를 제한하며,
 * 전환 완료 후 자동 복원하는 메커니즘을 제공한다.
 * CRITICAL: 승계 불안정 감지 → 즉시 범위 제한으로 연합 사각지대 방지.
 */

import type { ApprovedScope } from './interinstitutional-registry';

/** 전환 리스크 수준 */
export type TransitionRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** 범위 제한 조치 */
export interface ScopeRestriction {
  /** 대상 기관 ID */
  institutionId: string;
  /** 원래 범위 */
  originalScope: ApprovedScope;
  /** 제한된 범위 */
  restrictedScope: ApprovedScope;
  /** 제한 사유 */
  reason: string;
  /** 제한 시작 일시 */
  effectiveFrom: Date;
  /** 제한 종료 일시 (null이면 무기한) */
  effectiveTo: Date | null;
  /** 자동 복원 여부 */
  autoRestore: boolean;
  /** 복원 완료 여부 */
  restored: boolean;
}

/** 승계 불안정 감지 입력 */
export interface SuccessionInput {
  /** 기관 ID */
  institutionId: string;
  /** 핵심 인력 수 */
  keyPersonnelCount: number;
  /** 후임 지명 수 */
  designatedSuccessors: number;
  /** 최근 퇴직/이동 수 (30일 내) */
  recentDepartures: number;
  /** 문서화된 인수인계 절차 존재 여부 */
  handoverDocumented: boolean;
  /** 최근 승계 테스트 수행 여부 */
  successionTested: boolean;
}

/** 승계 불안정 감지 결과 */
export interface SuccessionInstabilityResult {
  /** 기관 ID */
  institutionId: string;
  /** 리스크 수준 */
  risk: TransitionRisk;
  /** 불안정 요인 */
  factors: string[];
  /** 즉시 범위 제한 필요 여부 */
  immediateRestrictionRequired: boolean;
}

/** 전환 로그 항목 */
export interface TransitionLogEntry {
  /** 기관 ID */
  institutionId: string;
  /** 이벤트 유형 */
  event: 'RESTRICTION_APPLIED' | 'RESTRICTION_RESTORED' | 'RISK_DETECTED' | 'MONITORING';
  /** 상세 내용 */
  details: string;
  /** 기록 일시 */
  timestamp: Date;
}

// ── 인메모리 저장소 ──
const restrictions: ScopeRestriction[] = [];
const transitionLog: TransitionLogEntry[] = [];

/**
 * 승계 불안정성을 감지한다.
 * CRITICAL: 불안정 감지 시 즉시 범위 제한을 권고한다.
 *
 * @param input 감지 입력 데이터
 * @returns 감지 결과
 */
export function detectSuccessionInstability(
  input: SuccessionInput,
): SuccessionInstabilityResult {
  const factors: string[] = [];
  let riskScore = 0;

  // 후임 지명 비율 확인
  if (input.keyPersonnelCount > 0) {
    const successorRatio = input.designatedSuccessors / input.keyPersonnelCount;
    if (successorRatio < 0.5) {
      factors.push(`후임 지명 비율 ${Math.round(successorRatio * 100)}% — 50% 미만`);
      riskScore += 3;
    } else if (successorRatio < 0.8) {
      factors.push(`후임 지명 비율 ${Math.round(successorRatio * 100)}% — 80% 미만`);
      riskScore += 1;
    }
  }

  // 최근 퇴직/이동
  if (input.recentDepartures >= 3) {
    factors.push(`최근 30일 내 ${input.recentDepartures}명 퇴직/이동 — 대량 이탈`);
    riskScore += 4;
  } else if (input.recentDepartures >= 1) {
    factors.push(`최근 30일 내 ${input.recentDepartures}명 퇴직/이동`);
    riskScore += 1;
  }

  // 인수인계 문서화
  if (!input.handoverDocumented) {
    factors.push('인수인계 절차 미문서화');
    riskScore += 2;
  }

  // 승계 테스트
  if (!input.successionTested) {
    factors.push('승계 테스트 미수행');
    riskScore += 1;
  }

  // 리스크 수준 판정
  let risk: TransitionRisk;
  if (riskScore >= 7) {
    risk = 'CRITICAL';
  } else if (riskScore >= 5) {
    risk = 'HIGH';
  } else if (riskScore >= 3) {
    risk = 'MEDIUM';
  } else {
    risk = 'LOW';
  }

  const immediateRestrictionRequired = risk === 'CRITICAL' || risk === 'HIGH';

  // 로그 기록
  transitionLog.push({
    institutionId: input.institutionId,
    event: 'RISK_DETECTED',
    details: `리스크 수준: ${risk}, 요인: ${factors.join('; ')}`,
    timestamp: new Date(),
  });

  return {
    institutionId: input.institutionId,
    risk,
    factors,
    immediateRestrictionRequired,
  };
}

/**
 * 범위 제한 조치를 적용한다.
 *
 * @param params 제한 파라미터
 * @returns 적용된 제한 조치
 */
export function applyScopeRestriction(params: {
  institutionId: string;
  originalScope: ApprovedScope;
  restrictedScope: ApprovedScope;
  reason: string;
  durationMs?: number;
  autoRestore?: boolean;
}): ScopeRestriction {
  const restriction: ScopeRestriction = {
    institutionId: params.institutionId,
    originalScope: params.originalScope,
    restrictedScope: params.restrictedScope,
    reason: params.reason,
    effectiveFrom: new Date(),
    effectiveTo: params.durationMs
      ? new Date(Date.now() + params.durationMs)
      : null,
    autoRestore: params.autoRestore ?? false,
    restored: false,
  };

  restrictions.push(restriction);

  transitionLog.push({
    institutionId: params.institutionId,
    event: 'RESTRICTION_APPLIED',
    details: `${params.originalScope} → ${params.restrictedScope}: ${params.reason}`,
    timestamp: new Date(),
  });

  return { ...restriction };
}

/**
 * 전환 상황을 모니터링한다.
 *
 * @param institutionId 기관 ID
 * @returns 현재 제한 조치 목록
 */
export function monitorTransition(institutionId: string): ScopeRestriction[] {
  const now = new Date();
  const active = restrictions.filter(
    (r) =>
      r.institutionId === institutionId &&
      !r.restored &&
      (r.effectiveTo === null || r.effectiveTo > now),
  );

  transitionLog.push({
    institutionId,
    event: 'MONITORING',
    details: `활성 제한 조치 ${active.length}건`,
    timestamp: new Date(),
  });

  return active.map((r) => ({ ...r }));
}

/**
 * 범위를 복원한다.
 *
 * @param institutionId 기관 ID
 * @returns 복원된 제한 조치 수
 */
export function restoreScope(institutionId: string): number {
  let restoredCount = 0;
  for (const r of restrictions) {
    if (r.institutionId === institutionId && !r.restored) {
      r.restored = true;
      restoredCount++;
    }
  }

  if (restoredCount > 0) {
    transitionLog.push({
      institutionId,
      event: 'RESTRICTION_RESTORED',
      details: `${restoredCount}건의 제한 조치 복원됨`,
      timestamp: new Date(),
    });
  }

  return restoredCount;
}

/**
 * 전환 로그를 반환한다.
 *
 * @param institutionId 필터: 기관 ID (선택)
 */
export function getTransitionLog(institutionId?: string): TransitionLogEntry[] {
  if (institutionId) {
    return transitionLog
      .filter((l) => l.institutionId === institutionId)
      .map((l) => ({ ...l }));
  }
  return transitionLog.map((l) => ({ ...l }));
}
