/**
 * @module control-drift-monitor
 * @description 통제 드리프트 모니터 — 통제 항목의 설정 변경, 커버리지 갭, 테스트 기한 초과 등 드리프트를 탐지하고 추적하는 엔진
 */

/** 드리프트 유형 */
export type DriftType = 'CONFIG_CHANGE' | 'COVERAGE_GAP' | 'TEST_OVERDUE' | 'EVIDENCE_STALE' | 'OWNER_CHANGE';

/** 드리프트 심각도 */
export type DriftSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/** 드리프트 알림 */
export interface DriftAlert {
  /** 알림 ID */
  id: string;
  /** 통제 ID */
  controlId: string;
  /** 드리프트 유형 */
  driftType: DriftType;
  /** 심각도 */
  severity: DriftSeverity;
  /** 탐지 일시 */
  detectedAt: Date;
  /** 해결 일시 */
  resolvedAt: Date | null;
  /** 자동 해결 여부 */
  autoResolved: boolean;
  /** 상세 설명 */
  description: string;
}

/** 드리프트 추세 데이터 포인트 */
export interface DriftTrendPoint {
  /** 기간 */
  period: string;
  /** 신규 드리프트 수 */
  newAlerts: number;
  /** 해결된 드리프트 수 */
  resolvedAlerts: number;
  /** 미해결 드리프트 수 */
  openAlerts: number;
}

/** 인메모리 드리프트 알림 저장소 */
const driftStore: DriftAlert[] = [];

/**
 * 드리프트 스캔을 수행한다 (외부에서 드리프트 정보를 전달받아 알림을 생성).
 * @param alerts 탐지된 드리프트 알림 목록
 * @returns 생성된 드리프트 알림 배열
 */
export function scanForDrift(alerts: Omit<DriftAlert, 'detectedAt' | 'resolvedAt' | 'autoResolved'>[]): DriftAlert[] {
  const created: DriftAlert[] = [];
  for (const alert of alerts) {
    const driftAlert: DriftAlert = {
      ...alert,
      detectedAt: new Date(),
      resolvedAt: null,
      autoResolved: false,
    };
    driftStore.push(driftAlert);
    created.push(driftAlert);
  }
  return created;
}

/**
 * 현재 드리프트 알림 목록을 반환한다.
 * @param unresolvedOnly 미해결 건만 반환 여부 (기본: false)
 * @returns 드리프트 알림 배열
 */
export function getDriftAlerts(unresolvedOnly: boolean = false): DriftAlert[] {
  if (unresolvedOnly) {
    return driftStore.filter((d) => d.resolvedAt === null);
  }
  return [...driftStore];
}

/**
 * 드리프트를 해결 처리한다.
 * @param alertId 알림 ID
 * @param autoResolved 자동 해결 여부
 * @returns 갱신된 드리프트 알림 또는 null
 */
export function resolveDrift(alertId: string, autoResolved: boolean = false): DriftAlert | null {
  const alert = driftStore.find((d) => d.id === alertId);
  if (!alert) return null;

  alert.resolvedAt = new Date();
  alert.autoResolved = autoResolved;
  return alert;
}

/**
 * 드리프트 추세 데이터를 반환한다.
 * @param periodDays 집계 기간 단위 (일, 기본: 7)
 * @param periods 기간 수 (기본: 4)
 * @returns 드리프트 추세 배열
 */
export function getDriftTrend(periodDays: number = 7, periods: number = 4): DriftTrendPoint[] {
  const now = new Date();
  const trend: DriftTrendPoint[] = [];

  for (let i = periods - 1; i >= 0; i--) {
    const periodEnd = new Date(now.getTime() - i * periodDays * 86400000);
    const periodStart = new Date(periodEnd.getTime() - periodDays * 86400000);
    const label = `${periodStart.toISOString().slice(0, 10)}~${periodEnd.toISOString().slice(0, 10)}`;

    const newAlerts = driftStore.filter(
      (d) => d.detectedAt >= periodStart && d.detectedAt < periodEnd
    ).length;
    const resolvedAlerts = driftStore.filter(
      (d) => d.resolvedAt && d.resolvedAt >= periodStart && d.resolvedAt < periodEnd
    ).length;
    const openAlerts = driftStore.filter(
      (d) => d.detectedAt < periodEnd && (d.resolvedAt === null || d.resolvedAt >= periodEnd)
    ).length;

    trend.push({ period: label, newAlerts, resolvedAlerts, openAlerts });
  }

  return trend;
}
