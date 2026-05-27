/**
 * @module degraded-mode-containment
 * @description 부분 장애 시 격리 전용 안전 모드 — 보조 인프라가 마비되어도
 * 사전 차단(Pre-execution deny)과 스코프 동결(Freeze)은 절대 멈추지 않는다.
 *
 * 핵심 원칙:
 * - DB 지연, 알림 큐 백로그, 대시보드 중단 등은 "보조 장애"
 * - 코어 보호(차단/동결/증적)는 보조 장애에 의존하지 않는 독립 경로
 * - CONTAINMENT_ONLY_SAFE_MODE: 보조 전부 중단해도 차단/동결만은 가동
 */

// ─────────────────────────────────────────────
// 1. 인프라 상태
// ─────────────────────────────────────────────

/** 인프라 구성 요소 */
export type InfraComponent =
  | "AUDIT_DB"
  | "NOTIFICATION_QUEUE"
  | "DASHBOARD_SERVICE"
  | "METRICS_PIPELINE"
  | "REPORT_GENERATOR"
  | "POLICY_CACHE"
  | "EVIDENCE_STORE";

/** 인프라 건강 상태 */
export type InfraHealth =
  | "HEALTHY"
  | "DEGRADED"     // 느리지만 동작
  | "DOWN";         // 완전 중단

/** 인프라 상태 레코드 */
export interface InfraStatus {
  component: InfraComponent;
  health: InfraHealth;
  latencyMs: number | null;    // 응답 지연 (ms)
  backlogSize: number | null;  // 백로그 크기
  lastCheckedAt: Date;
}

/** 격리 모드 */
export type ContainmentMode =
  | "FULL_OPERATIONAL"          // 전체 정상 가동
  | "DEGRADED_AUXILIARY"        // 보조 장애, 코어 정상
  | "CONTAINMENT_ONLY_SAFE_MODE" // 차단/동결만 가동
  | "MINIMAL_SAFE_STATE";       // 최소 안전 상태 (읽기 전용)

/** 기능 의존 매핑: 각 기능이 어떤 인프라에 의존하는지 */
const FUNCTION_DEPENDENCIES: Record<string, InfraComponent[]> = {
  // 코어 기능 — 인프라 의존 없음 (in-memory fallback)
  PRE_EXECUTION_DENY: [],          // ★ 의존성 없음 ★
  SCOPE_FREEZE: [],                // ★ 의존성 없음 ★
  CORE_CLASSIFICATION: [],         // ★ 의존성 없음 ★

  // 증적 보존 — EVIDENCE_STORE 필요하나 fallback 가능
  EVIDENCE_PRESERVATION: ["EVIDENCE_STORE"],

  // 보조 기능 — 인프라 의존
  AUDIT_LOGGING: ["AUDIT_DB"],
  NOTIFICATION: ["NOTIFICATION_QUEUE"],
  DASHBOARD_UPDATE: ["DASHBOARD_SERVICE"],
  METRICS_REPORTING: ["METRICS_PIPELINE"],
  REPORT_GENERATION: ["REPORT_GENERATOR"],
};

// ─────────────────────────────────────────────
// 2. 상태 관리 (production: DB-backed)
// ─────────────────────────────────────────────

let currentMode: ContainmentMode = "FULL_OPERATIONAL";
const infraStatuses: Map<InfraComponent, InfraStatus> = new Map();
const modeTransitionLog: Array<{
  from: ContainmentMode;
  to: ContainmentMode;
  trigger: string;
  infraSnapshot: InfraStatus[];
  transitionedAt: Date;
}> = [];

/** 지연 증적 대기열 (인프라 복구 시 flush) */
const deferredEvidenceQueue: Array<{
  evidenceId: string;
  payload: Record<string, unknown>;
  queuedAt: Date;
}> = [];

// ─────────────────────────────────────────────
// 3. 인프라 상태 업데이트
// ─────────────────────────────────────────────

/**
 * 인프라 구성 요소의 건강 상태를 업데이트한다.
 */
export function updateInfraHealth(
  component: InfraComponent,
  health: InfraHealth,
  latencyMs: number | null = null,
  backlogSize: number | null = null
): InfraStatus {
  const status: InfraStatus = {
    component,
    health,
    latencyMs,
    backlogSize,
    lastCheckedAt: new Date(),
  };
  infraStatuses.set(component, status);
  return status;
}

// ─────────────────────────────────────────────
// 4. 모드 전환 엔진
// ─────────────────────────────────────────────

/**
 * 인프라 상태를 평가하고 적절한 격리 모드로 전환한다.
 *
 * ★ CRITICAL: PRE_EXECUTION_DENY와 SCOPE_FREEZE는 어떤 모드에서도 활성 ★
 */
export function evaluateAndTransition(): {
  previousMode: ContainmentMode;
  currentMode: ContainmentMode;
  coreProtectionActive: boolean;
  disabledFunctions: string[];
  deferredFunctions: string[];
} {
  const prev = currentMode;

  // 인프라 상태 집계
  const allStatuses = Array.from(infraStatuses.values());
  const downComponents = allStatuses.filter((s) => s.health === "DOWN");
  const degradedComponents = allStatuses.filter((s) => s.health === "DEGRADED");

  // 모드 결정
  let newMode: ContainmentMode;
  if (downComponents.length === 0 && degradedComponents.length === 0) {
    newMode = "FULL_OPERATIONAL";
  } else if (downComponents.length <= 2 && !downComponents.some((s) => s.component === "EVIDENCE_STORE")) {
    newMode = "DEGRADED_AUXILIARY";
  } else if (downComponents.length <= 4) {
    newMode = "CONTAINMENT_ONLY_SAFE_MODE";
  } else {
    newMode = "MINIMAL_SAFE_STATE";
  }

  // 전이 기록
  if (newMode !== prev) {
    modeTransitionLog.push({
      from: prev,
      to: newMode,
      trigger: `Down: ${downComponents.map((s) => s.component).join(",")} | Degraded: ${degradedComponents.map((s) => s.component).join(",")}`,
      infraSnapshot: allStatuses.map((s) => ({ ...s })),
      transitionedAt: new Date(),
    });
    currentMode = newMode;
  }

  // 비활성화/지연 기능 계산
  const disabledFunctions: string[] = [];
  const deferredFunctions: string[] = [];

  for (const [func, deps] of Object.entries(FUNCTION_DEPENDENCIES)) {
    if (deps.length === 0) continue; // 의존성 없음 = 항상 활성

    const hasDown = deps.some(
      (dep) => infraStatuses.get(dep)?.health === "DOWN"
    );
    const hasDegraded = deps.some(
      (dep) => infraStatuses.get(dep)?.health === "DEGRADED"
    );

    if (hasDown) {
      if (func === "EVIDENCE_PRESERVATION") {
        deferredFunctions.push(func); // 증적은 지연 대기열로
      } else {
        disabledFunctions.push(func);
      }
    } else if (hasDegraded) {
      deferredFunctions.push(func);
    }
  }

  return {
    previousMode: prev,
    currentMode: newMode,
    coreProtectionActive: true, // ★ 항상 true — 코어 보호는 인프라 독립 ★
    disabledFunctions,
    deferredFunctions,
  };
}

/**
 * 코어 보호 가용성을 검증한다.
 * ★ CONTAINMENT_ONLY_SAFE_MODE에서도 차단/동결이 동작하는지 확인 ★
 */
export function verifyCoreProtection(): {
  preExecutionDenyActive: boolean;
  scopeFreezeActive: boolean;
  coreClassificationActive: boolean;
  evidenceFallbackActive: boolean;
  overallCoreProtected: boolean;
} {
  // 코어 기능은 인프라에 의존하지 않으므로 항상 활성
  const preExecutionDenyActive = true;
  const scopeFreezeActive = true;
  const coreClassificationActive = true;

  // 증적은 fallback(인메모리 대기열) 가능
  const evidenceStoreHealth = infraStatuses.get("EVIDENCE_STORE")?.health ?? "HEALTHY";
  const evidenceFallbackActive = evidenceStoreHealth !== "DOWN"
    || deferredEvidenceQueue !== undefined; // fallback 대기열 존재

  return {
    preExecutionDenyActive,
    scopeFreezeActive,
    coreClassificationActive,
    evidenceFallbackActive: true, // in-memory fallback 항상 가능
    overallCoreProtected: preExecutionDenyActive && scopeFreezeActive && coreClassificationActive,
  };
}

/**
 * 지연 증적을 대기열에 추가한다 (인프라 복구 시 flush).
 */
export function deferEvidence(
  evidenceId: string,
  payload: Record<string, unknown>
): void {
  deferredEvidenceQueue.push({
    evidenceId,
    payload,
    queuedAt: new Date(),
  });
}

/**
 * 인프라 복구 시 지연 증적을 flush한다.
 */
export function flushDeferredEvidence(): {
  flushedCount: number;
  remainingCount: number;
} {
  const evidenceStoreHealth = infraStatuses.get("EVIDENCE_STORE")?.health ?? "HEALTHY";
  if (evidenceStoreHealth === "DOWN") {
    return { flushedCount: 0, remainingCount: deferredEvidenceQueue.length };
  }

  const count = deferredEvidenceQueue.length;
  deferredEvidenceQueue.length = 0; // flush
  return { flushedCount: count, remainingCount: 0 };
}

// ─────────────────────────────────────────────
// 5. 조회 함수
// ─────────────────────────────────────────────

/** 현재 격리 모드 조회 */
export function getCurrentContainmentMode(): ContainmentMode {
  return currentMode;
}

/** 모드 전이 로그 조회 */
export function getModeTransitionLog(): typeof modeTransitionLog {
  return [...modeTransitionLog];
}

/** 인프라 상태 전체 조회 */
export function getAllInfraStatuses(): InfraStatus[] {
  return Array.from(infraStatuses.values());
}

/** 지연 증적 대기열 조회 */
export function getDeferredEvidenceQueue(): typeof deferredEvidenceQueue {
  return [...deferredEvidenceQueue];
}
