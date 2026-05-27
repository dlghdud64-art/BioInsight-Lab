// ─────────────────────────────────────────────
// Settings / Admin Policy — View Models & Helper Functions
// ─────────────────────────────────────────────
// 계약(contract) 데이터를 UI 표현용 뷰모델로 변환하는 계층
// - 계약 → 뷰모델 매핑만 수행, 직접 mutation 없음
// - 모든 라벨은 한국어
// ─────────────────────────────────────────────

import type {
  AdminPolicySurfaceContract,
  AdminPolicySurfaceStatus,
  AdminPolicySectionContract,
  AdminPolicySectionStatus,
  AdminPolicyFieldContract,
  AdminPolicyFieldStatus,
  AdminPolicyDraftContract,
  AdminPolicyDraftStatus,
  AdminPolicyPublishStatus,
  AdminPolicyChangeSetContract,
  AdminPolicyValidationIssueContract,
  AdminPolicyImpactAssessmentContract,
  AdminPolicyPublishExecutionContract,
  AdminPolicyAuditEntryContract,
  AdminPolicyLockRuleContract,
  AdminPolicyScopeContract,
  AdminPolicyEditRuleContract,
} from "./settings-admin-policy-contract";

// ─── 뷰모델 인터페이스 ───────────────────────────

/**
 * 정책 표면(surface) 뷰모델
 * - 표면 전체의 요약 상태, 게시 상태, 영향 요약을 UI에 전달
 */
export interface AdminPolicySurfaceVM {
  /** 표면 ID */
  id: string;
  /** 표면 유형 */
  surfaceType: string;
  /** 표면 한국어 라벨 */
  surfaceLabel: string;
  /** 상태 한국어 라벨 */
  statusLabel: string;
  /** 상태 톤 (색상 힌트) */
  statusTone: string;
  /** 버전 요약 (예: "v3 · 2026-03-15 게시") */
  versionSummary: string;
  /** 변경된 섹션 수 */
  dirtySectionCount: number;
  /** 유효성 검증 이슈 수 */
  validationIssueCount: number;
  /** 게시 상태 요약 */
  publishState: {
    label: string;
    tone: "clean" | "drafting" | "review" | "ready" | "blocked";
  };
  /** 잠금 요약 (한국어) */
  lockSummary?: string;
  /** 영향 요약 (예: "승인/재고 정책에 영향") */
  impactSummary?: string;
  /** 권장 다음 행동 */
  recommendedNextAction: { label: string; actionKey: string };
}

/**
 * 정책 섹션 뷰모델
 * - 개별 섹션의 상태, 잠금, 제한, 편집 가능 여부를 UI에 전달
 */
export interface AdminPolicySectionVM {
  /** 섹션 ID */
  id: string;
  /** 섹션 키 */
  sectionKey: string;
  /** 카테고리 한국어 라벨 */
  categoryLabel: string;
  /** 섹션 한국어 라벨 */
  sectionLabel: string;
  /** 섹션 상태 한국어 라벨 */
  sectionStatusLabel: string;
  /** 상태 톤 */
  statusTone: string;
  /** 스코프 요약 (예: "워크스페이스 전체 · 직접 설정") */
  scopeSummary: string;
  /** 필드 완료 요약 (예: "5/7 필드 설정됨") */
  fieldCompletionSummary: string;
  /** 잠금 배지 (있을 경우) */
  lockBadge?: { label: string; lockType: string };
  /** 제한 배지 목록 */
  restrictionBadges: { label: string; type: string }[];
  /** 변경 상태 */
  dirtyState: { isDirty: boolean; dirtyFieldCount: number };
  /** 영향 배지 (있을 경우) */
  impactBadge?: { label: string; riskLevel: string };
  /** 편집 가능 여부 */
  canEdit: boolean;
  /** 편집 차단 사유 */
  blockedReason?: string;
}

/**
 * 정책 필드 뷰모델
 * - 개별 필드의 현재 값, 상속, 유효성, 편집 가능 여부를 UI에 전달
 */
export interface AdminPolicyFieldVM {
  /** 필드 ID */
  id: string;
  /** 필드 키 */
  fieldKey: string;
  /** 필드 한국어 라벨 */
  fieldLabel: string;
  /** 현재 값 요약 */
  currentValueSummary: string;
  /** 기본 값 요약 */
  defaultValueSummary?: string;
  /** 상속 요약 (예: "상위 워크스페이스에서 상속") */
  inheritanceSummary?: string;
  /** 필드 상태 한국어 라벨 */
  fieldStatusLabel: string;
  /** 상태 톤 */
  statusTone: string;
  /** 유효성 검증 요약 (한국어) */
  validationSummary?: string;
  /** 의존성 요약 (한국어) */
  dependencySummary?: string;
  /** 변경 위험 배지 */
  changeRiskBadge?: { label: string; level: string };
  /** 편집 가능 여부 */
  canEdit: boolean;
  /** 편집 차단 사유 */
  blockedReason?: string;
}

/**
 * 초안 요약 뷰모델
 * - 초안의 전체 상태를 요약하여 게시 준비도를 판단
 */
export interface AdminPolicyDraftSummaryVM {
  /** 변경된 섹션 수 */
  dirtySectionCount: number;
  /** 변경된 필드 수 */
  dirtyFieldCount: number;
  /** 차단 이슈 수 */
  blockingIssueCount: number;
  /** 경고 이슈 수 */
  warningIssueCount: number;
  /** 게시 준비도 */
  publishReadiness: "ready" | "needs_review" | "blocked";
  /** 고영향 변경 수 */
  highImpactChangeCount: number;
  /** 승인 필요 변경 수 */
  requiresApprovalChangeCount: number;
  /** 롤백 가능 여부 */
  rollbackAvailable: boolean;
  /** 권장 다음 행동 */
  recommendedNextAction: { label: string; actionKey: string };
}

/**
 * 영향 평가 뷰모델
 * - 변경에 따른 하류 모듈 영향을 시각적으로 표현
 */
export interface AdminPolicyImpactVM {
  /** 영향 받는 모듈 배지 목록 */
  affectedModuleBadges: { module: string; label: string }[];
  /** 영향 유형 한국어 라벨 */
  impactTypeLabel: string;
  /** 위험 수준 한국어 라벨 */
  riskLevelLabel: string;
  /** 위험 수준 톤 */
  riskTone: string;
  /** 적용 전 확인 필요 여부 */
  requiresConfirmation: boolean;
  /** 영향 요약 (한국어) */
  impactSummary: string;
  /** 고위험 사유 요약 (한국어) */
  highRiskReasonSummary?: string;
}

/**
 * 게시 실행 뷰모델
 * - 게시 프로세스의 각 단계 완료 상태를 UI에 전달
 */
export interface AdminPolicyPublishExecutionVM {
  /** 게시 상태 한국어 라벨 */
  publishStatusLabel: string;
  /** 게시 상태 톤 */
  publishTone: string;
  /** 제출자 이름 */
  submittedByName: string;
  /** 검토 상태 */
  reviewState: { label: string; isDone: boolean };
  /** 승인 상태 */
  approvalState: { label: string; isDone: boolean };
  /** 게시 상태 */
  publishState: { label: string; isDone: boolean };
  /** 롤백 상태 */
  rollbackState: { label: string; isAvailable: boolean };
  /** 차단 사유 */
  blockedReason?: string;
  /** 다음 담당자 */
  nextOwner?: string;
}

/**
 * 감사 추적 뷰모델
 * - 감사 로그 항목을 UI 표시용으로 변환
 */
export interface AdminPolicyAuditTrailVM {
  /** 항목 ID */
  id: string;
  /** 행위 한국어 라벨 */
  actionLabel: string;
  /** 행위자 이름 */
  actorName: string;
  /** 행위 일시 한국어 라벨 */
  actedAtLabel: string;
  /** 변경 요약 (한국어) */
  changeSummary: string;
  /** 민감 변경 배지 */
  sensitiveChangeBadge?: string;
  /** MFA 인증 라벨 */
  mfaVerifiedLabel?: string;
  /** 관련 버전 요약 */
  relatedVersionSummary?: string;
}

/**
 * 의사결정 요약 뷰모델
 * - 저장/게시/하류 영향 준비도를 종합하여 다음 행동을 안내
 */
export interface AdminPolicyDecisionSummaryVM {
  /** 저장 준비도 */
  saveReadiness: "ready" | "needs_review" | "blocked";
  /** 게시 준비도 */
  publishReadiness: "ready" | "needs_review" | "blocked";
  /** 하류 영향 준비도 */
  downstreamImpactReadiness: "ready" | "partial" | "blocked";
  /** 차단 이슈 수 */
  openBlockingIssueCount: number;
  /** 경고 이슈 수 */
  openWarningIssueCount: number;
  /** 잠금 섹션 수 */
  lockedSectionCount: number;
  /** 고위험 영향 수 */
  highRiskImpactCount: number;
  /** 권장 다음 행동 */
  recommendedNextAction: { label: string; actionKey: string };
  /** 권장 다음 담당자 */
  recommendedNextOwner?: string;
}

/**
 * 설정/관리 정책 페이지 최상위 뷰모델
 * - 페이지 전체의 표면, 섹션, 필드, 초안, 게시, 감사, 의사결정을 통합
 */
export interface AdminPolicyPageViewModel {
  /** 페이지 헤더 */
  header: {
    title: string;
    purposeDescription: string;
    surfaceLabel: string;
  };
  /** 표면 뷰모델 */
  surface: AdminPolicySurfaceVM;
  /** 섹션 뷰모델 목록 */
  sections: AdminPolicySectionVM[];
  /** 선택된 섹션의 필드 및 영향 평가 */
  selectedSection?: {
    fields: AdminPolicyFieldVM[];
    impactAssessment?: AdminPolicyImpactVM;
  };
  /** 초안 요약 뷰모델 */
  draftSummary?: AdminPolicyDraftSummaryVM;
  /** 게시 실행 뷰모델 */
  publishExecution?: AdminPolicyPublishExecutionVM;
  /** 감사 추적 뷰모델 목록 */
  auditTrail: AdminPolicyAuditTrailVM[];
  /** 의사결정 요약 */
  decision: AdminPolicyDecisionSummaryVM;
  /** 페이지 상태 */
  pageState: {
    isEmpty: boolean;
    hasError: boolean;
    isUnavailable: boolean;
  };
}

// ─── 헬퍼 함수 ─────────────────────────────────

/**
 * 저장 준비도 계산
 * - 초안의 변경 사항과 유효성 검증 이슈를 기반으로 저장 가능 여부를 판단
 * @param draft 초안 계약
 * @param validationIssues 유효성 검증 이슈 목록
 * @returns 저장 준비도와 차단 사유 목록
 */
export function resolveSaveReadiness(
  draft: AdminPolicyDraftContract,
  validationIssues: AdminPolicyValidationIssueContract[],
): { readiness: "ready" | "needs_review" | "blocked"; blockers: string[] } {
  const blockers: string[] = [];

  // 변경 사항이 없으면 차단
  if (draft.dirtyFieldIds.length === 0 && draft.dirtySectionIds.length === 0) {
    blockers.push("변경 사항 없음");
  }

  // 차단 수준 유효성 검증 이슈가 있으면 차단
  const blockingIssues = validationIssues.filter((i) => i.blocking);
  if (blockingIssues.length > 0) {
    blockers.push(`차단 이슈 ${blockingIssues.length}건`);
  }

  if (blockers.length > 0) {
    return { readiness: "blocked", blockers };
  }

  // 승인 필요 변경이 있으면 검토 필요
  const hasApprovalRequired = draft.changeSet.some((c) => c.requiresReview);
  const hasHighImpact = draft.changeSet.some(
    (c) => c.impactLevel === "high" || c.impactLevel === "critical",
  );

  if (hasApprovalRequired || hasHighImpact) {
    return { readiness: "needs_review", blockers: [] };
  }

  return { readiness: "ready", blockers: [] };
}

/**
 * 게시 준비도 계산
 * - 초안, 게시 실행 상태, 유효성 검증 이슈를 기반으로 게시 가능 여부를 판단
 * @param draft 초안 계약
 * @param execution 게시 실행 계약 (있을 경우)
 * @param validationIssues 유효성 검증 이슈 목록 (있을 경우)
 * @returns 게시 준비도와 차단 사유 목록
 */
export function resolvePublishReadiness(
  draft: AdminPolicyDraftContract,
  execution?: AdminPolicyPublishExecutionContract,
  validationIssues?: AdminPolicyValidationIssueContract[],
): { readiness: "ready" | "needs_review" | "blocked"; blockers: string[] } {
  const blockers: string[] = [];

  // 초안 상태 확인
  if (draft.status === "discarded") {
    blockers.push("초안이 폐기됨");
    return { readiness: "blocked", blockers };
  }

  if (draft.status === "publish_blocked") {
    blockers.push("게시 차단 상태");
    return { readiness: "blocked", blockers };
  }

  // 차단 유효성 검증 이슈
  if (validationIssues) {
    const blockingIssues = validationIssues.filter((i) => i.blocking);
    if (blockingIssues.length > 0) {
      blockers.push(`차단 이슈 ${blockingIssues.length}건`);
    }
  }

  // 게시 실행이 차단된 경우
  if (execution && execution.status === "blocked") {
    blockers.push(
      ...execution.blockedReasons.map((r) => `게시 차단: ${r}`),
    );
  }

  // 승인 필요 변경이 승인되지 않은 경우
  const hasApprovalRequired = draft.changeSet.some((c) => c.requiresReview);
  if (
    hasApprovalRequired &&
    draft.status !== "approved" &&
    (!execution || execution.status !== "approved")
  ) {
    blockers.push("승인 필요 변경이 미승인 상태");
  }

  if (blockers.length > 0) {
    return { readiness: "blocked", blockers };
  }

  // 고영향 변경이 검토 대기 중인 경우
  const hasHighImpact = draft.changeSet.some(
    (c) => c.impactLevel === "high" || c.impactLevel === "critical",
  );
  if (hasHighImpact && draft.status !== "approved") {
    return { readiness: "needs_review", blockers: [] };
  }

  return { readiness: "ready", blockers: [] };
}

/**
 * 필드 편집 가능 여부 계산
 * - 섹션의 잠금·편집 규칙, 필드 상태, 사용자 역할을 종합 판단
 * @param field 필드 계약
 * @param section 소속 섹션 계약
 * @param userRole 현재 사용자 역할
 * @returns 편집 가능 여부와 차단 사유
 */
export function resolveFieldEditability(
  field: AdminPolicyFieldContract,
  section: AdminPolicySectionContract,
  userRole: string,
): { canEdit: boolean; blockedReason?: string } {
  // 섹션 잠금 확인
  if (section.lockRule?.isLocked) {
    return {
      canEdit: false,
      blockedReason: `섹션 잠금: ${section.lockRule.lockType}`,
    };
  }

  // 섹션 상태 확인
  if (
    section.status === "locked" ||
    section.status === "read_only" ||
    section.status === "hidden"
  ) {
    return {
      canEdit: false,
      blockedReason: `섹션 상태: ${section.status}`,
    };
  }

  // 플랜 제한 확인
  if (section.status === "plan_restricted") {
    return {
      canEdit: false,
      blockedReason: "현재 플랜에서 제한된 설정",
    };
  }

  // 편집 역할 확인
  if (!section.editRule.editableByRoles.includes(userRole)) {
    return {
      canEdit: false,
      blockedReason: "현재 역할로 편집 불가",
    };
  }

  // 소유자 역할 필수 확인
  if (section.editRule.requiresOwnerRole && userRole !== "OWNER") {
    return {
      canEdit: false,
      blockedReason: "소유자 역할 필요",
    };
  }

  // 필드 상태 확인
  if (field.status === "locked") {
    return {
      canEdit: false,
      blockedReason: "필드 잠금 상태",
    };
  }

  return { canEdit: true };
}

/**
 * 섹션 상태에 따른 톤 매핑
 * @param status 섹션 상태
 * @returns 톤 문자열 (neutral, warning, muted, info)
 */
export function resolveSectionStatusTone(
  status: AdminPolicySectionStatus,
): string {
  switch (status) {
    case "active":
      return "neutral";
    case "locked":
      return "warning";
    case "read_only":
      return "muted";
    case "plan_restricted":
      return "info";
    case "hidden":
      return "muted";
    case "draft_changed":
      return "info";
    default:
      return "neutral";
  }
}

/**
 * 초안 요약 뷰모델 계산
 * - 초안의 변경, 유효성 검증 이슈, 영향 평가를 집계하여 요약 생성
 * @param draft 초안 계약
 * @param validationIssues 유효성 검증 이슈 목록
 * @param impacts 영향 평가 목록
 * @returns 초안 요약 뷰모델
 */
export function calculateDraftSummary(
  draft: AdminPolicyDraftContract,
  validationIssues: AdminPolicyValidationIssueContract[],
  impacts: AdminPolicyImpactAssessmentContract[],
): AdminPolicyDraftSummaryVM {
  const blockingIssueCount = validationIssues.filter((i) => i.blocking).length;
  const warningIssueCount = validationIssues.filter(
    (i) => !i.blocking && (i.severity === "warning" || i.severity === "info"),
  ).length;

  const highImpactChangeCount = draft.changeSet.filter(
    (c) => c.impactLevel === "high" || c.impactLevel === "critical",
  ).length;
  const requiresApprovalChangeCount = draft.changeSet.filter(
    (c) => c.requiresReview,
  ).length;

  const hasBlockers = blockingIssueCount > 0;
  const needsReview = requiresApprovalChangeCount > 0 || highImpactChangeCount > 0;

  let publishReadiness: "ready" | "needs_review" | "blocked";
  if (hasBlockers || draft.dirtyFieldIds.length === 0) {
    publishReadiness = "blocked";
  } else if (needsReview) {
    publishReadiness = "needs_review";
  } else {
    publishReadiness = "ready";
  }

  const hasHighRiskImpact = impacts.some(
    (i) => i.riskLevel === "high" || i.riskLevel === "critical",
  );

  let recommendedNextAction: { label: string; actionKey: string };
  if (hasBlockers) {
    recommendedNextAction = {
      label: "차단 이슈 해결 필요",
      actionKey: "resolve_blockers",
    };
  } else if (needsReview) {
    recommendedNextAction = {
      label: "변경 사항 검토 요청",
      actionKey: "request_review",
    };
  } else if (hasHighRiskImpact) {
    recommendedNextAction = {
      label: "영향 평가 확인",
      actionKey: "review_impact",
    };
  } else {
    recommendedNextAction = {
      label: "게시 준비 완료",
      actionKey: "publish",
    };
  }

  return {
    dirtySectionCount: draft.dirtySectionIds.length,
    dirtyFieldCount: draft.dirtyFieldIds.length,
    blockingIssueCount,
    warningIssueCount,
    publishReadiness,
    highImpactChangeCount,
    requiresApprovalChangeCount,
    rollbackAvailable: draft.status === "published",
    recommendedNextAction,
  };
}

/**
 * 하류 영향 준비도 계산
 * - 영향 평가 목록을 기반으로 하류 모듈 적용 가능 여부를 판단
 * @param impacts 영향 평가 목록
 * @returns 준비도와 차단 사유 목록
 */
export function resolveDownstreamImpactReadiness(
  impacts: AdminPolicyImpactAssessmentContract[],
): { readiness: "ready" | "partial" | "blocked"; blockers: string[] } {
  const blockers: string[] = [];

  // critical 위험이 있으면 차단
  const criticalImpacts = impacts.filter((i) => i.riskLevel === "critical");
  if (criticalImpacts.length > 0) {
    for (const impact of criticalImpacts) {
      blockers.push(
        `치명적 위험: ${impact.affectedModules.join(", ")} 모듈 영향`,
      );
    }
    return { readiness: "blocked", blockers };
  }

  // high 위험 + 확인 필요 시 부분 차단
  const highRiskNeedingConfirmation = impacts.filter(
    (i) => i.riskLevel === "high" && i.requiresConfirmation,
  );
  if (highRiskNeedingConfirmation.length > 0) {
    for (const impact of highRiskNeedingConfirmation) {
      blockers.push(
        `고위험 확인 필요: ${impact.affectedModules.join(", ")} 모듈`,
      );
    }
    return { readiness: "partial", blockers };
  }

  return { readiness: "ready", blockers: [] };
}
