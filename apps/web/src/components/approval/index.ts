/**
 * Approval UI Primitives — barrel export
 *
 * 모든 approval/policy workbench에서 사용하는 공통 컴포넌트.
 * engine output을 UI로 정확히 번역하는 것이 목적.
 * 이 컴포넌트들이 policy truth를 재판정하지 않음.
 */

export { PolicyStatusBadge, type PolicyStatusBadgeProps } from "./policy-status-badge";
export { PolicyMessageStack, type PolicyMessageStackProps } from "./policy-message-stack";
export { ApproverRequirementCard, type ApproverRequirementCardProps } from "./approver-requirement-card";
export { ReapprovalBanner, type ReapprovalBannerProps } from "./reapproval-banner";
export { NextActionHint, type NextActionHintProps } from "./next-action-hint";
