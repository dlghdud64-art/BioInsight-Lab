/**
 * @module assurance-routing-layer
 * @description 보증 라우팅 레이어
 *
 * 보증 주장의 유통 경로를 제어한다. 계층, 관할권, 데이터 분류에 따라
 * 라우팅 규칙을 평가하며, 철회되거나 이의 제기된 주장은 항상 차단한다.
 */

/** 라우팅 규칙 */
export interface RoutingRule {
  /** 규칙 고유 식별자 */
  id: string;
  /** 출발 계층 */
  sourceTier: string;
  /** 도착 계층 */
  targetTier: string;
  /** 관할권 */
  jurisdiction: string;
  /** 데이터 분류 */
  dataClassification: string;
  /** 허용 여부 */
  allowed: boolean;
  /** 추가 조건 */
  conditions: string[];
}

/** 라우팅 결정 */
export interface RoutingDecision {
  /** 주장 ID */
  assertionId: string;
  /** 허용 여부 */
  allowed: boolean;
  /** 차단 사유 (차단 시) */
  blockedReason: string | null;
  /** 적용된 규칙 ID 목록 */
  appliedRules: string[];
}

/** 라우팅 로그 항목 */
export interface RoutingLogEntry {
  /** 주장 ID */
  assertionId: string;
  /** 결정 */
  decision: RoutingDecision;
  /** 결정 시각 */
  decidedAt: number;
}

// --- 인메모리 저장소 ---
const routingRules: RoutingRule[] = [];
const routingLog: RoutingLogEntry[] = [];
const contestedAssertionIds: Set<string> = new Set();
const revokedAssertionIds: Set<string> = new Set();

/**
 * 주장의 라우팅 가능 여부를 평가한다.
 * 철회되거나 이의 제기된 주장은 항상 차단된다.
 * @param assertionId - 주장 ID
 * @param sourceTier - 출발 계층
 * @param targetTier - 도착 계층
 * @param jurisdiction - 관할권
 * @param dataClassification - 데이터 분류
 * @returns 라우팅 결정
 */
export function evaluateRoute(
  assertionId: string,
  sourceTier: string,
  targetTier: string,
  jurisdiction: string,
  dataClassification: string
): RoutingDecision {
  // 철회/이의 제기된 주장은 항상 차단
  if (revokedAssertionIds.has(assertionId)) {
    const decision: RoutingDecision = {
      assertionId,
      allowed: false,
      blockedReason: "철회된 주장은 라우팅이 차단됩니다.",
      appliedRules: [],
    };
    routingLog.push({ assertionId, decision, decidedAt: Date.now() });
    return decision;
  }

  if (contestedAssertionIds.has(assertionId)) {
    const decision: RoutingDecision = {
      assertionId,
      allowed: false,
      blockedReason: "이의 제기된 주장은 라우팅이 즉시 중단됩니다.",
      appliedRules: [],
    };
    routingLog.push({ assertionId, decision, decidedAt: Date.now() });
    return decision;
  }

  // 일치하는 규칙 평가
  const applicableRules = routingRules.filter(
    (r) =>
      (r.sourceTier === "*" || r.sourceTier === sourceTier) &&
      (r.targetTier === "*" || r.targetTier === targetTier) &&
      (r.jurisdiction === "*" || r.jurisdiction === jurisdiction) &&
      (r.dataClassification === "*" || r.dataClassification === dataClassification)
  );

  const blockedRule = applicableRules.find((r) => !r.allowed);
  if (blockedRule) {
    const decision: RoutingDecision = {
      assertionId,
      allowed: false,
      blockedReason: `라우팅 규칙 ${blockedRule.id}에 의해 차단: ${blockedRule.conditions.join(", ")}`,
      appliedRules: applicableRules.map((r) => r.id),
    };
    routingLog.push({ assertionId, decision, decidedAt: Date.now() });
    return decision;
  }

  const decision: RoutingDecision = {
    assertionId,
    allowed: true,
    blockedReason: null,
    appliedRules: applicableRules.map((r) => r.id),
  };
  routingLog.push({ assertionId, decision, decidedAt: Date.now() });
  return decision;
}

/**
 * 라우팅 규칙을 추가한다.
 * @param rule - 라우팅 규칙
 * @returns 추가된 규칙
 */
export function addRoutingRule(rule: Omit<RoutingRule, "id">): RoutingRule {
  const newRule: RoutingRule = {
    ...rule,
    id: `rr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  };
  routingRules.push(newRule);
  return newRule;
}

/**
 * 특정 조건에 해당하는 라우팅 규칙을 반환한다.
 * @param sourceTier - 출발 계층
 * @param targetTier - 도착 계층
 * @returns 적용 가능한 규칙 배열
 */
export function getApplicableRules(sourceTier: string, targetTier: string): RoutingRule[] {
  return routingRules.filter(
    (r) =>
      (r.sourceTier === "*" || r.sourceTier === sourceTier) &&
      (r.targetTier === "*" || r.targetTier === targetTier)
  );
}

/**
 * 주장을 라우팅 차단 상태로 설정한다.
 * @param assertionId - 차단할 주장 ID
 * @param reason - "contested" 또는 "revoked"
 */
export function blockRoute(assertionId: string, reason: "contested" | "revoked"): void {
  if (reason === "contested") {
    contestedAssertionIds.add(assertionId);
  } else {
    revokedAssertionIds.add(assertionId);
  }
}

/**
 * 라우팅 로그를 반환한다.
 * @param limit - 최대 반환 건수
 * @returns 라우팅 로그 항목 배열
 */
export function getRoutingLog(limit: number = 100): RoutingLogEntry[] {
  return routingLog.slice(-limit);
}
