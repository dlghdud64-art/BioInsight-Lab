/**
 * A-6. Work Queue Task Generation — 매핑 테이블
 *
 * Verification 상태 × DocumentType 조합에 따라
 * 어떤 Work Queue Task를 생성할지 결정하는 정적 매핑 규칙입니다.
 *
 * ⚠️ 중복 방지: dedupKey 필드 조합 + windowHours 내 동일 키가 존재하면 생성 건너뜀
 */

import type { WorkQueueTaskMapping } from "./types";

/**
 * 정적 매핑 테이블 — Verification 상태별 Work Queue Task 생성 규칙
 *
 * 순서대로 평가하며, 첫 번째 매칭되는 규칙을 적용합니다.
 * documentType이 지정되지 않은 규칙은 해당 verificationStatus의 모든 문서에 적용됩니다.
 */
export const TASK_MAPPING_TABLE: readonly WorkQueueTaskMapping[] = [
  // ── MISMATCH: 문서 간 핵심 필드 불일치 ──
  {
    trigger: { verificationStatus: "MISMATCH", documentType: "INVOICE" },
    task: {
      type: "STATUS_CHANGE_SUGGEST",
      taskType: "DOCUMENT_MISMATCH",
      taskStatus: "ACTION_NEEDED",
      approvalStatus: "PENDING",
      priority: "HIGH",
      titleTemplate: "인보이스 불일치: {{vendorName}} — ₩{{amount}} 차이",
      summaryTemplate: "{{mismatchedFields}} 필드에서 불일치가 감지되었습니다. 확인이 필요합니다.",
    },
    dedupKey: { fields: ["linkedEntityId", "DOCUMENT_MISMATCH"], windowHours: 48 },
  },
  {
    trigger: { verificationStatus: "MISMATCH" },
    task: {
      type: "STATUS_CHANGE_SUGGEST",
      taskType: "DOCUMENT_MISMATCH",
      taskStatus: "REVIEW_NEEDED",
      approvalStatus: "NOT_REQUIRED",
      priority: "MEDIUM",
      titleTemplate: "문서 불일치 검토: {{vendorName}}",
      summaryTemplate: "{{mismatchedFields}} 필드에서 불일치가 감지되었습니다.",
    },
    dedupKey: { fields: ["linkedEntityId", "DOCUMENT_MISMATCH"], windowHours: 48 },
  },

  // ── MISSING: 필수 문서/필드 누락 ──
  {
    trigger: { verificationStatus: "MISSING", documentType: "INVOICE" },
    task: {
      type: "STATUS_CHANGE_SUGGEST",
      taskType: "INVOICE_MISSING",
      taskStatus: "ACTION_NEEDED",
      approvalStatus: "NOT_REQUIRED",
      priority: "HIGH",
      titleTemplate: "세금계산서 누락: {{vendorName}} 주문 #{{orderNumber}}",
      summaryTemplate: "해당 주문에 대한 세금계산서가 아직 수신되지 않았습니다.",
    },
    dedupKey: { fields: ["linkedEntityId", "INVOICE_MISSING"], windowHours: 72 },
  },
  {
    trigger: { verificationStatus: "MISSING" },
    task: {
      type: "STATUS_CHANGE_SUGGEST",
      taskType: "PURCHASE_EVIDENCE_REVIEW",
      taskStatus: "REVIEW_NEEDED",
      approvalStatus: "NOT_REQUIRED",
      priority: "MEDIUM",
      titleTemplate: "증빙 서류 누락: {{vendorName}}",
      summaryTemplate: "{{missingFields}} 항목이 누락되었습니다.",
    },
    dedupKey: { fields: ["linkedEntityId", "PURCHASE_EVIDENCE_REVIEW"], windowHours: 48 },
  },

  // ── REVIEW_NEEDED: 수동 검토 필요 ──
  {
    trigger: { verificationStatus: "REVIEW_NEEDED", documentType: "VENDOR_REPLY" },
    task: {
      type: "VENDOR_RESPONSE_PARSED",
      taskType: "VENDOR_REPLY_REVIEW",
      taskStatus: "REVIEW_NEEDED",
      approvalStatus: "NOT_REQUIRED",
      priority: "MEDIUM",
      titleTemplate: "벤더 회신 검토: {{vendorName}}",
      summaryTemplate: "벤더 회신이 자동 연결되었으나 일부 항목의 확인이 필요합니다.",
    },
    dedupKey: { fields: ["linkedEntityId", "VENDOR_REPLY_REVIEW"], windowHours: 24 },
  },
  {
    trigger: { verificationStatus: "REVIEW_NEEDED", documentType: "DELIVERY_UPDATE" },
    task: {
      type: "STATUS_CHANGE_SUGGEST",
      taskType: "DELIVERY_UPDATE_REVIEW",
      taskStatus: "REVIEW_NEEDED",
      approvalStatus: "NOT_REQUIRED",
      priority: "MEDIUM",
      titleTemplate: "배송 상태 변경 검토: {{vendorName}}",
      summaryTemplate: "배송/납기 정보가 변경되었습니다. 확인이 필요합니다.",
    },
    dedupKey: { fields: ["linkedEntityId", "DELIVERY_UPDATE_REVIEW"], windowHours: 24 },
  },
  {
    trigger: { verificationStatus: "REVIEW_NEEDED" },
    task: {
      type: "STATUS_CHANGE_SUGGEST",
      taskType: "PURCHASE_EVIDENCE_REVIEW",
      taskStatus: "REVIEW_NEEDED",
      approvalStatus: "NOT_REQUIRED",
      priority: "LOW",
      titleTemplate: "증빙 검토: {{vendorName}} — {{documentType}}",
      summaryTemplate: "자동 검증이 불확실하여 수동 확인이 필요합니다.",
    },
    dedupKey: { fields: ["linkedEntityId", "PURCHASE_EVIDENCE_REVIEW"], windowHours: 48 },
  },

  // ── POLICY FLAG: 예산 초과 시 별도 Task ──
  {
    trigger: { verificationStatus: "AUTO_VERIFIED", policyFlag: "budgetExceeded" },
    task: {
      type: "STATUS_CHANGE_SUGGEST",
      taskType: "PURCHASE_EVIDENCE_REVIEW",
      taskStatus: "BLOCKED",
      approvalStatus: "PENDING",
      priority: "HIGH",
      titleTemplate: "예산 초과 승인 필요: {{vendorName}} — ₩{{amount}}",
      summaryTemplate: "자동 검증은 통과했으나 예산 임계치를 초과하여 승인이 필요합니다.",
    },
    dedupKey: { fields: ["linkedEntityId", "BUDGET_EXCEEDED"], windowHours: 72 },
  },
] as const;

/**
 * Verification 결과에 매칭되는 Task Mapping 규칙을 찾습니다.
 *
 * @param verificationStatus - Verification 판정 상태
 * @param documentType - 문서 유형 (optional)
 * @param policyFlags - Policy Hook 신호 (optional)
 * @returns 매칭된 매핑 규칙 또는 null (AUTO_VERIFIED + 정책 플래그 없음 = Task 미생성)
 */
export function findTaskMapping(
  verificationStatus: string,
  documentType?: string,
  policyFlags?: Record<string, unknown>,
): WorkQueueTaskMapping | null {
  for (const mapping of TASK_MAPPING_TABLE) {
    const { trigger } = mapping;

    // verificationStatus 매칭
    if (trigger.verificationStatus !== verificationStatus) continue;

    // documentType 필터 (지정된 경우에만)
    if (trigger.documentType && trigger.documentType !== documentType) continue;

    // policyFlag 필터 (지정된 경우에만)
    if (trigger.policyFlag && (!policyFlags || !policyFlags[trigger.policyFlag])) continue;

    return mapping;
  }

  return null; // AUTO_VERIFIED + 정책 플래그 없음 → Task 미생성 (정상 흐름)
}

/**
 * 중복 방지 키를 생성합니다.
 *
 * @param mapping - 적용할 매핑 규칙
 * @param context - 키 생성에 필요한 컨텍스트 값
 * @returns 중복 체크에 사용할 복합 키 문자열
 */
export function buildDedupKey(
  mapping: WorkQueueTaskMapping,
  context: Record<string, string>,
): string {
  return mapping.dedupKey.fields
    .map((field) => context[field] ?? "UNKNOWN")
    .join("::");
}
