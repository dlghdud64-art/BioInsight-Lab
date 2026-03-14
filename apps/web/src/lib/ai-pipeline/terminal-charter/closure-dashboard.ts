/**
 * @module closure-dashboard
 * @description 종결 대시보드 — 시스템의 헌법적 종결 상태를 종합적으로 표시한다.
 * 종결 상태, 코어 무결성, 갱신 대기열, 목적 상태, 재창설 위험,
 * 의무 이행 현황, 감사 판정, 알림을 단일 뷰로 제공한다.
 */

import type { ClosureStatus } from "./constitutional-closure-engine";
import type { PurposeStatus } from "./continuity-of-purpose-lock";
import type { RefoundationStatus } from "./refoundation-trigger-system";
import type { AuditVerdict } from "./terminal-audit-framework";

/** 대시보드 알림 */
export interface DashboardAlert {
  /** 알림 ID */
  id: string;
  /** 심각도 */
  severity: "INFO" | "WARNING" | "CRITICAL";
  /** 메시지 */
  message: string;
  /** 발생 일시 */
  timestamp: Date;
}

/** 종결 대시보드 데이터 */
export interface ClosureDashboardData {
  /** 종결 상태 */
  closureStatus: ClosureStatus;
  /** 코어 무결성 점수 (0~100) */
  coreIntegrity: number;
  /** 갱신 대기열 크기 */
  renewalQueueSize: number;
  /** 만기 초과 갱신 수 */
  overdueRenewals: number;
  /** 목적 상태 */
  purposeStatus: PurposeStatus;
  /** 재창설 위험 */
  refoundationRisk: RefoundationStatus;
  /** 대기 중 개정 수 */
  amendmentsPending: number;
  /** 이행 완료 의무 수 */
  obligationsFulfilled: number;
  /** 미이행 의무 수 */
  obligationsOutstanding: number;
  /** 감사 판정 */
  auditVerdict: AuditVerdict;
  /** 알림 목록 */
  alerts: DashboardAlert[];
}

/** 종결 보고서 */
export interface ClosureReport {
  /** 보고서 생성 일시 */
  generatedAt: Date;
  /** 대시보드 데이터 */
  dashboard: ClosureDashboardData;
  /** 요약 */
  summary: string;
  /** 권장 조치 */
  recommendations: string[];
}

/**
 * 종결 대시보드 데이터를 구성한다.
 * @param inputs - 각 모듈에서 수집한 데이터
 * @returns 종결 대시보드 데이터
 */
export function getClosureDashboard(inputs: {
  closureStatus: ClosureStatus;
  coreIntegrity: number;
  renewalQueueSize: number;
  overdueRenewals: number;
  purposeStatus: PurposeStatus;
  refoundationRisk: RefoundationStatus;
  amendmentsPending: number;
  obligationsFulfilled: number;
  obligationsOutstanding: number;
  auditVerdict: AuditVerdict;
}): ClosureDashboardData {
  const alerts = generateAlerts(inputs);

  return {
    ...inputs,
    alerts,
  };
}

/**
 * 종결 보고서를 생성한다.
 * @param dashboard - 대시보드 데이터
 * @returns 종결 보고서
 */
export function generateClosureReport(
  dashboard: ClosureDashboardData
): ClosureReport {
  const recommendations: string[] = [];

  if (dashboard.closureStatus !== "CONSTITUTIONALLY_CLOSED") {
    recommendations.push("종결 전 모든 점검 항목을 통과시켜야 합니다.");
  }
  if (dashboard.coreIntegrity < 100) {
    recommendations.push("코어 무결성을 복원해야 합니다.");
  }
  if (dashboard.overdueRenewals > 0) {
    recommendations.push(
      `${dashboard.overdueRenewals}건의 만기 초과 갱신을 즉시 처리하세요.`
    );
  }
  if (dashboard.purposeStatus !== "ALIGNED") {
    recommendations.push("목적 이탈을 해소하고 정렬 상태를 복원하세요.");
  }
  if (dashboard.refoundationRisk === "REFOUNDATION_REQUIRED") {
    recommendations.push("재창설 절차를 즉시 검토하세요.");
  }
  if (dashboard.obligationsOutstanding > 0) {
    recommendations.push(
      `${dashboard.obligationsOutstanding}건의 미이행 의무를 이행하세요.`
    );
  }
  if (dashboard.auditVerdict === "STRUCTURALLY_COMPROMISED") {
    recommendations.push("구조적 손상이 감지되어 긴급 조치가 필요합니다.");
  }

  const summary = buildSummary(dashboard);

  return {
    generatedAt: new Date(),
    dashboard,
    summary,
    recommendations,
  };
}

/**
 * 현재 알림 목록을 반환한다.
 * @param dashboard - 대시보드 데이터
 * @returns 알림 배열
 */
export function getClosureAlerts(
  dashboard: ClosureDashboardData
): DashboardAlert[] {
  return dashboard.alerts;
}

/** 알림 자동 생성 */
function generateAlerts(inputs: {
  closureStatus: ClosureStatus;
  coreIntegrity: number;
  overdueRenewals: number;
  purposeStatus: PurposeStatus;
  refoundationRisk: RefoundationStatus;
  obligationsOutstanding: number;
  auditVerdict: AuditVerdict;
}): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];
  const now = new Date();
  let idx = 0;

  if (inputs.coreIntegrity < 100) {
    alerts.push({
      id: `ALERT-${idx++}`,
      severity: inputs.coreIntegrity < 50 ? "CRITICAL" : "WARNING",
      message: `코어 무결성: ${inputs.coreIntegrity}%`,
      timestamp: now,
    });
  }

  if (inputs.overdueRenewals > 0) {
    alerts.push({
      id: `ALERT-${idx++}`,
      severity: inputs.overdueRenewals > 5 ? "CRITICAL" : "WARNING",
      message: `만기 초과 갱신 ${inputs.overdueRenewals}건`,
      timestamp: now,
    });
  }

  if (inputs.purposeStatus === "CONSTITUTIONAL_BREACH") {
    alerts.push({
      id: `ALERT-${idx++}`,
      severity: "CRITICAL",
      message: "헌법적 위반 — 공익 의무 축소 감지",
      timestamp: now,
    });
  } else if (inputs.purposeStatus === "PURPOSE_DRIFT_ACTIVE") {
    alerts.push({
      id: `ALERT-${idx++}`,
      severity: "WARNING",
      message: "목적 이탈 활성 — 기능 확장 동결 중",
      timestamp: now,
    });
  }

  if (inputs.refoundationRisk === "REFOUNDATION_REQUIRED") {
    alerts.push({
      id: `ALERT-${idx++}`,
      severity: "CRITICAL",
      message: "재창설 필요 상태",
      timestamp: now,
    });
  }

  if (inputs.auditVerdict === "STRUCTURALLY_COMPROMISED") {
    alerts.push({
      id: `ALERT-${idx++}`,
      severity: "CRITICAL",
      message: "터미널 감사: 구조적 손상 판정",
      timestamp: now,
    });
  }

  if (inputs.obligationsOutstanding > 0) {
    alerts.push({
      id: `ALERT-${idx++}`,
      severity: "WARNING",
      message: `미이행 의무 ${inputs.obligationsOutstanding}건`,
      timestamp: now,
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: `ALERT-${idx}`,
      severity: "INFO",
      message: "시스템 정상 — 모든 지표 양호",
      timestamp: now,
    });
  }

  return alerts;
}

/** 요약 문자열 생성 */
function buildSummary(dashboard: ClosureDashboardData): string {
  const parts: string[] = [];

  parts.push(`종결 상태: ${dashboard.closureStatus}`);
  parts.push(`코어 무결성: ${dashboard.coreIntegrity}%`);
  parts.push(`감사 판정: ${dashboard.auditVerdict}`);
  parts.push(`목적 상태: ${dashboard.purposeStatus}`);
  parts.push(
    `의무: 이행 ${dashboard.obligationsFulfilled} / 미이행 ${dashboard.obligationsOutstanding}`
  );
  parts.push(`알림: ${dashboard.alerts.length}건`);

  return parts.join(" | ");
}

// ═══════════════════════════════════════════════
// Scenario 8 확장: 회복력 대시보드 카드
// ═══════════════════════════════════════════════

/** 회복력 대시보드 카드 */
export interface ResilienceDashboardCard {
  /** 카드 ID */
  cardId: string;
  /** 카드 제목 */
  title: string;
  /** 상태 */
  status: "GREEN" | "YELLOW" | "RED";
  /** 값 */
  value: string;
  /** 설명 */
  description: string;
}

/**
 * Scenario 8 회복력 관련 대시보드 카드를 생성한다.
 */
export function getResilienceDashboardCards(params: {
  /** 반복 차단 저항성: 반복/위장 시도 차단율 (0~100) */
  repeatedBlockRate: number;
  /** 부분 장애 생존성: degraded mode에서 코어 보호 유지율 (0~100) */
  degradedSurvivalRate: number;
  /** 역할 충돌 인시던트 수 */
  roleConflictCount: number;
  /** fail-open 발생 건수 */
  failOpenCount: number;
  /** 경계선 판정 보류 건수 */
  borderlinePendingCount: number;
  /** 백로그 P0 건수 */
  p0BacklogCount: number;
}): ResilienceDashboardCard[] {
  return [
    {
      cardId: "RES-CARD-01",
      title: "반복 차단 저항성",
      status: params.repeatedBlockRate >= 95 ? "GREEN" : params.repeatedBlockRate >= 80 ? "YELLOW" : "RED",
      value: `${params.repeatedBlockRate.toFixed(1)}%`,
      description: "반복/위장 코어 침해 시도에 대한 일관된 차단율",
    },
    {
      cardId: "RES-CARD-02",
      title: "부분 장애 생존성",
      status: params.degradedSurvivalRate >= 95 ? "GREEN" : params.degradedSurvivalRate >= 80 ? "YELLOW" : "RED",
      value: `${params.degradedSurvivalRate.toFixed(1)}%`,
      description: "보조 인프라 장애 시 코어 보호 유지율",
    },
    {
      cardId: "RES-CARD-03",
      title: "역할 충돌 인시던트",
      status: params.roleConflictCount === 0 ? "GREEN" : params.roleConflictCount <= 2 ? "YELLOW" : "RED",
      value: `${params.roleConflictCount}건`,
      description: "역할 경계 침범 및 권한 혼선 탐지 건수",
    },
    {
      cardId: "RES-CARD-04",
      title: "Fail-Open 경로",
      status: params.failOpenCount === 0 ? "GREEN" : "RED",
      value: `${params.failOpenCount}건`,
      description: "자동 승인/fail-open 경로 발생 건수 (0이어야 함)",
    },
    {
      cardId: "RES-CARD-05",
      title: "경계선 판정 보류",
      status: params.borderlinePendingCount === 0 ? "GREEN" : params.borderlinePendingCount <= 3 ? "YELLOW" : "RED",
      value: `${params.borderlinePendingCount}건`,
      description: "리뷰 대기 중인 경계선 케이스",
    },
    {
      cardId: "RES-CARD-06",
      title: "P0 백로그",
      status: params.p0BacklogCount === 0 ? "GREEN" : "RED",
      value: `${params.p0BacklogCount}건`,
      description: "헌법적 결함 — 즉시 해결 필요 항목",
    },
  ];
}
