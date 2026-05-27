/**
 * Compare & Decision Workspace — Operational Communication Contract (P7-4)
 *
 * Track B 설계 문서 #6
 *
 * L6 (운영 커뮤니케이션) 레이어의 데이터 계약.
 * 비교/견적/구매/입고/재고 맥락에서
 * 검토 요청, 승인 요청, 공급사 문의, 이슈 공유를 바로 실행하게 한다.
 *
 * P7-4는 독립 기능이 아니라 워크스페이스의 액션 레이어로 정의됨.
 */

import type { OperationDomain } from "../operations/state-definitions";

// ══════════════════════════════════════════════════════════════════════════════
// 커뮤니케이션 유형
// ══════════════════════════════════════════════════════════════════════════════

export type CommunicationType =
  | "VENDOR_INQUIRY"       // 공급사 문의 이메일 초안
  | "TEAM_REVIEW_REQUEST"  // 연구팀 검토 요청
  | "APPROVAL_REQUEST"     // 승인 요청
  | "ISSUE_SHARE"          // 입고 이슈 공유
  | "REORDER_REVIEW";      // 재발주 검토 요청

export const COMMUNICATION_TYPE_LABELS: Record<CommunicationType, string> = {
  VENDOR_INQUIRY: "공급사 문의",
  TEAM_REVIEW_REQUEST: "검토 요청",
  APPROVAL_REQUEST: "승인 요청",
  ISSUE_SHARE: "이슈 공유",
  REORDER_REVIEW: "재발주 검토",
};

// ══════════════════════════════════════════════════════════════════════════════
// 커뮤니케이션 레코드
// ══════════════════════════════════════════════════════════════════════════════

export interface CommunicationRecord {
  communicationId: string;
  type: CommunicationType;
  state: CommunicationState;

  // Entity 연결
  linkedDomain: OperationDomain;
  linkedEntityId: string;
  compareId?: string | null;       // 비교 맥락이 있는 경우

  // 참여자
  initiatedBy: string;             // actor userId
  recipients: CommunicationRecipient[];

  // 콘텐츠
  subject: string;
  body: string;                    // 초안 텍스트
  attachedDocumentIds: string[];
  attachedCitationIds: string[];   // AI 패널 citation 참조

  // 메타
  organizationId?: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date | null;
}

export type CommunicationState =
  | "DRAFT"        // 초안 생성됨
  | "SENT"         // 발송됨
  | "VIEWED"       // 수신자가 확인
  | "RESPONDED"    // 응답 수신
  | "RESOLVED"     // 해결됨
  | "CANCELLED";   // 취소됨

export const COMMUNICATION_STATE_LABELS: Record<CommunicationState, string> = {
  DRAFT: "초안",
  SENT: "발송됨",
  VIEWED: "확인됨",
  RESPONDED: "응답됨",
  RESOLVED: "해결됨",
  CANCELLED: "취소됨",
};

export interface CommunicationRecipient {
  recipientType: "USER" | "VENDOR" | "TEAM" | "EXTERNAL_EMAIL";
  recipientId?: string | null;
  email?: string | null;
  name: string;
  role?: string | null;
}

// ══════════════════════════════════════════════════════════════════════════════
// V1 기능별 계약
// ══════════════════════════════════════════════════════════════════════════════

/** 공급사 문의 이메일 초안 */
export interface VendorInquiryDraft {
  type: "VENDOR_INQUIRY";
  vendorName: string;
  vendorEmail: string;
  productName: string;
  catalogNumber?: string | null;
  inquiryFields: string[];        // 문의 항목 (가격, 납기, 규격 등)
  compareContext?: {
    compareId: string;
    relevantDiffFields: string[];
  } | null;
  draftEmailBody: string;
}

/** 연구팀 검토 요청 */
export interface TeamReviewRequest {
  type: "TEAM_REVIEW_REQUEST";
  reviewerIds: string[];
  entityDescription: string;      // 무엇을 검토해야 하는지
  reviewContext: string;           // 비교/변경 맥락
  urgency: "NORMAL" | "URGENT";
  dueDate?: Date | null;
}

/** 승인 요청 */
export interface ApprovalRequest {
  type: "APPROVAL_REQUEST";
  approverId: string;
  purchaseRequestId: string;
  justification: string;
  totalAmount?: number | null;
  compareEvidence?: string | null; // 비교 결과 기반 근거
}

/** 입고 이슈 공유 */
export interface IssueShareRequest {
  type: "ISSUE_SHARE";
  restockId: string;
  issueDescription: string;
  affectedItems: string[];
  suggestedAction: string;
  notifyIds: string[];            // 알림 대상
}

/** 재발주 검토 요청 */
export interface ReorderReviewRequest {
  type: "REORDER_REVIEW";
  inventoryId: string;
  productName: string;
  currentQuantity: number;
  safetyStock: number;
  suggestedQuantity: number;
  suggestedVendor?: string | null;
  reviewerIds: string[];
}

// ══════════════════════════════════════════════════════════════════════════════
// 상태 전이와의 연결
// ══════════════════════════════════════════════════════════════════════════════

/**
 * 커뮤니케이션과 상태 전이의 연결 규칙.
 * 특정 커뮤니케이션 완료가 상태 전이를 트리거할 수 있다.
 */
export interface CommunicationTransitionLink {
  communicationType: CommunicationType;
  triggerOnState: CommunicationState;
  targetDomain: OperationDomain;
  targetTransition: {
    fromStatus: string;
    toStatus: string;
  };
  description: string;
}

export const COMMUNICATION_TRANSITION_LINKS: CommunicationTransitionLink[] = [
  {
    communicationType: "APPROVAL_REQUEST",
    triggerOnState: "RESOLVED",
    targetDomain: "PURCHASE",
    targetTransition: { fromStatus: "PENDING", toStatus: "APPROVED" },
    description: "승인 완료 시 구매 요청 승인 상태로 전이",
  },
  {
    communicationType: "VENDOR_INQUIRY",
    triggerOnState: "RESPONDED",
    targetDomain: "QUOTE",
    targetTransition: { fromStatus: "SENT", toStatus: "RESPONDED" },
    description: "공급사 응답 수신 시 견적 상태 업데이트",
  },
  {
    communicationType: "ISSUE_SHARE",
    triggerOnState: "RESOLVED",
    targetDomain: "RECEIVING",
    targetTransition: { fromStatus: "ISSUE", toStatus: "PARTIAL" },
    description: "이슈 해결 시 입고 상태를 PARTIAL로 복원",
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// Activity Log 연결
// ══════════════════════════════════════════════════════════════════════════════

/**
 * 모든 커뮤니케이션은 ActivityLog에 기록된다.
 * entityType = "COMMUNICATION", entityId = communicationId
 */
export const COMMUNICATION_ACTIVITY_LOG_CONTRACT = {
  entityType: "COMMUNICATION",
  activityTypes: {
    created: "AI_TASK_CREATED",
    sent: "EMAIL_SENT",
    reviewed: "QUOTE_DRAFT_REVIEWED",
    resolved: "AI_TASK_COMPLETED",
  },
} as const;
