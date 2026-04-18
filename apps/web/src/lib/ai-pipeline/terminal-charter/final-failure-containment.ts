/**
 * @module final-failure-containment
 * @description 최종 장애 격리 — 시스템 장애 시 위협 수준을 평가하고
 * 단계적 격리(NORMAL → ELEVATED → CRITICAL → TERMINAL_CONTAINMENT)를 수행한다.
 * 최종 단계에서는 재창설 발동 또는 인간 인수를 트리거한다.
 */

/** 격리 수준 */
export type ContainmentLevel =
  | "NORMAL"
  | "ELEVATED"
  | "CRITICAL"
  | "TERMINAL_CONTAINMENT";

/** 격리 조치 */
export type ContainmentAction =
  | "ISOLATE_SUBSYSTEM"
  | "FREEZE_ALL_CHANGES"
  | "ACTIVATE_REFOUNDATION"
  | "HUMAN_TAKEOVER";

/** 격리 이벤트 */
export interface ContainmentEvent {
  /** 이벤트 고유 ID */
  id: string;
  /** 격리 수준 */
  level: ContainmentLevel;
  /** 수행된 조치 */
  action: ContainmentAction;
  /** 트리거 원인 */
  triggeredBy: string;
  /** 트리거 일시 */
  triggeredAt: Date;
  /** 해소 일시 */
  resolvedAt: Date | null;
}

/** 위협 평가 결과 */
export interface ThreatAssessment {
  /** 현재 위협 수준 */
  level: ContainmentLevel;
  /** 권장 조치 */
  recommendedAction: ContainmentAction;
  /** 위협 설명 */
  description: string;
  /** 위협 점수 (0~100) */
  score: number;
}

/** 인메모리 격리 이벤트 로그 */
const containmentLog: ContainmentEvent[] = [];

/** 현재 격리 수준 */
let currentLevel: ContainmentLevel = "NORMAL";

/**
 * 위협을 평가한다.
 * @param factors - 위협 요소 배열 (설명 문자열)
 * @param severity - 심각도 점수 (0~100)
 * @returns 위협 평가 결과
 */
export function evaluateThreat(
  factors: string[],
  severity: number
): ThreatAssessment {
  let level: ContainmentLevel;
  let recommendedAction: ContainmentAction;

  if (severity >= 90) {
    level = "TERMINAL_CONTAINMENT";
    recommendedAction = "HUMAN_TAKEOVER";
  } else if (severity >= 70) {
    level = "CRITICAL";
    recommendedAction = "ACTIVATE_REFOUNDATION";
  } else if (severity >= 40) {
    level = "ELEVATED";
    recommendedAction = "FREEZE_ALL_CHANGES";
  } else {
    level = "NORMAL";
    recommendedAction = "ISOLATE_SUBSYSTEM";
  }

  return {
    level,
    recommendedAction,
    description: factors.join("; "),
    score: severity,
  };
}

/**
 * 격리를 트리거한다.
 * @param level - 격리 수준
 * @param action - 수행할 조치
 * @param triggeredBy - 트리거 원인
 * @returns 생성된 격리 이벤트
 */
export function triggerContainment(
  level: ContainmentLevel,
  action: ContainmentAction,
  triggeredBy: string
): ContainmentEvent {
  const event: ContainmentEvent = {
    id: `CONTAIN-${Date.now()}-${containmentLog.length}`,
    level,
    action,
    triggeredBy,
    triggeredAt: new Date(),
    resolvedAt: null,
  };

  containmentLog.push(event);
  currentLevel = level;
  return { ...event };
}

/**
 * 격리를 에스컬레이션한다. 현재 수준보다 높은 수준으로만 가능.
 * @param newLevel - 새 격리 수준
 * @param triggeredBy - 에스컬레이션 원인
 * @returns 에스컬레이션 결과 { escalated, event, error }
 */
export function escalateContainment(
  newLevel: ContainmentLevel,
  triggeredBy: string
): { escalated: boolean; event: ContainmentEvent | null; error: string | null } {
  const levelOrder: ContainmentLevel[] = [
    "NORMAL",
    "ELEVATED",
    "CRITICAL",
    "TERMINAL_CONTAINMENT",
  ];

  const currentIdx = levelOrder.indexOf(currentLevel);
  const newIdx = levelOrder.indexOf(newLevel);

  if (newIdx <= currentIdx) {
    return {
      escalated: false,
      event: null,
      error: `현재 수준(${currentLevel})보다 높은 수준으로만 에스컬레이션 가능`,
    };
  }

  const actionMap: Record<ContainmentLevel, ContainmentAction> = {
    NORMAL: "ISOLATE_SUBSYSTEM",
    ELEVATED: "FREEZE_ALL_CHANGES",
    CRITICAL: "ACTIVATE_REFOUNDATION",
    TERMINAL_CONTAINMENT: "HUMAN_TAKEOVER",
  };

  const event = triggerContainment(
    newLevel,
    actionMap[newLevel],
    triggeredBy
  );

  return { escalated: true, event, error: null };
}

/**
 * 격리 이벤트를 해소 처리한다.
 * @param eventId - 해소할 이벤트 ID
 * @returns 해소 성공 여부
 */
export function resolveContainment(eventId: string): boolean {
  const event = containmentLog.find((e) => e.id === eventId);
  if (!event || event.resolvedAt) return false;

  event.resolvedAt = new Date();

  // 미해소 이벤트 중 최고 수준으로 현재 수준 재설정
  const unresolved = containmentLog.filter((e) => !e.resolvedAt);
  if (unresolved.length === 0) {
    currentLevel = "NORMAL";
  } else {
    const levelOrder: ContainmentLevel[] = [
      "NORMAL",
      "ELEVATED",
      "CRITICAL",
      "TERMINAL_CONTAINMENT",
    ];
    let maxIdx = 0;
    for (const e of unresolved) {
      const idx = levelOrder.indexOf(e.level);
      if (idx > maxIdx) maxIdx = idx;
    }
    currentLevel = levelOrder[maxIdx];
  }

  return true;
}

/**
 * 격리 이벤트 로그를 반환한다.
 * @returns 격리 이벤트 배열
 */
export function getContainmentLog(): ContainmentEvent[] {
  return [...containmentLog];
}

/**
 * 현재 격리 수준을 반환한다.
 * @returns 현재 격리 수준
 */
export function getCurrentContainmentLevel(): ContainmentLevel {
  return currentLevel;
}
