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

// ── Canonical Activity Labels (UI에서 직접 사용) ──

/** Substatus → Korean activity label. 워크 큐 카드의 1줄 상태 설명. */
export const COMPARE_ACTIVITY_LABELS: Record<string, string> = {
  compare_decision_pending: "비교 분석 완료 — 판정을 내려주세요",
  compare_inquiry_followup: "비교 문의 후속 조치가 필요합니다",
  compare_quote_in_progress: "비교 기반 견적이 진행 중입니다",
  compare_decided: "비교 판정이 완료되었습니다",
  compare_reopened: "비교 판정이 재개되었습니다 — 재검토가 필요합니다",
};
