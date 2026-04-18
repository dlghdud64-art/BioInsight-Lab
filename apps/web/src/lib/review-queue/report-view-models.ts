/**
 * Report / Analytics — View Models (Presenter Layer)
 *
 * 페이지 컨테이너(container)가 도메인 데이터를 가공하여 UI 컴포넌트에 전달하는 뷰 모델.
 * 컴포넌트는 이 타입만 의존하며, 도메인 모델을 직접 참조하지 않는다.
 */

import type {
  ReportFreshness,
  ReportMetricDefinition,
  ReportMetricId,
  ChartType,
  RecommendationActionType,
} from "./report-analytics-contract";

// ═══════════════════════════════════════════════════
// Shared Tone
// ═══════════════════════════════════════════════════

/** 리포트 공통 톤 — 해석 결과의 심각도를 시각적으로 전달 */
export type ReportTone = "neutral" | "success" | "warning" | "danger";

// ═══════════════════════════════════════════════════
// 1. Scope Summary ViewModel
// ═══════════════════════════════════════════════════

/**
 * 리포트 범위 요약 — 사용자가 현재 보고 있는 데이터의 맥락을 한눈에 파악할 수 있도록 한다.
 */
export interface ReportScopeSummaryViewModel {
  /** 조회 기간 라벨 (예: "2026-03-01 ~ 2026-03-20") */
  periodLabel: string;
  /** 조직 범위 라벨 (예: "바이오연구팀 전체") */
  orgScopeLabel: string;
  /** 적용된 필터 라벨 (예: "부서: 분자생물학, 상태: 진행중") */
  appliedFiltersLabel: string;
  /** 비교 기준선 라벨 (예: "전월 동기 대비") */
  comparisonBaselineLabel: string;
  /** 데이터 신선도 라벨 (예: "2026-03-20 09:15 기준, 최대 15분 지연") */
  freshnessLabel: string;
}

// ═══════════════════════════════════════════════════
// 2. Insight ViewModel
// ═══════════════════════════════════════════════════

/**
 * 핵심 발견(Key Finding) 항목 — INTERPRETATION_PRIORITY 순서로 정렬하여 표시.
 */
export interface ReportInsightViewModel {
  /** 고유 ID */
  id: string;
  /** 인사이트 제목 */
  title: string;
  /** 발견 요약 문구 */
  finding: string;
  /** 심각도 톤 */
  tone: ReportTone;
  /** 주요 조치 버튼 라벨 (없으면 정보성 인사이트) */
  primaryActionLabel?: string;
  /** 조치 이동 경로 */
  href?: string;
  /** 정렬 우선순위 (낮을수록 상단) */
  priority: number;
}

// ═══════════════════════════════════════════════════
// 3. KPI ViewModel
// ═══════════════════════════════════════════════════

/**
 * KPI 카드 뷰 모델 — 수치 + 비교 + 해석을 하나의 카드로 전달.
 */
export interface ReportKpiViewModel {
  /** 고유 ID */
  id: string;
  /** KPI 제목 */
  title: string;
  /** 포맷된 현재 값 (예: "32.5시간", "12%") */
  valueLabel: string;
  /** 비교 라벨 (예: "전월 대비 +8%") */
  comparisonLabel?: string;
  /** 해석 문구 (REPORT_METRICS.interpretationTemplates에서 도출) */
  interpretationLabel?: string;
  /** 심각도 톤 */
  tone: ReportTone;
  /** 드릴다운 경로 */
  href?: string;
  /** 연결된 지표 ID — REPORT_METRICS 참조 키 */
  metricId: ReportMetricId;
}

// ═══════════════════════════════════════════════════
// 4. Chart Block ViewModel
// ═══════════════════════════════════════════════════

/**
 * 차트 블록 뷰 모델 — 차트 + 해석 문구를 하나의 블록으로 전달.
 */
export interface ReportChartBlockViewModel {
  /** 고유 ID */
  id: string;
  /** 차트 제목 */
  title: string;
  /** 차트 해석 문구 */
  interpretation: string;
  /** 차트 유형 */
  chartType: ChartType;
  /** 해석 결과 톤 (차트 전체의 상태를 요약) */
  tone?: ReportTone;
  /** 드릴다운 경로 */
  href?: string;
  /** CTA 버튼 라벨 */
  ctaLabel?: string;
}

// ═══════════════════════════════════════════════════
// 5. Exception Item ViewModel
// ═══════════════════════════════════════════════════

/** 예외 항목 심각도 */
export type ExceptionSeverity = "critical" | "high" | "medium";

/**
 * 예외 항목 뷰 모델 — 정상 범위를 벗어난 개별 항목을 리스트로 표시.
 */
export interface ReportExceptionItemViewModel {
  /** 고유 ID */
  id: string;
  /** 예외 항목 제목 */
  title: string;
  /** 예외 상세 설명 */
  description: string;
  /** 심각도 */
  severity: ExceptionSeverity;
  /** 상세 이동 경로 */
  href: string;
  /** CTA 버튼 라벨 */
  ctaLabel: string;
  /** 관련 지표 값 (예: "SLA 초과 72시간") */
  metric?: string;
}

// ═══════════════════════════════════════════════════
// 6. Recommendation ViewModel
// ═══════════════════════════════════════════════════

/**
 * 권장 조치 뷰 모델 — 발견과 행동을 연결하여 사용자가 즉시 조치할 수 있도록 한다.
 */
export interface ReportRecommendationViewModel {
  /** 고유 ID */
  id: string;
  /** 연결된 발견 요약 */
  findingSummary: string;
  /** 조치 버튼 라벨 */
  actionLabel: string;
  /** 조치 유형 */
  actionType: RecommendationActionType;
  /** 조치 이동 경로 */
  href: string;
  /** 우선순위 */
  priority: "high" | "medium" | "low";
}

// ═══════════════════════════════════════════════════
// 7. Drilldown Row ViewModel
// ═══════════════════════════════════════════════════

/**
 * 드릴다운 행 뷰 모델 — 리포트 하단 상세 리스트의 개별 행.
 */
export interface ReportDrilldownRowViewModel {
  /** 고유 ID */
  id: string;
  /** 행 제목 (예: 품목명, 요청 제목) */
  title: string;
  /** 상태 라벨 (예: "SLA 초과", "승인 대기") */
  statusLabel: string;
  /** 상태 톤 */
  tone: ReportTone;
  /** 관련 지표 값 (예: "48시간", "120%") */
  metricValue?: string;
  /** 상세 이동 경로 */
  href: string;
}

// ═══════════════════════════════════════════════════
// 8. Report Page ViewModel (최상위)
// ═══════════════════════════════════════════════════

/**
 * 리포트 페이지 전체 뷰 모델.
 * 페이지 컨테이너는 도메인 데이터를 이 형태로 변환하여 레이아웃 컴포넌트에 전달한다.
 */
export interface ReportPageViewModel {
  /** 페이지 헤더 */
  header: {
    /** 리포트 제목 */
    title: string;
    /** 리포트 목적 설명 */
    purposeDescription: string;
    /** 주요 액션 라벨 (예: "PDF 내보내기") */
    primaryActionLabel?: string;
    /** 주요 액션 경로 */
    primaryActionHref?: string;
  };
  /** 범위 요약 */
  scope: ReportScopeSummaryViewModel;
  /** 핵심 발견 목록 */
  insights: ReportInsightViewModel[];
  /** KPI 카드 목록 */
  kpis: ReportKpiViewModel[];
  /** 차트 블록 목록 */
  chartBlocks: ReportChartBlockViewModel[];
  /** 예외 항목 목록 */
  exceptions: ReportExceptionItemViewModel[];
  /** 권장 조치 목록 */
  recommendations: ReportRecommendationViewModel[];
  /** 드릴다운 행 목록 */
  drilldownRows: ReportDrilldownRowViewModel[];
  /** 데이터 신선도 정보 */
  freshness: ReportFreshness;
  /** 페이지 상태 플래그 */
  pageState: {
    /** 데이터 없음 여부 */
    isEmpty: boolean;
    /** 오류 발생 여부 */
    hasError: boolean;
    /** 이용 불가 여부 */
    isUnavailable: boolean;
    /** 이용 불가 사유 */
    unavailableReason?: string;
  };
}

// ═══════════════════════════════════════════════════
// 9. Helper: resolveKpiTone
// ═══════════════════════════════════════════════════

/**
 * 수치와 임계값을 비교하여 KPI 톤을 결정한다.
 *
 * 임계값 해석 방식:
 * - normal < warning < danger (값이 클수록 나쁨, 예: 소요 시간, 초과 건수)
 * - normal > warning > danger (값이 작을수록 나쁨, 예: 전환율)
 *
 * @param value - 현재 지표 값
 * @param thresholds - { normal, warning, danger } 임계값
 * @returns 해당하는 ReportTone
 */
export function resolveKpiTone(
  value: number,
  thresholds: { normal: number; warning: number; danger: number },
): ReportTone {
  const { normal, warning, danger } = thresholds;

  // 값이 클수록 나쁜 경우 (normal < warning < danger)
  if (normal < danger) {
    if (value <= normal) return "success";
    if (value <= warning) return "warning";
    return "danger";
  }

  // 값이 작을수록 나쁜 경우 (normal > warning > danger)
  if (value >= normal) return "success";
  if (value >= warning) return "warning";
  return "danger";
}

// ═══════════════════════════════════════════════════
// 10. Helper: resolveInterpretation
// ═══════════════════════════════════════════════════

/**
 * 수치와 지표 정의를 기반으로 해석 문구를 반환한다.
 * resolveKpiTone과 동일한 임계값 로직을 사용하여 일관된 해석을 보장한다.
 *
 * @param value - 현재 지표 값
 * @param metric - 지표 정의 (ReportMetricDefinition)
 * @returns 상태에 맞는 해석 템플릿 문자열
 */
export function resolveInterpretation(
  value: number,
  metric: ReportMetricDefinition,
): string {
  const tone = resolveKpiTone(value, metric.thresholds);

  switch (tone) {
    case "success":
      return metric.interpretationTemplates.normal;
    case "warning":
      return metric.interpretationTemplates.warning;
    case "danger":
      return metric.interpretationTemplates.danger;
    default:
      return metric.interpretationTemplates.normal;
  }
}
