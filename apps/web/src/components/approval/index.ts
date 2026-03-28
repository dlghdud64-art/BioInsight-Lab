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

// Line Delta Primitives
export {
  LineDeltaSummaryStrip, type LineDeltaSummaryStripProps,
  BlockerRowAnnotation, type BlockerRowAnnotationProps,
  SubsetChips, type SubsetChipData, type SubsetChipsProps,
  ThresholdBreachMarker, type ThresholdBreachMarkerProps,
  LineStatusIndicator, type LineStatusIndicatorProps,
} from "./line-delta-primitives";

// Workbenches
export { FireApprovalWorkbench, type FireApprovalWorkbenchProps } from "./fire-approval-workbench";
export { StockReleaseApprovalWorkbench, type StockReleaseApprovalWorkbenchProps } from "./stock-release-approval-workbench";
export { ExceptionApprovalWorkbench, type ExceptionApprovalWorkbenchProps } from "./exception-approval-workbench";
export { VarianceDispositionWorkbench, type VarianceDispositionWorkbenchProps } from "./variance-disposition-workbench";
export { ReceivingWorkbench, type ReceivingWorkbenchProps } from "./receiving-workbench";
export { ReorderTriggerWorkbench, type ReorderTriggerWorkbenchProps } from "./reorder-trigger-workbench";

// Governance Dashboard
export { GovernanceDashboard, type GovernanceDashboardProps } from "./governance-dashboard";

// Policy Explainability Primitives
export {
  PolicyExplanationCard, type PolicyExplanationCardProps,
  WinningScopeBadge, type WinningScopeBadgeProps,
  ApprovalSourceTrace, type ApprovalSourceTraceProps,
  EscalationSourceTrace, type EscalationSourceTraceProps,
  OverriddenRuleList, type OverriddenRuleListProps,
  WhyThisEffectPanel, type WhyThisEffectPanelProps,
} from "./policy-explainability-primitives";
