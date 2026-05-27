/**
 * policy-drift-monitoring.ts
 * 정책 변경 후 효과를 모니터링하고, 드리프트(성능 이탈)를 감지한다.
 * FALSE_SAFE_EMERGENCE 감지 시 이전 정책 버전으로 즉시 자동 롤백.
 */

// ──────────────────────────────────────────────
// 타입 정의
// ──────────────────────────────────────────────

/** 드리프트 유형 */
export type PolicyDriftType =
  | "COST_INCREASE"         // 비용 증가
  | "QUALITY_DECREASE"      // 품질 저하
  | "FALSE_SAFE_EMERGENCE"  // 위양성 안전 발생 → 즉시 롤백
  | "CONFLICT_INCREASE";    // 충돌 증가

/** 심각도 */
export type DriftSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/** 정책 드리프트 알림 */
export interface PolicyDriftAlert {
  alertId: string;
  policyId: string;
  policyVersion: number;
  driftType: PolicyDriftType;
  severity: DriftSeverity;
  detectedAt: Date;
  metric: string;           // 감지에 사용된 메트릭 이름
  expected: number;          // 기대값
  actual: number;            // 실측값
  autoRevert: boolean;       // TRUE_SAFE_EMERGENCE → true
}

/** 정책 메트릭 스냅샷 (모니터링 입력) */
export interface PolicyMetrics {
  policyId: string;
  policyVersion: number;
  costPerDoc: number;
  accuracyRate: number;
  falseSafeRate: number;
  conflictRate: number;
}

/** 정책 기준선 (기대값) */
export interface PolicyBaseline {
  costPerDoc: number;
  accuracyRate: number;
  falseSafeRate: number;
  conflictRate: number;
}

// ──────────────────────────────────────────────
// 상수 — 드리프트 감지 임계값
// ──────────────────────────────────────────────

/** 비용 증가 임계값 (10%) */
const COST_INCREASE_THRESHOLD = 0.10;
/** 정확도 저하 임계값 (5%) */
const QUALITY_DECREASE_THRESHOLD = 0.05;
/** 위양성 발생 임계값 (0 초과 시 즉시 감지) */
const FALSE_SAFE_THRESHOLD = 0.0;
/** 충돌 증가 임계값 (15%) */
const CONFLICT_INCREASE_THRESHOLD = 0.15;

// ──────────────────────────────────────────────
// 인메모리 저장소 (production: DB-backed)
// ──────────────────────────────────────────────
const alertStore: PolicyDriftAlert[] = [];

/** 정책별 기준선 (production: DB-backed) */
const baselineStore: Map<string, PolicyBaseline> = new Map();

// ──────────────────────────────────────────────
// 유틸리티
// ──────────────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 드리프트 유형에 따른 심각도 결정
 */
function determineSeverity(
  driftType: PolicyDriftType,
  deviationRatio: number
): DriftSeverity {
  // 위양성 발생 → 항상 CRITICAL
  if (driftType === "FALSE_SAFE_EMERGENCE") return "CRITICAL";

  if (deviationRatio > 0.3) return "HIGH";
  if (deviationRatio > 0.15) return "MEDIUM";
  return "LOW";
}

/**
 * 이전 정책 버전으로 자동 롤백 (스켈레톤)
 * TODO: 실제 구현 시 정책 저장소에서 이전 버전 복원
 */
function revertToPreviousVersion(policyId: string, policyVersion: number): void {
  console.warn(
    `[policy-drift-monitoring] 정책 자동 롤백 실행: ` +
    `policyId=${policyId}, version=${policyVersion} → version=${policyVersion - 1}`
  );
  // TODO: 실제 정책 저장소 롤백 로직
}

// ──────────────────────────────────────────────
// 핵심 함수
// ──────────────────────────────────────────────

/**
 * 정책 기준선 등록
 */
export function registerBaseline(
  policyId: string,
  baseline: PolicyBaseline
): void {
  baselineStore.set(policyId, baseline);
}

/**
 * 정책 드리프트 모니터링 실행
 * 현재 메트릭을 기준선과 비교하여 드리프트 알림을 생성한다.
 * RULE: FALSE_SAFE_EMERGENCE 감지 시 즉시 이전 버전으로 롤백 (autoRevert=true)
 */
export function monitorPolicyDrift(
  metrics: PolicyMetrics
): PolicyDriftAlert[] {
  const baseline = baselineStore.get(metrics.policyId);
  if (!baseline) {
    console.warn(
      `[policy-drift-monitoring] 기준선 미등록: ${metrics.policyId}, 모니터링 건너뜀`
    );
    return [];
  }

  const alerts: PolicyDriftAlert[] = [];

  // ── 비용 증가 감지 ──
  if (baseline.costPerDoc > 0) {
    const costDeviation =
      (metrics.costPerDoc - baseline.costPerDoc) / baseline.costPerDoc;
    if (costDeviation > COST_INCREASE_THRESHOLD) {
      alerts.push({
        alertId: generateId("drift"),
        policyId: metrics.policyId,
        policyVersion: metrics.policyVersion,
        driftType: "COST_INCREASE",
        severity: determineSeverity("COST_INCREASE", costDeviation),
        detectedAt: new Date(),
        metric: "costPerDoc",
        expected: baseline.costPerDoc,
        actual: metrics.costPerDoc,
        autoRevert: false,
      });
    }
  }

  // ── 품질 저하 감지 ──
  if (baseline.accuracyRate > 0) {
    const qualityDeviation =
      (baseline.accuracyRate - metrics.accuracyRate) / baseline.accuracyRate;
    if (qualityDeviation > QUALITY_DECREASE_THRESHOLD) {
      alerts.push({
        alertId: generateId("drift"),
        policyId: metrics.policyId,
        policyVersion: metrics.policyVersion,
        driftType: "QUALITY_DECREASE",
        severity: determineSeverity("QUALITY_DECREASE", qualityDeviation),
        detectedAt: new Date(),
        metric: "accuracyRate",
        expected: baseline.accuracyRate,
        actual: metrics.accuracyRate,
        autoRevert: false,
      });
    }
  }

  // ── 위양성 안전 발생 감지 → 즉시 롤백 ──
  if (metrics.falseSafeRate > FALSE_SAFE_THRESHOLD) {
    const alert: PolicyDriftAlert = {
      alertId: generateId("drift"),
      policyId: metrics.policyId,
      policyVersion: metrics.policyVersion,
      driftType: "FALSE_SAFE_EMERGENCE",
      severity: "CRITICAL",
      detectedAt: new Date(),
      metric: "falseSafeRate",
      expected: 0,
      actual: metrics.falseSafeRate,
      autoRevert: true,
    };
    alerts.push(alert);

    // RULE: FALSE_SAFE_EMERGENCE → 이전 정책 버전으로 즉시 롤백
    revertToPreviousVersion(metrics.policyId, metrics.policyVersion);
  }

  // ── 충돌 증가 감지 ──
  if (baseline.conflictRate > 0) {
    const conflictDeviation =
      (metrics.conflictRate - baseline.conflictRate) / baseline.conflictRate;
    if (conflictDeviation > CONFLICT_INCREASE_THRESHOLD) {
      alerts.push({
        alertId: generateId("drift"),
        policyId: metrics.policyId,
        policyVersion: metrics.policyVersion,
        driftType: "CONFLICT_INCREASE",
        severity: determineSeverity("CONFLICT_INCREASE", conflictDeviation),
        detectedAt: new Date(),
        metric: "conflictRate",
        expected: baseline.conflictRate,
        actual: metrics.conflictRate,
        autoRevert: false,
      });
    }
  }

  // 알림 저장
  alertStore.push(...alerts);

  return alerts;
}

/**
 * 특정 정책의 드리프트 알림 이력 조회
 */
export function getPolicyDriftHistory(policyId: string): PolicyDriftAlert[] {
  return alertStore.filter((a) => a.policyId === policyId);
}

/**
 * 전체 드리프트 알림 이력 조회
 */
export function getAllDriftAlerts(): PolicyDriftAlert[] {
  return [...alertStore];
}
