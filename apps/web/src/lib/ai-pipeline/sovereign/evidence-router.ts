/**
 * @module evidence-router
 * @description 증거 라우팅 엔진 — 관할권 간 증거 데이터 전송 경로 결정 및 수정(Redaction) 적용
 */

/** 라우팅 결정 */
export interface RoutingDecision {
  /** 증거 고유 ID */
  evidenceId: string;
  /** 출발 리전 */
  sourceRegion: string;
  /** 도착 리전 */
  targetRegion: string;
  /** 전송 허용 여부 */
  permitted: boolean;
  /** 수정(Redaction) 필요 여부 */
  redactionRequired: boolean;
  /** 사용된 전송 메커니즘 */
  mechanism: string;
  /** 라우팅 시각 */
  routedAt: Date;
}

/** 라우팅 규칙 */
interface RoutingRule {
  sourceRegion: string;
  targetRegion: string;
  permitted: boolean;
  redactionRequired: boolean;
  mechanism: string;
}

/** 인메모리 라우팅 규칙 저장소 */
const routingRules: RoutingRule[] = [];

/** 인메모리 라우팅 로그 */
const routingLog: RoutingDecision[] = [];

/**
 * 라우팅 규칙을 등록한다.
 * @param rule 라우팅 규칙
 */
export function registerRoutingRule(rule: RoutingRule): void {
  const idx = routingRules.findIndex(
    (r) => r.sourceRegion === rule.sourceRegion && r.targetRegion === rule.targetRegion,
  );
  if (idx !== -1) {
    routingRules[idx] = rule;
  } else {
    routingRules.push(rule);
  }
}

/**
 * 증거 데이터를 라우팅한다.
 * @param evidenceId 증거 ID
 * @param sourceRegion 출발 리전
 * @param targetRegion 도착 리전
 * @returns 라우팅 결정
 */
export function routeEvidence(
  evidenceId: string,
  sourceRegion: string,
  targetRegion: string,
): RoutingDecision {
  const rule = routingRules.find(
    (r) => r.sourceRegion === sourceRegion && r.targetRegion === targetRegion,
  );

  const decision: RoutingDecision = {
    evidenceId,
    sourceRegion,
    targetRegion,
    permitted: rule ? rule.permitted : sourceRegion === targetRegion,
    redactionRequired: rule ? rule.redactionRequired : false,
    mechanism: rule ? rule.mechanism : 'SAME_REGION',
    routedAt: new Date(),
  };

  routingLog.push(decision);
  return decision;
}

/**
 * 증거 라우팅 권한을 확인한다.
 * @param sourceRegion 출발 리전
 * @param targetRegion 도착 리전
 * @returns 허용 여부와 수정 필요 여부
 */
export function checkRoutingPermission(
  sourceRegion: string,
  targetRegion: string,
): { permitted: boolean; redactionRequired: boolean } {
  if (sourceRegion === targetRegion) {
    return { permitted: true, redactionRequired: false };
  }

  const rule = routingRules.find(
    (r) => r.sourceRegion === sourceRegion && r.targetRegion === targetRegion,
  );

  return {
    permitted: rule ? rule.permitted : false,
    redactionRequired: rule ? rule.redactionRequired : true,
  };
}

/**
 * 관할권 기반 수정(Redaction)을 적용한다.
 * @param evidenceId 증거 ID
 * @param content 원본 콘텐츠
 * @param targetRegion 도착 리전
 * @returns 수정된 콘텐츠
 */
export function applyJurisdictionalRedaction(
  evidenceId: string,
  content: Record<string, unknown>,
  targetRegion: string,
): Record<string, unknown> {
  const sensitiveFields = ['personalId', 'ssn', 'taxId', 'healthRecord', 'biometric'];
  const redacted = { ...content };

  for (const field of sensitiveFields) {
    if (field in redacted) {
      redacted[field] = `[REDACTED for ${targetRegion}]`;
    }
  }

  return redacted;
}

/**
 * 라우팅 로그를 조회한다.
 * @param filter 필터 조건 (선택)
 * @returns 라우팅 결정 배열
 */
export function getRoutingLog(filter?: {
  sourceRegion?: string;
  targetRegion?: string;
  permitted?: boolean;
}): RoutingDecision[] {
  if (!filter) return [...routingLog];

  return routingLog.filter((d) => {
    if (filter.sourceRegion && d.sourceRegion !== filter.sourceRegion) return false;
    if (filter.targetRegion && d.targetRegion !== filter.targetRegion) return false;
    if (filter.permitted !== undefined && d.permitted !== filter.permitted) return false;
    return true;
  });
}
