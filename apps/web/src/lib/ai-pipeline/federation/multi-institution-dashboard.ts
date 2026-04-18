/**
 * @module multi-institution-dashboard
 * @description 연합 최상위 대시보드
 *
 * 연합 전체의 상태를 한눈에 파악할 수 있는 대시보드 데이터와
 * 보고서 생성, 알림 피드 기능을 제공한다.
 */

import type { MaturityGrade } from './institutional-maturity-index';

/** 최근 활동 항목 */
export interface RecentAction {
  /** 활동 유형 */
  type: string;
  /** 관련 기관 ID */
  institutionId: string;
  /** 활동 설명 */
  description: string;
  /** 활동 일시 */
  timestamp: Date;
}

/** 알림 */
export interface FederationAlert {
  /** 알림 ID */
  id: string;
  /** 심각도 */
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  /** 알림 제목 */
  title: string;
  /** 알림 내용 */
  message: string;
  /** 관련 기관 ID (선택) */
  institutionId: string | null;
  /** 생성 일시 */
  createdAt: Date;
  /** 확인 여부 */
  acknowledged: boolean;
}

/** 커먼즈 건강 지표 */
export interface CommonsHealth {
  /** 전체 자산 수 */
  totalAssets: number;
  /** 부채 점수 */
  debtScore: number;
  /** 기여 균형 (0–100, 100이 가장 균형적) */
  contributionBalance: number;
}

/** 연합 대시보드 데이터 */
export interface FederationDashboardData {
  /** 전체 기관 수 */
  memberCount: number;
  /** 활성 기관 수 */
  activeMembers: number;
  /** 정지 기관 수 */
  suspendedMembers: number;
  /** 성숙도 등급 분포 */
  maturityDistribution: Record<MaturityGrade, number>;
  /** 커먼즈 건강 지표 */
  commonsHealth: CommonsHealth;
  /** 회복력 점수 */
  resilienceScore: number;
  /** 미해결 충돌 건수 */
  pendingConflicts: number;
  /** 미결 안건 수 */
  pendingDecisions: number;
  /** 최근 활동 */
  recentActions: RecentAction[];
  /** 알림 목록 */
  alerts: FederationAlert[];
}

/** 연합 보고서 */
export interface FederationReport {
  /** 보고서 ID */
  reportId: string;
  /** 보고서 제목 */
  title: string;
  /** 생성 일시 */
  generatedAt: Date;
  /** 대시보드 스냅샷 */
  snapshot: FederationDashboardData;
  /** 요약 */
  summary: string;
  /** 권고 사항 */
  recommendations: string[];
}

// ── 인메모리 저장소 ──
const recentActions: RecentAction[] = [];
const alerts: FederationAlert[] = [];
const reports: FederationReport[] = [];

/**
 * 연합 대시보드 데이터를 조합하여 반환한다.
 *
 * @param params 대시보드 구성 데이터
 * @returns 대시보드 데이터
 */
export function getFederationDashboard(params: {
  memberCount: number;
  activeMembers: number;
  suspendedMembers: number;
  maturityDistribution: Record<MaturityGrade, number>;
  commonsHealth: CommonsHealth;
  resilienceScore: number;
  pendingConflicts: number;
  pendingDecisions: number;
}): FederationDashboardData {
  return {
    memberCount: params.memberCount,
    activeMembers: params.activeMembers,
    suspendedMembers: params.suspendedMembers,
    maturityDistribution: { ...params.maturityDistribution },
    commonsHealth: { ...params.commonsHealth },
    resilienceScore: params.resilienceScore,
    pendingConflicts: params.pendingConflicts,
    pendingDecisions: params.pendingDecisions,
    recentActions: recentActions.slice(-20).map((a) => ({ ...a })),
    alerts: alerts.filter((a) => !a.acknowledged).map((a) => ({ ...a })),
  };
}

/**
 * 연합 보고서를 생성한다.
 *
 * @param dashboard 현재 대시보드 데이터
 * @returns 생성된 보고서
 */
export function generateFederationReport(
  dashboard: FederationDashboardData,
): FederationReport {
  const recommendations: string[] = [];

  if (dashboard.suspendedMembers > 0) {
    recommendations.push(
      `정지 기관 ${dashboard.suspendedMembers}곳에 대한 복원 또는 제명 절차 검토 필요`,
    );
  }

  if (dashboard.commonsHealth.debtScore > 20) {
    recommendations.push(
      `커먼즈 부채 점수 ${dashboard.commonsHealth.debtScore}점 — 부채 해소 프로그램 시행 권고`,
    );
  }

  if (dashboard.resilienceScore < 60) {
    recommendations.push(
      `회복력 점수 ${dashboard.resilienceScore}점 — 회복력 강화 조치 필요`,
    );
  }

  if (dashboard.pendingConflicts > 0) {
    recommendations.push(
      `미해결 충돌 ${dashboard.pendingConflicts}건 — 우선 처리 필요`,
    );
  }

  const summary = [
    `연합 기관 ${dashboard.memberCount}곳 (활성 ${dashboard.activeMembers}, 정지 ${dashboard.suspendedMembers})`,
    `회복력 점수: ${dashboard.resilienceScore}`,
    `커먼즈 자산: ${dashboard.commonsHealth.totalAssets}건, 부채 점수: ${dashboard.commonsHealth.debtScore}`,
    `미해결 충돌: ${dashboard.pendingConflicts}건, 미결 안건: ${dashboard.pendingDecisions}건`,
  ].join(' | ');

  const report: FederationReport = {
    reportId: `RPT_${Date.now()}`,
    title: `연합 현황 보고서 — ${new Date().toISOString().slice(0, 10)}`,
    generatedAt: new Date(),
    snapshot: { ...dashboard },
    summary,
    recommendations,
  };

  reports.push(report);
  return { ...report, recommendations: [...report.recommendations] };
}

/**
 * 알림 피드를 반환한다.
 *
 * @param includeAcknowledged 확인된 알림 포함 여부
 */
export function getAlertFeed(includeAcknowledged: boolean = false): FederationAlert[] {
  const filtered = includeAcknowledged
    ? alerts
    : alerts.filter((a) => !a.acknowledged);
  return filtered.map((a) => ({ ...a }));
}

/**
 * 알림을 추가한다.
 *
 * @param alert 알림 데이터
 */
export function addAlert(alert: Omit<FederationAlert, 'createdAt' | 'acknowledged'>): FederationAlert {
  const newAlert: FederationAlert = {
    ...alert,
    createdAt: new Date(),
    acknowledged: false,
  };
  alerts.push(newAlert);
  return { ...newAlert };
}

/**
 * 알림을 확인 처리한다.
 *
 * @param alertId 알림 ID
 */
export function acknowledgeAlert(alertId: string): boolean {
  const alert = alerts.find((a) => a.id === alertId);
  if (!alert) return false;
  alert.acknowledged = true;
  return true;
}

/**
 * 최근 활동을 기록한다.
 *
 * @param action 활동 데이터
 */
export function recordAction(action: Omit<RecentAction, 'timestamp'>): void {
  recentActions.push({
    ...action,
    timestamp: new Date(),
  });
}
