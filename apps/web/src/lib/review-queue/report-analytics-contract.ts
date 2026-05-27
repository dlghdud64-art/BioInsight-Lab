/**
 * Report / Analytics 페이지 중앙 계약
 *
 * 핵심 원칙: 리포트는 데이터 나열이 아니라 **해석과 조치 연결**을 위해 존재한다.
 * 모든 지표는 임계값 기반 해석 문구를 가지며, 차트는 반드시 하나의 질문에 답해야 하고,
 * 권장 조치는 운영 큐·드릴다운·정책 조정 등 구체적 행동 유형을 명시한다.
 */

// ═══════════════════════════════════════════════════
// 1. Report Page Section Order
// ═══════════════════════════════════════════════════

/** 리포트 페이지의 필수 섹션 순서. 모든 리포트 페이지는 이 순서를 따른다. */
export const REPORT_PAGE_SECTIONS = [
  "header",
  "scope_summary",
  "key_findings",
  "kpi_layer",
  "chart_analysis",
  "recommendations",
  "drilldown_list",
  "export",
] as const;

export type ReportPageSection = (typeof REPORT_PAGE_SECTIONS)[number];

// ═══════════════════════════════════════════════════
// 2. Report Metric Definition
// ═══════════════════════════════════════════════════

/** 집계 방식 */
export type AggregationType = "count" | "ratio" | "average" | "sum" | "duration";

/** 비교 기준선 */
export type ComparisonBaseline =
  | "previous_period"
  | "same_period_last_month"
  | "sla_target"
  | "org_average"
  | "vendor_baseline";

/**
 * 지표 정의 — 임계값 + 해석 템플릿을 중앙에서 관리.
 * 각 리포트 페이지는 이 정의를 참조하여 KPI 카드를 렌더링한다.
 */
export interface ReportMetricDefinition {
  /** 지표 고유 식별자 */
  id: string;
  /** 지표 제목 */
  title: string;
  /** 지표 설명 (목적·맥락) */
  description: string;
  /** 집계 방식 */
  aggregationType: AggregationType;
  /** 비교 기준선 */
  comparisonBaseline: ComparisonBaseline;
  /** 수치 임계값 — normal ≤ warning ≤ danger 순서 (ratio의 경우 역순 가능) */
  thresholds: {
    normal: number;
    warning: number;
    danger: number;
  };
  /** 상태별 해석 템플릿 문구 */
  interpretationTemplates: {
    normal: string;
    warning: string;
    danger: string;
  };
  /** 드릴다운 경로 */
  drilldownHref: string;
}

// ═══════════════════════════════════════════════════
// 3. REPORT_METRICS — 운영 핵심 지표
// ═══════════════════════════════════════════════════

/**
 * 플랫폼 운영 핵심 지표 정의 모음.
 * 각 키는 지표 ID와 동일하며, KPI 카드·차트·권장 조치에서 참조한다.
 */
export const REPORT_METRICS = {
  avg_approval_time: {
    id: "avg_approval_time",
    title: "평균 승인 소요 시간",
    description: "요청 접수부터 최종 승인까지의 평균 소요 시간(시간 단위). SLA 준수 여부를 판단하는 핵심 병목 지표.",
    aggregationType: "duration",
    comparisonBaseline: "sla_target",
    thresholds: { normal: 24, warning: 48, danger: 72 },
    interpretationTemplates: {
      normal: "승인 소요 시간이 SLA 이내로 정상 운영 중입니다.",
      warning: "승인 지연이 발생하고 있습니다. 병목 구간을 확인하세요.",
      danger: "승인 소요 시간이 SLA를 크게 초과했습니다. 즉시 대응이 필요합니다.",
    },
    drilldownHref: "/dashboard/analytics/approval-time",
  },
  sla_overdue_ratio: {
    id: "sla_overdue_ratio",
    title: "SLA 초과 항목 비율",
    description: "전체 처리 항목 중 SLA를 초과한 항목의 비율(%). 운영 건전성의 직접적 지표.",
    aggregationType: "ratio",
    comparisonBaseline: "previous_period",
    thresholds: { normal: 5, warning: 15, danger: 30 },
    interpretationTemplates: {
      normal: "SLA 초과 비율이 허용 범위 이내입니다.",
      warning: "SLA 초과 항목이 증가하고 있습니다. 세그먼트별 원인을 확인하세요.",
      danger: "SLA 초과 비율이 위험 수준입니다. 프로세스 점검이 시급합니다.",
    },
    drilldownHref: "/dashboard/analytics/sla-overdue",
  },
  low_stock_new: {
    id: "low_stock_new",
    title: "부족 재고 신규 발생",
    description: "기간 내 새로 안전재고 이하로 진입한 품목 수. 조기 발주 필요성을 판단하는 재고 운영 지표.",
    aggregationType: "count",
    comparisonBaseline: "same_period_last_month",
    thresholds: { normal: 3, warning: 8, danger: 15 },
    interpretationTemplates: {
      normal: "부족 재고 발생이 안정적으로 관리되고 있습니다.",
      warning: "부족 재고 신규 발생이 평소보다 많습니다. 발주 계획을 점검하세요.",
      danger: "부족 재고가 급증했습니다. 긴급 발주 및 재고 정책 재검토가 필요합니다.",
    },
    drilldownHref: "/dashboard/inventory?filter=low-stock",
  },
  budget_risk_count: {
    id: "budget_risk_count",
    title: "예산 초과 위험 요청",
    description: "예산 한도의 80% 이상을 사용했거나 초과가 예상되는 요청 건수. 재무 리스크 사전 탐지 지표.",
    aggregationType: "count",
    comparisonBaseline: "org_average",
    thresholds: { normal: 2, warning: 5, danger: 10 },
    interpretationTemplates: {
      normal: "예산 초과 위험 요청이 정상 범위입니다.",
      warning: "예산 초과 위험 요청이 증가하고 있습니다. 부서별 지출을 확인하세요.",
      danger: "예산 초과 위험 요청이 다수 발생했습니다. 예산 재배분 또는 지출 동결을 검토하세요.",
    },
    drilldownHref: "/dashboard/budget?filter=at-risk",
  },
  vendor_avg_response: {
    id: "vendor_avg_response",
    title: "공급사 평균 응답 시간",
    description: "견적 요청 후 공급사가 응답하기까지의 평균 소요 시간(시간 단위). 공급사 성과 평가 핵심 지표.",
    aggregationType: "duration",
    comparisonBaseline: "vendor_baseline",
    thresholds: { normal: 12, warning: 36, danger: 72 },
    interpretationTemplates: {
      normal: "공급사 응답 시간이 양호합니다.",
      warning: "공급사 응답이 지연되고 있습니다. 주요 공급사별 현황을 확인하세요.",
      danger: "공급사 응답 시간이 매우 느립니다. 대체 공급사 확보를 검토하세요.",
    },
    drilldownHref: "/dashboard/vendor/premium?tab=response-time",
  },
  request_to_order_rate: {
    id: "request_to_order_rate",
    title: "요청→주문 전환율",
    description: "요청 접수 건 중 실제 주문으로 전환된 비율(%). 프로세스 효율성과 이탈 구간을 파악하는 지표.",
    aggregationType: "ratio",
    comparisonBaseline: "previous_period",
    thresholds: { normal: 70, warning: 50, danger: 30 },
    interpretationTemplates: {
      normal: "요청 대비 주문 전환율이 양호합니다.",
      warning: "전환율이 하락하고 있습니다. 이탈 단계를 분석하세요.",
      danger: "전환율이 매우 낮습니다. 프로세스 전반의 병목을 긴급 점검하세요.",
    },
    drilldownHref: "/dashboard/analytics/conversion-funnel",
  },
} as const satisfies Record<string, ReportMetricDefinition>;

/** REPORT_METRICS 키 유니온 타입 */
export type ReportMetricId = keyof typeof REPORT_METRICS;

// ═══════════════════════════════════════════════════
// 4. Interpretation Priority
// ═══════════════════════════════════════════════════

/**
 * 인사이트 해석 우선순위.
 * Key Findings 섹션은 이 순서로 정렬하여 가장 중요한 해석을 최상단에 배치한다.
 */
export const INTERPRETATION_PRIORITY = [
  "anomaly_risk",
  "bottleneck_exception",
  "structural_trend",
  "performance_improvement",
  "reference",
] as const;

export type InterpretationPriority = (typeof INTERPRETATION_PRIORITY)[number];

// ═══════════════════════════════════════════════════
// 5. Chart Question Types
// ═══════════════════════════════════════════════════

/**
 * 차트가 반드시 답해야 하는 질문 유형.
 * 차트를 생성할 때 이 질문 중 하나를 명시하지 않으면 계약 위반이다.
 */
export type ChartQuestionType =
  | "when_worsened"       // 언제 악화됐는가
  | "which_segment"       // 어떤 세그먼트에서 발생했는가
  | "which_contributor"   // 주요 원인 항목은 무엇인가
  | "out_of_range"        // 정상 범위를 벗어난 항목이 있는가
  | "temporary_or_structural"; // 일시적 현상인가 구조적 추세인가

// ═══════════════════════════════════════════════════
// 6. Report Chart Spec
// ═══════════════════════════════════════════════════

/** 차트 유형 */
export type ChartType = "line" | "bar" | "stacked-bar" | "area" | "funnel";

/**
 * 리포트 차트 사양.
 * 모든 차트는 해석 문구(interpretation)와 답변 대상 질문(questionAnswered)을 반드시 포함한다.
 */
export interface ReportChartSpec {
  /** 차트 고유 ID */
  id: string;
  /** 차트 제목 */
  title: string;
  /** 차트 해석 문구 — 이 차트가 보여주는 핵심 결론 */
  interpretation: string;
  /** 차트 유형 */
  chartType: ChartType;
  /** 이 차트가 답하는 질문 유형 */
  questionAnswered: ChartQuestionType;
  /** 드릴다운 경로 */
  drilldownHref: string;
  /** 드릴다운 CTA 라벨 */
  drilldownLabel: string;
}

// ═══════════════════════════════════════════════════
// 7. Report Recommendation
// ═══════════════════════════════════════════════════

/** 권장 조치 유형 — 조치의 성격을 명시하여 UI 아이콘/색상을 결정한다 */
export type RecommendationActionType =
  | "queue_review"
  | "segment_drilldown"
  | "policy_adjust"
  | "vendor_followup"
  | "inventory_review"
  | "document_fix"
  | "permission_rebalance";

/**
 * 리포트 권장 조치.
 * 데이터 발견(finding)과 구체적 행동(action)을 연결한다.
 */
export interface ReportRecommendation {
  /** 권장 조치 고유 ID */
  id: string;
  /** 연결된 데이터 발견 요약 */
  finding: string;
  /** 조치 설명 */
  action: string;
  /** 조치 유형 */
  actionType: RecommendationActionType;
  /** 조치 이동 경로 */
  href: string;
  /** CTA 버튼 라벨 */
  ctaLabel: string;
  /** 우선순위 */
  priority: "high" | "medium" | "low";
}

// ═══════════════════════════════════════════════════
// 8. Report Freshness
// ═══════════════════════════════════════════════════

/**
 * 리포트 데이터 신선도 정보.
 * 사용자가 데이터의 시점과 제한사항을 인지할 수 있도록 반드시 표시한다.
 */
export interface ReportFreshness {
  /** 마지막 집계 시점 (ISO 8601) */
  lastAggregatedAt: string;
  /** 동기화 지연 안내 (예: "실시간 대비 최대 15분 지연") */
  syncDelayNote?: string;
  /** 제외된 데이터 안내 (예: "삭제된 요청 3건 제외") */
  excludedDataNote?: string;
  /** 표본 크기 경고 (예: "데이터 30건 미만으로 통계적 신뢰도가 낮을 수 있습니다") */
  sampleSizeWarning?: string;
  /** 추정치 여부 — true이면 정확한 집계가 아닌 추정값임을 표시 */
  isEstimate: boolean;
}

// ═══════════════════════════════════════════════════
// 9. Empty / Error / Unavailable Copy
// ═══════════════════════════════════════════════════

/** 리포트 상태별 안내 문구 구조 */
export interface ReportStateCopy {
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}

/** 데이터가 없을 때 — 필터 조건을 변경하거나 기간을 넓히도록 안내 */
export const REPORT_EMPTY_COPY: ReportStateCopy = {
  title: "표시할 데이터가 없습니다",
  description:
    "선택한 기간 또는 필터 조건에 해당하는 데이터가 없습니다. 기간을 넓히거나 필터를 조정해 보세요.",
  actionLabel: "필터 초기화",
  actionHref: "?reset=true",
};

/** 데이터 로딩/집계 오류 — 재시도 또는 지원팀 문의 안내 */
export const REPORT_ERROR_COPY: ReportStateCopy = {
  title: "데이터를 불러오지 못했습니다",
  description:
    "리포트 데이터 집계 중 오류가 발생했습니다. 잠시 후 다시 시도하거나 문제가 지속되면 지원팀에 문의하세요.",
  actionLabel: "다시 시도",
  actionHref: "?retry=true",
};

/** 리포트 이용 불가 — 권한 부족 또는 플랜 미지원 */
export const REPORT_UNAVAILABLE_COPY: ReportStateCopy = {
  title: "이 리포트를 이용할 수 없습니다",
  description:
    "현재 플랜 또는 권한으로는 이 리포트에 접근할 수 없습니다. 관리자에게 권한을 요청하거나 플랜 업그레이드를 확인하세요.",
  actionLabel: "플랜 확인",
  actionHref: "/dashboard/settings/plans",
};

// ═══════════════════════════════════════════════════
// 10. Anti-Patterns
// ═══════════════════════════════════════════════════

/**
 * 리포트/분석 페이지에서 반드시 피해야 하는 안티패턴.
 * 코드 리뷰 시 이 목록에 해당하면 수정을 요구한다.
 */
export const REPORT_ANTI_PATTERNS: readonly string[] = [
  "해석 없이 숫자만 나열하는 KPI 카드",
  "임계값 정의 없이 색상을 하드코딩한 상태 표시",
  "드릴다운 경로 없이 집계 값만 보여주는 차트",
  "비교 기준선 없이 단일 수치만 표시하는 지표",
  "조치 연결 없이 '주의 필요' 같은 모호한 권장 문구",
  "데이터 신선도(freshness) 표시 없이 렌더링하는 리포트 페이지",
  "차트가 답하는 질문(questionAnswered)을 명시하지 않은 시각화",
  "표본 크기·제외 데이터 안내 없이 통계를 절대적 수치로 제시",
];

// ═══════════════════════════════════════════════════
// 11. Code Review Checklist
// ═══════════════════════════════════════════════════

/**
 * 리포트/분석 페이지 코드 리뷰 체크리스트.
 * PR 리뷰 시 아래 항목을 모두 확인한다.
 */
export const reportCodeReviewChecklist: readonly string[] = [
  "모든 KPI 카드가 REPORT_METRICS의 정의를 참조하는가",
  "임계값 기반 tone 결정이 resolveKpiTone 헬퍼를 사용하는가",
  "해석 문구가 interpretationTemplates에서 도출되는가",
  "차트마다 questionAnswered가 명시되어 있는가",
  "권장 조치(Recommendation)에 actionType과 href가 모두 존재하는가",
  "데이터 신선도(ReportFreshness)가 페이지 상단 또는 하단에 표시되는가",
  "빈 상태·오류 상태·이용 불가 상태에 각각 대응하는 UI가 있는가",
  "REPORT_PAGE_SECTIONS 순서를 따르는 섹션 배치인가",
  "드릴다운 경로가 실제 존재하는 라우트를 가리키는가",
  "INTERPRETATION_PRIORITY 순서로 Key Findings가 정렬되는가",
];
