/**
 * Compare Queue Semantics — Canonical Definitions
 *
 * 비교 도메인 큐 아이템의 substatus별 의미·진입/종료 조건·CTA·SLA를 정의합니다.
 * 모든 비교 큐 관련 코드는 이 파일의 정의를 단일 진실 원천으로 참조해야 합니다.
 */

import type { TaskStatus, ApprovalStatus } from "./state-mapper";

// ── Canonical Substatus Definitions ──

export interface CompareSubstatusDefinition {
  substatus: string;
  label: string;
  description: string;
  taskStatus: TaskStatus;
  approvalStatus: ApprovalStatus;
  cta: { label: string; variant: "default" | "destructive" | "outline" };
  slaWarningDays: number;
  staleDays: number;
  isTerminal: boolean;
  activityType: string;
  /** SLA 초과 시 운영자에게 표시할 에스컬레이션 메시지 */
  escalationMeaning: string;
  /** SLA 초과 시 urgency score에 추가할 점수 */
  scoringBoostOnBreach: number;
  /** 대시보드 가시성: always=항상, on_breach=SLA 초과 시만, never=표시 안함 */
  dashboardVisibility: "always" | "on_breach" | "never";
}

export const COMPARE_SUBSTATUS_DEFS: Record<string, CompareSubstatusDefinition> = {
  compare_decision_pending: {
    substatus: "compare_decision_pending",
    label: "판정 대기",
    description: "비교 분석 완료, 사용자 판정 대기",
    taskStatus: "REVIEW_NEEDED",
    approvalStatus: "PENDING",
    cta: { label: "판정하기", variant: "default" },
    slaWarningDays: 7,
    staleDays: 30,
    isTerminal: false,
    activityType: "AI_TASK_CREATED",
    escalationMeaning: "판정 7일 이상 지연 — 의사결정 필요",
    scoringBoostOnBreach: 20,
    dashboardVisibility: "always",
  },
  compare_inquiry_followup: {
    substatus: "compare_inquiry_followup",
    label: "문의 후속",
    description: "문의 초안 생성/복사됨, 후속 조치 필요",
    taskStatus: "ACTION_NEEDED",
    approvalStatus: "NOT_REQUIRED",
    cta: { label: "문의 확인", variant: "default" },
    slaWarningDays: 5,
    staleDays: 30,
    isTerminal: false,
    activityType: "COMPARE_INQUIRY_DRAFT_STATUS_CHANGED",
    escalationMeaning: "문의 후속 5일 초과 — 미처리 문의 확인",
    scoringBoostOnBreach: 15,
    dashboardVisibility: "on_breach",
  },
  compare_quote_in_progress: {
    substatus: "compare_quote_in_progress",
    label: "견적 진행",
    description: "연결된 견적이 진행 중 (PENDING/SENT)",
    taskStatus: "WAITING_RESPONSE",
    approvalStatus: "NOT_REQUIRED",
    cta: { label: "견적 확인", variant: "outline" },
    slaWarningDays: 10,
    staleDays: 30,
    isTerminal: false,
    activityType: "QUOTE_DRAFT_STARTED_FROM_COMPARE",
    escalationMeaning: "연결 견적 10일 이상 진행 — 견적 상태 확인",
    scoringBoostOnBreach: 10,
    dashboardVisibility: "on_breach",
  },
  compare_decided: {
    substatus: "compare_decided",
    label: "판정 완료",
    description: "사용자가 APPROVED/HELD/REJECTED 판정 완료",
    taskStatus: "COMPLETED",
    approvalStatus: "APPROVED",
    cta: { label: "", variant: "outline" },
    slaWarningDays: 0,
    staleDays: 0,
    isTerminal: true,
    activityType: "AI_TASK_COMPLETED",
    escalationMeaning: "",
    scoringBoostOnBreach: 0,
    dashboardVisibility: "never",
  },
  compare_reopened: {
    substatus: "compare_reopened",
    label: "재검토",
    description: "터미널 판정 후 UNDECIDED로 재개됨",
    taskStatus: "REVIEW_NEEDED",
    approvalStatus: "PENDING",
    cta: { label: "재검토", variant: "destructive" },
    slaWarningDays: 3,
    staleDays: 30,
    isTerminal: false,
    activityType: "COMPARE_SESSION_REOPENED",
    escalationMeaning: "재검토 3일 초과 — 즉시 재판정 필요",
    scoringBoostOnBreach: 25,
    dashboardVisibility: "always",
  },
};

// ── CTA Map (substatus → action label) ──

export const COMPARE_CTA_MAP: Record<string, { label: string; variant: "default" | "destructive" | "outline" }> = Object.fromEntries(
  Object.values(COMPARE_SUBSTATUS_DEFS)
    .filter((d) => !d.isTerminal)
    .map((d) => [d.substatus, d.cta])
);

// ── Pure Substatus Determination ──

export interface CompareSubstatusInput {
  inquiryDrafts: { status: string }[];
  linkedQuoteStatuses: string[];
  isReopened: boolean;
}

/**
 * 비교 세션의 현재 상태에서 적절한 substatus를 결정합니다.
 *
 * 우선순위:
 * 1. 재개됨 → compare_reopened
 * 2. 활성 견적 (PENDING/SENT) → compare_quote_in_progress
 * 3. 활성 문의 (GENERATED/COPIED) → compare_inquiry_followup
 * 4. 기본 → compare_decision_pending
 */
export function determineCompareSubstatus(input: CompareSubstatusInput): string {
  const { inquiryDrafts, linkedQuoteStatuses, isReopened } = input;

  if (isReopened) {
    return "compare_reopened";
  }

  const hasActiveQuote = linkedQuoteStatuses.some(
    (s) => s === "PENDING" || s === "SENT"
  );
  if (hasActiveQuote) {
    return "compare_quote_in_progress";
  }

  const hasActiveInquiry = inquiryDrafts.some(
    (d) => d.status === "GENERATED" || d.status === "COPIED"
  );
  if (hasActiveInquiry) {
    return "compare_inquiry_followup";
  }

  return "compare_decision_pending";
}

/**
 * substatus가 비교 도메인의 터미널 상태인지 확인합니다.
 */
export function isCompareTerminal(substatus: string): boolean {
  return COMPARE_SUBSTATUS_DEFS[substatus]?.isTerminal ?? false;
}

/**
 * substatus가 비교 도메인 substatus인지 확인합니다.
 */
export function isCompareSubstatus(substatus: string): boolean {
  return substatus in COMPARE_SUBSTATUS_DEFS;
}

// ── SLA Escalation Checks ──

/**
 * substatus의 SLA 경고 임계값을 초과했는지 확인합니다.
 */
export function isSlaBreach(substatus: string, ageDays: number): boolean {
  const def = COMPARE_SUBSTATUS_DEFS[substatus];
  if (!def || def.isTerminal) return false;
  return def.slaWarningDays > 0 && ageDays >= def.slaWarningDays;
}

/**
 * substatus의 장기 미처리(stale) 임계값을 초과했는지 확인합니다.
 */
export function isStale(substatus: string, ageDays: number): boolean {
  const def = COMPARE_SUBSTATUS_DEFS[substatus];
  if (!def || def.isTerminal) return false;
  return def.staleDays > 0 && ageDays >= def.staleDays;
}

// ── Resolution Path ──

export type CompareResolutionPath =
  | "direct_decision"
  | "via_inquiry"
  | "via_quote"
  | "via_inquiry_and_quote"
  | "reopened_then_decided";

export interface ResolutionPathInput {
  hasLinkedQuote: boolean;
  hasInquiryDraft: boolean;
  isReopened: boolean;
}

/**
 * 비교 판정의 해결 경로를 결정합니다.
 */
export function determineResolutionPath(input: ResolutionPathInput): CompareResolutionPath {
  if (input.isReopened) return "reopened_then_decided";
  if (input.hasLinkedQuote && input.hasInquiryDraft) return "via_inquiry_and_quote";
  if (input.hasLinkedQuote) return "via_quote";
  if (input.hasInquiryDraft) return "via_inquiry";
  return "direct_decision";
}

/** 해결 경로 → 한국어 라벨 */
export const RESOLUTION_PATH_LABELS: Record<CompareResolutionPath, string> = {
  direct_decision: "직접 판정",
  via_inquiry: "문의 후 판정",
  via_quote: "견적 후 판정",
  via_inquiry_and_quote: "문의+견적 후 판정",
  reopened_then_decided: "재검토 후 판정",
};

// ── Canonical Report Labels ──

/** 운영 리포팅 메트릭 라벨 */
export const COMPARE_REPORT_LABELS = {
  undecidedCount: "판정 대기",
  slaBreachedCount: "SLA 초과",
  inquiryFollowupCount: "문의 후속 필요",
  linkedQuoteCount: "견적 연결",
  avgTurnaroundDays: "평균 판정 소요(일)",
} as const;

/** 문의/견적 관련 에스컬레이션 규칙 정의 */
export const COMPARE_ESCALATION_RULES = {
  inquiry_no_followup: {
    condition: "문의 GENERATED 후 slaWarningDays 내 COPIED/SENT 미전환",
    label: "문의 미처리",
    reportLabel: "문의 생성 후 미처리",
  },
  inquiry_unresolved_long: {
    condition: "문의 COPIED/SENT 후 staleDays 내 세션 미판정",
    label: "문의 발송 후 미해결",
    reportLabel: "문의 발송 후 장기 미해결",
  },
  quote_no_progress: {
    condition: "연결 견적 존재하나 slaWarningDays 내 상태 변경 없음",
    label: "견적 진행 정체",
    reportLabel: "연결 견적 진행 없음",
  },
} as const;

// ── Metric Definition Lock ──

export interface CompareMetricDefinition {
  key: keyof typeof COMPARE_REPORT_LABELS;
  label: string;
  businessMeaning: string;
  inclusionCriteria: string;
  exclusionCriteria: string;
  timeBoundary: string;
  sourceOfTruth: string;
  displayLocations: string[];
}

export const COMPARE_METRIC_DEFINITIONS: CompareMetricDefinition[] = [
  {
    key: "undecidedCount",
    label: COMPARE_REPORT_LABELS.undecidedCount,
    businessMeaning: "UNDECIDED 상태 비교 세션 수 — 사용자 판정이 필요한 항목",
    inclusionCriteria: "compareSession.decisionState = UNDECIDED 또는 null",
    exclusionCriteria: "APPROVED, HELD, REJECTED, 삭제된 세션",
    timeBoundary: "전체 기간 (시간 제한 없음)",
    sourceOfTruth: "CompareSession.decisionState",
    displayLocations: ["dashboard notification", "dashboard priority card"],
  },
  {
    key: "slaBreachedCount",
    label: COMPARE_REPORT_LABELS.slaBreachedCount,
    businessMeaning: "SLA 경고 임계일 초과 활성 큐 아이템 수",
    inclusionCriteria: "AiActionItem: type=COMPARE_DECISION, taskStatus not COMPLETED/FAILED, ageDays >= slaWarningDays",
    exclusionCriteria: "터미널 substatus (compare_decided), COMPLETED/FAILED 아이템",
    timeBoundary: "substatus별 slaWarningDays (7/5/10/3일)",
    sourceOfTruth: "AiActionItem.createdAt + COMPARE_SUBSTATUS_DEFS.slaWarningDays",
    displayLocations: ["dashboard notification", "dashboard priority card"],
  },
  {
    key: "inquiryFollowupCount",
    label: COMPARE_REPORT_LABELS.inquiryFollowupCount,
    businessMeaning: "문의 후속 조치가 필요한 활성 큐 아이템 수",
    inclusionCriteria: "AiActionItem: substatus=compare_inquiry_followup, taskStatus not COMPLETED/FAILED",
    exclusionCriteria: "다른 substatus, 완료/실패 아이템",
    timeBoundary: "전체 기간",
    sourceOfTruth: "AiActionItem.substatus",
    displayLocations: ["dashboard notification"],
  },
  {
    key: "linkedQuoteCount",
    label: COMPARE_REPORT_LABELS.linkedQuoteCount,
    businessMeaning: "견적이 연결된 비교 세션 수 (distinct)",
    inclusionCriteria: "Quote.comparisonId IS NOT NULL, 사용자 소유",
    exclusionCriteria: "comparisonId가 null인 견적",
    timeBoundary: "전체 기간",
    sourceOfTruth: "Quote.comparisonId (distinct)",
    displayLocations: ["dashboard priority card"],
  },
  {
    key: "avgTurnaroundDays",
    label: COMPARE_REPORT_LABELS.avgTurnaroundDays,
    businessMeaning: "최근 판정 완료 세션의 평균 판정 소요일 (createdAt → decidedAt)",
    inclusionCriteria: "CompareSession: decisionState IN (APPROVED, HELD, REJECTED), decidedAt IS NOT NULL",
    exclusionCriteria: "UNDECIDED, decidedAt가 null인 세션",
    timeBoundary: "최근 100건 (decidedAt DESC)",
    sourceOfTruth: "CompareSession.createdAt, CompareSession.decidedAt",
    displayLocations: ["dashboard priority card"],
  },
];

// ── Canonical Inquiry Draft Labels ──

export const INQUIRY_DRAFT_STATUS_LABELS = {
  GENERATED: "생성됨",
  COPIED: "복사됨",
  SENT: "발송됨",
} as const;

export type InquiryDraftStatus = keyof typeof INQUIRY_DRAFT_STATUS_LABELS;

// ── Inquiry Aging ──

export const INQUIRY_AGING_THRESHOLD_DAYS = 3;

/**
 * GENERATED 상태 문의 초안 중 임계일(3일) 이상 경과된 최대 경과일을 반환합니다.
 * 해당 없으면 null.
 */
export function computeInquiryAgingDays(input: {
  inquiryDrafts: { status: string; createdAt: Date | string }[];
}): number | null {
  const now = Date.now();
  const MS_PER_DAY = 86400000;
  let maxAgingDays: number | null = null;

  for (const d of input.inquiryDrafts) {
    if (d.status !== "GENERATED") continue;
    const ageDays = Math.floor((now - new Date(d.createdAt).getTime()) / MS_PER_DAY);
    if (ageDays >= INQUIRY_AGING_THRESHOLD_DAYS) {
      maxAgingDays = Math.max(maxAgingDays ?? 0, ageDays);
    }
  }
  return maxAgingDays;
}

// ── Canonical Activity Labels (UI에서 직접 사용) ──

/** Substatus → Korean activity label. 워크 큐 카드의 1줄 상태 설명. */
export const COMPARE_ACTIVITY_LABELS: Record<string, string> = {
  compare_decision_pending: "비교 분석 완료 — 판정을 내려주세요",
  compare_inquiry_followup: "비교 문의 후속 조치가 필요합니다",
  compare_quote_in_progress: "비교 기반 견적이 진행 중입니다",
  compare_decided: "비교 판정이 완료되었습니다",
  compare_reopened: "비교 판정이 재개되었습니다 — 재검토가 필요합니다",
};

// ── Canonical Conversion Paths ──

export interface CompareConversionPath {
  id: string;
  label: string;
  entryTrigger: string;
  primaryCta: string;
  successCondition: string;
  completionCondition: string;
  activityLogEvent: string;
  reportingImplication: string;
}

export const COMPARE_CONVERSION_PATHS: CompareConversionPath[] = [
  {
    id: "to_quote",
    label: "견적 전환",
    entryTrigger: "UNDECIDED 비교 세션 확인",
    primaryCta: "견적 시작",
    successCondition: "Quote 생성 (comparisonId 연결)",
    completionCondition: "세션 판정 완료 (APPROVED/HELD/REJECTED)",
    activityLogEvent: "QUOTE_DRAFT_STARTED_FROM_COMPARE",
    reportingImplication: "견적 전환율에 포함",
  },
  {
    id: "to_inquiry",
    label: "문의 전환",
    entryTrigger: "비교 분석 결과 확인",
    primaryCta: "문의 작성",
    successCondition: "InquiryDraft 생성 (GENERATED)",
    completionCondition: "세션 판정 완료 (APPROVED/HELD/REJECTED)",
    activityLogEvent: "COMPARE_INQUIRY_DRAFT_STATUS_CHANGED",
    reportingImplication: "문의 후속율에 포함",
  },
  {
    id: "to_decision",
    label: "직접 판정",
    entryTrigger: "비교 분석 결과 확인",
    primaryCta: "판정하기",
    successCondition: "decisionState = APPROVED/HELD/REJECTED",
    completionCondition: "판정 기록 (= successCondition)",
    activityLogEvent: "AI_TASK_COMPLETED",
    reportingImplication: "직접 판정률에 포함",
  },
  {
    id: "to_reopen",
    label: "재검토",
    entryTrigger: "판정 완료 세션 재열기",
    primaryCta: "재검토",
    successCondition: "decisionState → UNDECIDED",
    completionCondition: "세션 재판정 완료",
    activityLogEvent: "COMPARE_SESSION_REOPENED",
    reportingImplication: "재검토율에 포함",
  },
];

// ── No-Movement Detection ──

export const NO_MOVEMENT_THRESHOLD_DAYS = 3;

/**
 * compare_decision_pending 상태에서 문의/견적 없이 3일 이상 경과한 항목의 경과일을 반환합니다.
 * 해당 없으면 null.
 */
export function computeNoMovementDays(input: {
  substatus: string;
  createdAt: Date | string;
  hasInquiry: boolean;
  hasQuote: boolean;
}): number | null {
  if (input.substatus !== "compare_decision_pending") return null;
  if (input.hasInquiry || input.hasQuote) return null;
  const ageDays = Math.floor((Date.now() - new Date(input.createdAt).getTime()) / 86400000);
  return ageDays >= NO_MOVEMENT_THRESHOLD_DAYS ? ageDays : null;
}
