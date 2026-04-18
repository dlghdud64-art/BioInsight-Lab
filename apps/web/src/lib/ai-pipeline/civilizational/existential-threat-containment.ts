/**
 * 실존적 위협 격리 (Existential Threat Containment)
 *
 * 시스템 전복·적대적 공격·치명적 오류·신뢰 붕괴·규제 위기 등
 * 실존적 위협을 탐지·평가하고 격리 조치를 수행합니다.
 */

/** 위협 범주 */
export type ThreatCategory =
  | "SYSTEMIC_FAILURE"
  | "ADVERSARIAL_ATTACK"
  | "CATASTROPHIC_ERROR"
  | "TRUST_COLLAPSE"
  | "REGULATORY_CRISIS";

/** 격리 조치 */
export type ContainmentAction =
  | "ISOLATE"
  | "DEGRADE"
  | "SHUTDOWN"
  | "FAILSAFE"
  | "ESCALATE_HUMAN";

/** 위협 평가 */
export interface ThreatAssessment {
  id: string;
  category: ThreatCategory;
  /** 심각도 (0–10) */
  severity: number;
  /** 발생 확률 (0–1) */
  probability: number;
  /** 권장 격리 조치 */
  containmentAction: ContainmentAction;
  /** 위협 설명 */
  description: string;
  assessedAt: Date;
  /** 격리 수행 시각 (null이면 미수행) */
  containedAt: Date | null;
  /** 격리 효과 점수 (0–1, null이면 미평가) */
  effectiveness: number | null;
}

/** 사후 보고서 */
export interface PostIncidentReport {
  threatId: string;
  category: ThreatCategory;
  severity: number;
  containmentAction: ContainmentAction;
  responseTimeMs: number | null;
  effectiveness: number | null;
  lessonsLearned: string;
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------
const threats: ThreatAssessment[] = [];

let nextId = 1;
function genId(): string {
  return `th-${Date.now()}-${nextId++}`;
}

/** 심각도·확률 기반 격리 조치 결정 */
function determineAction(
  severity: number,
  probability: number
): ContainmentAction {
  const risk = severity * probability;
  if (risk >= 8) return "SHUTDOWN";
  if (risk >= 6) return "FAILSAFE";
  if (risk >= 4) return "ISOLATE";
  if (risk >= 2) return "DEGRADE";
  return "ESCALATE_HUMAN";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * 위협을 평가합니다.
 * @param category 위협 범주
 * @param severity 심각도 (0–10)
 * @param probability 발생 확률 (0–1)
 * @param description 위협 설명
 */
export function assessThreat(
  category: ThreatCategory,
  severity: number,
  probability: number,
  description: string
): ThreatAssessment {
  const clamped = {
    severity: Math.max(0, Math.min(10, severity)),
    probability: Math.max(0, Math.min(1, probability)),
  };

  const assessment: ThreatAssessment = {
    id: genId(),
    category,
    severity: clamped.severity,
    probability: clamped.probability,
    containmentAction: determineAction(clamped.severity, clamped.probability),
    description,
    assessedAt: new Date(),
    containedAt: null,
    effectiveness: null,
  };
  threats.push(assessment);
  return assessment;
}

/**
 * 위협에 대한 격리를 수행합니다.
 * @param threatId 위협 ID
 * @param overrideAction 격리 조치 오버라이드 (선택)
 */
export function triggerContainment(
  threatId: string,
  overrideAction?: ContainmentAction
): { success: boolean; threat: ThreatAssessment | null; message: string } {
  const threat = threats.find((t) => t.id === threatId);
  if (!threat) {
    return { success: false, threat: null, message: "위협을 찾을 수 없습니다." };
  }
  if (threat.containedAt) {
    return { success: false, threat, message: "이미 격리가 수행되었습니다." };
  }

  if (overrideAction) {
    threat.containmentAction = overrideAction;
  }
  threat.containedAt = new Date();

  return {
    success: true,
    threat,
    message: `격리 조치 "${threat.containmentAction}" 수행 완료.`,
  };
}

/**
 * 격리 효과를 평가합니다.
 * @param threatId 위협 ID
 * @param effectiveness 효과 점수 (0–1)
 */
export function evaluateContainmentEffectiveness(
  threatId: string,
  effectiveness: number
): { success: boolean; message: string } {
  const threat = threats.find((t) => t.id === threatId);
  if (!threat) return { success: false, message: "위협을 찾을 수 없습니다." };
  if (!threat.containedAt) {
    return { success: false, message: "격리가 수행되지 않았습니다." };
  }

  threat.effectiveness = Math.max(0, Math.min(1, effectiveness));
  return {
    success: true,
    message: `격리 효과 ${Math.round(threat.effectiveness * 100)}%로 기록되었습니다.`,
  };
}

/**
 * 사후 보고서를 생성합니다.
 * @param threatId 위협 ID
 */
export function getPostIncidentReport(
  threatId: string
): PostIncidentReport | null {
  const threat = threats.find((t) => t.id === threatId);
  if (!threat) return null;

  const responseTimeMs =
    threat.containedAt && threat.assessedAt
      ? threat.containedAt.getTime() - threat.assessedAt.getTime()
      : null;

  let lessonsLearned: string;
  if (threat.effectiveness === null) {
    lessonsLearned = "격리 효과 미평가 — 효과 분석이 필요합니다.";
  } else if (threat.effectiveness >= 0.8) {
    lessonsLearned = "격리 조치가 효과적이었습니다. 현행 프로토콜을 유지하십시오.";
  } else if (threat.effectiveness >= 0.5) {
    lessonsLearned = "부분적 효과. 격리 절차 개선이 필요합니다.";
  } else {
    lessonsLearned = "격리 효과가 낮습니다. 프로토콜 전면 재검토가 필요합니다.";
  }

  return {
    threatId: threat.id,
    category: threat.category,
    severity: threat.severity,
    containmentAction: threat.containmentAction,
    responseTimeMs,
    effectiveness: threat.effectiveness,
    lessonsLearned,
  };
}
