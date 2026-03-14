/**
 * @module industry-dashboard
 * @description 산업 규제 대시보드 — 통제 건강도, 컴플라이언스 커버리지, 테스트 현황, 드리프트 알림 등을 통합 제공하는 대시보드 엔진
 */

import type { TrustMarkLevel } from './trust-mark-framework';

/** 통제 건강도 요약 */
export interface ControlHealthSummary {
  /** 총 통제 수 */
  total: number;
  /** 구현 완료 수 */
  implemented: number;
  /** 부분 구현 수 */
  partiallyImplemented: number;
  /** 계획 수 */
  planned: number;
  /** 건강도 (%) */
  healthPercent: number;
}

/** 테스트 현황 요약 */
export interface TestingStatusSummary {
  /** 총 테스트 수 */
  total: number;
  /** 통과 수 */
  passed: number;
  /** 실패 수 */
  failed: number;
  /** 미테스트 수 */
  notTested: number;
  /** 기한 초과 수 */
  overdue: number;
}

/** 예외 요약 */
export interface ExceptionSummary {
  /** 총 예외 수 */
  total: number;
  /** 미해결 수 */
  open: number;
  /** 크리티컬 수 */
  critical: number;
  /** 기한 초과 수 */
  overdue: number;
}

/** 인증 현황 */
export interface CertificationStatus {
  /** 최근 인증 유형 */
  latestType: string | null;
  /** 인증 일시 */
  certifiedAt: Date | null;
  /** 패키지 완전성 (%) */
  completeness: number;
}

/** 산업 대시보드 데이터 */
export interface IndustryDashboardData {
  /** 통제 건강도 */
  controlHealth: ControlHealthSummary;
  /** 컴플라이언스 커버리지 (%) */
  complianceCoverage: number;
  /** 테스트 현황 */
  testingStatus: TestingStatusSummary;
  /** 예외 요약 */
  exceptionSummary: ExceptionSummary;
  /** 활성 드리프트 알림 수 */
  driftAlerts: number;
  /** 인증 현황 */
  certificationStatus: CertificationStatus;
  /** 신뢰 마크 등급 */
  trustMarkLevel: TrustMarkLevel;
  /** 생성 일시 */
  generatedAt: Date;
}

/** 컴플라이언스 추세 데이터 포인트 */
export interface ComplianceTrendPoint {
  /** 기간 */
  period: string;
  /** 커버리지 (%) */
  coverage: number;
  /** 통제 건강도 (%) */
  controlHealth: number;
  /** 테스트 통과율 (%) */
  testPassRate: number;
}

/** 규제 보고서 */
export interface RegulatoryReport {
  /** 보고서 제목 */
  title: string;
  /** 생성 일시 */
  generatedAt: Date;
  /** 대시보드 스냅샷 */
  dashboard: IndustryDashboardData;
  /** 주요 소견 */
  keyFindings: string[];
  /** 권고사항 */
  recommendations: string[];
}

/** 인메모리 추세 저장소 */
const trendStore: ComplianceTrendPoint[] = [];

/** 인메모리 보고서 저장소 */
const reportStore: RegulatoryReport[] = [];

/**
 * 산업 대시보드 데이터를 생성한다.
 * @param params 대시보드 구성 요소
 * @returns 산업 대시보드 데이터
 */
export function getIndustryDashboard(params: Omit<IndustryDashboardData, 'generatedAt'>): IndustryDashboardData {
  const dashboard: IndustryDashboardData = {
    ...params,
    generatedAt: new Date(),
  };

  // 추세 기록
  trendStore.push({
    period: new Date().toISOString().slice(0, 10),
    coverage: params.complianceCoverage,
    controlHealth: params.controlHealth.healthPercent,
    testPassRate: params.testingStatus.total > 0
      ? Math.round((params.testingStatus.passed / params.testingStatus.total) * 100)
      : 0,
  });

  return dashboard;
}

/**
 * 규제 보고서를 생성한다.
 * @param dashboard 대시보드 데이터
 * @param title 보고서 제목
 * @returns 규제 보고서
 */
export function generateRegulatoryReport(
  dashboard: IndustryDashboardData,
  title: string
): RegulatoryReport {
  const keyFindings: string[] = [];
  const recommendations: string[] = [];

  // 통제 건강도 분석
  if (dashboard.controlHealth.healthPercent < 90) {
    keyFindings.push(`통제 건강도가 ${dashboard.controlHealth.healthPercent}%로 기준(90%) 미달입니다.`);
    recommendations.push('미구현 통제 항목에 대한 구현 계획을 수립하십시오.');
  }

  // 예외 분석
  if (dashboard.exceptionSummary.critical > 0) {
    keyFindings.push(`크리티컬 예외 ${dashboard.exceptionSummary.critical}건이 미해결입니다.`);
    recommendations.push('크리티컬 예외에 대한 긴급 시정조치를 시행하십시오.');
  }

  // 드리프트 분석
  if (dashboard.driftAlerts > 0) {
    keyFindings.push(`${dashboard.driftAlerts}건의 드리프트 알림이 활성 상태입니다.`);
    recommendations.push('드리프트 원인을 분석하고 해결 조치를 취하십시오.');
  }

  // 테스트 분석
  if (dashboard.testingStatus.overdue > 0) {
    keyFindings.push(`${dashboard.testingStatus.overdue}건의 테스트가 기한을 초과했습니다.`);
    recommendations.push('기한 초과 테스트를 즉시 수행하십시오.');
  }

  if (keyFindings.length === 0) {
    keyFindings.push('모든 규제 통제 지표가 기준을 충족합니다.');
  }

  const report: RegulatoryReport = {
    title,
    generatedAt: new Date(),
    dashboard,
    keyFindings,
    recommendations,
  };
  reportStore.push(report);
  return report;
}

/**
 * 컴플라이언스 추세 데이터를 반환한다.
 * @param limit 최대 항목 수 (기본: 30)
 * @returns 추세 데이터 포인트 배열
 */
export function getComplianceTrend(limit: number = 30): ComplianceTrendPoint[] {
  return trendStore.slice(-limit);
}
