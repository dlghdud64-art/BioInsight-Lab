/**
 * 커먼즈 정당성 대시보드
 *
 * 포획 위험, 편익-부담 불균형, 미래 부채 추세, 형평성 점수,
 * 배분 공정성, 계류 분쟁, 세대 간 건강 등 전체 커먼즈 정당성 지표를
 * 통합 대시보드로 제공한다.
 */

import type { CaptureRiskStatus } from './anti-capture-guard';
import type { GenerationalHealth } from './generational-stewardship-engine';
import type { CorrectionAction } from './access-equity-monitor';
import type { ImbalanceAction } from './benefit-burden-balancer';

/** 위험 요소 */
export interface TopRisk {
  /** 위험 ID */
  id: string;
  /** 위험 범주 */
  category: string;
  /** 위험 설명 */
  description: string;
  /** 심각도 (1~10) */
  severity: number;
  /** 감지 시점 */
  detectedAt: string;
}

/** 경보 */
export interface DashboardAlert {
  /** 경보 ID */
  id: string;
  /** 경보 유형 */
  type: string;
  /** 경보 메시지 */
  message: string;
  /** 심각도 */
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  /** 발생 시점 */
  timestamp: string;
}

/** 편익-부담 불균형 요약 */
export interface ImbalanceSummary {
  participantId: string;
  imbalanceRatio: number;
  action: ImbalanceAction;
}

/** 정당성 대시보드 데이터 */
export interface LegitimacyDashboardData {
  /** 포획 위험 상태 */
  captureRiskStatus: CaptureRiskStatus;
  /** 편익-부담 불균형 목록 */
  benefitBurdenImbalances: ImbalanceSummary[];
  /** 미래 부채 추세 (최근 값) */
  futureDebtTrend: number;
  /** 형평성 점수 (0~1, 1이 완전 평등) */
  equityScore: number;
  /** 배분 공정성 점수 (0~1) */
  allocationFairness: number;
  /** 계류 중 분쟁 수 */
  pendingDisputes: number;
  /** 세대 간 건강 상태 */
  generationalHealth: GenerationalHealth;
  /** 주요 위험 요소 */
  topRisks: TopRisk[];
  /** 활성 경보 */
  alerts: DashboardAlert[];
  /** 최종 갱신 시점 */
  lastUpdatedAt: string;
}

/** 정당성 보고서 */
export interface LegitimacyReport {
  /** 보고서 ID */
  reportId: string;
  /** 대시보드 스냅샷 */
  snapshot: LegitimacyDashboardData;
  /** 요약 */
  summary: string;
  /** 권고 사항 */
  recommendations: string[];
  /** 생성 시점 */
  generatedAt: string;
}

/** 공익 검토 데이터 */
export interface PublicInterestReviewData {
  /** 검토 기간 */
  period: string;
  /** 공익 배분 건수 */
  publicInterestAllocations: number;
  /** 시민적 우선 라우팅 건수 */
  civicPriorityRoutings: number;
  /** 교정적 재배분 건수 */
  correctiveReallocations: number;
  /** 분쟁 해결 건수 */
  disputesResolved: number;
  /** 퇴출 건수 */
  evictions: number;
}

// ─── 인메모리 저장소 ───

let currentDashboard: LegitimacyDashboardData | null = null;
const reportHistory: LegitimacyReport[] = [];
let nextReportId = 1;

/**
 * 정당성 대시보드 데이터를 조회한다.
 * @param data 선택적 대시보드 데이터 (직접 주입 시)
 * @returns 현재 대시보드 데이터
 */
export function getLegitimacyDashboard(
  data?: Partial<LegitimacyDashboardData>
): LegitimacyDashboardData {
  if (data) {
    currentDashboard = {
      captureRiskStatus: data.captureRiskStatus ?? 'HEALTHY',
      benefitBurdenImbalances: data.benefitBurdenImbalances ?? [],
      futureDebtTrend: data.futureDebtTrend ?? 0,
      equityScore: data.equityScore ?? 1.0,
      allocationFairness: data.allocationFairness ?? 1.0,
      pendingDisputes: data.pendingDisputes ?? 0,
      generationalHealth: data.generationalHealth ?? 'SUSTAINABLE',
      topRisks: data.topRisks ?? [],
      alerts: data.alerts ?? [],
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  if (!currentDashboard) {
    currentDashboard = {
      captureRiskStatus: 'HEALTHY',
      benefitBurdenImbalances: [],
      futureDebtTrend: 0,
      equityScore: 1.0,
      allocationFairness: 1.0,
      pendingDisputes: 0,
      generationalHealth: 'SUSTAINABLE',
      topRisks: [],
      alerts: [],
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  return { ...currentDashboard };
}

/**
 * 정당성 보고서를 생성한다.
 * @returns 생성된 보고서
 */
export function generateLegitimacyReport(): LegitimacyReport {
  const dashboard = getLegitimacyDashboard();
  const recommendations = deriveRecommendations(dashboard);
  const summary = buildSummary(dashboard);

  const report: LegitimacyReport = {
    reportId: `RPT-${String(nextReportId++).padStart(6, '0')}`,
    snapshot: { ...dashboard },
    summary,
    recommendations,
    generatedAt: new Date().toISOString(),
  };

  reportHistory.push(report);
  return { ...report };
}

/**
 * 공익 검토 데이터를 반환한다.
 * @param period 검토 기간 (예: "2026-Q1")
 * @returns 공익 검토 데이터
 */
export function getPublicInterestReviewData(
  period: string
): PublicInterestReviewData {
  // 인메모리 집계 (실제 운영 시 각 모듈에서 데이터를 수집)
  return {
    period,
    publicInterestAllocations: 0,
    civicPriorityRoutings: 0,
    correctiveReallocations: 0,
    disputesResolved: 0,
    evictions: 0,
  };
}

// ─── 내부 헬퍼 ───

function deriveRecommendations(
  dashboard: LegitimacyDashboardData
): string[] {
  const recs: string[] = [];

  if (dashboard.captureRiskStatus !== 'HEALTHY') {
    recs.push('포획 위험이 감지되었습니다. 즉각적인 거버넌스 감사를 권고합니다.');
  }
  if (dashboard.benefitBurdenImbalances.length > 0) {
    recs.push('편익-부담 불균형이 존재합니다. 해당 참여자의 의무 이행을 강화하십시오.');
  }
  if (dashboard.generationalHealth !== 'SUSTAINABLE') {
    recs.push('세대 간 건강이 위험합니다. 편의 중심 최적화를 동결하십시오.');
  }
  if (dashboard.equityScore < 0.7) {
    recs.push('형평성 점수가 낮습니다. 교정적 재배분을 시행하십시오.');
  }
  if (dashboard.pendingDisputes > 5) {
    recs.push('계류 중인 분쟁이 많습니다. 분쟁 해결 프로세스를 가속화하십시오.');
  }

  if (recs.length === 0) {
    recs.push('현재 커먼즈 정당성 지표가 건전합니다.');
  }

  return recs;
}

function buildSummary(dashboard: LegitimacyDashboardData): string {
  const parts: string[] = [];
  parts.push(`포획 위험: ${dashboard.captureRiskStatus}`);
  parts.push(`형평성: ${(dashboard.equityScore * 100).toFixed(0)}%`);
  parts.push(`세대 간 건강: ${dashboard.generationalHealth}`);
  parts.push(`계류 분쟁: ${dashboard.pendingDisputes}건`);
  parts.push(`활성 경보: ${dashboard.alerts.length}건`);
  return parts.join(' | ');
}
