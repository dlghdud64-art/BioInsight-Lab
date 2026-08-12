"use client";

/**
 * Approval / Policy TanStack Query Hooks
 *
 * 원칙:
 * - query = engine projection fetch (truth는 engine output)
 * - mutation = approval action execution only
 * - optimistic unlock 금지 — mutation success 후에만 상태 변경
 * - stale handoff 시 invalidate + refetch 강제
 * - URL state는 view/selection만 책임
 *
 * QUERY KEY FACTORY:
 * - APPROVAL_KEYS.policySurface(workspaceKey, caseId) — workspace별 policy surface
 * - APPROVAL_KEYS.inbox(filters) — approval inbox projection
 * - APPROVAL_KEYS.inboxSummary() — inbox summary
 * - APPROVAL_KEYS.workbench(domain, sessionId) — domain workbench state
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  buildWorkspacePolicySurface,
  buildAllWorkspacePolicySurfaces,
  buildCasePolicySummary,
  type WorkspacePolicySurfaceResult,
  type CasePolicySummary,
} from "@/lib/ai/policy-surface-registry-engine";
import {
  projectApprovalInbox,
  computeInboxSummary,
  type ApprovalInboxSource,
  type ApprovalInboxItemV2,
  type ApprovalInboxSummaryV2,
  type ApprovalDomain,
} from "@/lib/ai/approval-inbox-projection-v2-engine";
import {
  rankApprovalInboxItems,
  type RankedApprovalItemV2,
} from "@/lib/ai/approval-priority-ranking-v2-engine";
import type { ActorContext, PolicyEvaluationContext } from "@/lib/ai/dispatch-v2-permission-policy-engine";
import type { ApprovalSnapshotV2 } from "@/lib/ai/dispatch-v2-approval-workbench-engine";
import type { ConsumeGuardResult } from "@/lib/ai/approval-snapshot-validator";

// ══════════════════════════════════════════════
// Query Key Factory
// ══════════════════════════════════════════════

export const APPROVAL_KEYS = {
  all: ["approval"] as const,
  policySurface: (workspaceKey: string, caseId: string) =>
    ["approval", "policy-surface", workspaceKey, caseId] as const,
  allPolicySurfaces: (caseId: string) =>
    ["approval", "all-policy-surfaces", caseId] as const,
  casePolicySummary: (caseId: string) =>
    ["approval", "case-policy-summary", caseId] as const,
  inbox: (filters?: Record<string, string>) =>
    ["approval", "inbox", filters || {}] as const,
  inboxSummary: () =>
    ["approval", "inbox-summary"] as const,
  inboxRanked: (filters?: Record<string, string>) =>
    ["approval", "inbox-ranked", filters || {}] as const,
  workbench: (domain: ApprovalDomain, sessionId: string) =>
    ["approval", "workbench", domain, sessionId] as const,
};

// ══════════════════════════════════════════════
// Policy Surface Hooks
// ══════════════════════════════════════════════

/**
 * useWorkspacePolicySurface — 특정 workspace의 policy surface 조회
 *
 * 운영자가 작업면에 진입할 때 자동으로 policy 상태를 로드.
 * engine output을 그대로 반환 — UI에서 재판정 금지.
 */
export function useWorkspacePolicySurface(
  workspaceKey: string,
  actor: ActorContext | null,
  caseId: string,
  policyContext: Partial<PolicyEvaluationContext> = {},
  snapshot: ApprovalSnapshotV2 | null = null,
  consumeGuardResult: ConsumeGuardResult | null = null,
) {
  return useQuery({
    queryKey: APPROVAL_KEYS.policySurface(workspaceKey, caseId),
    queryFn: (): WorkspacePolicySurfaceResult => {
      if (!actor) {
        return {
          found: false,
          workspaceKey,
          config: null,
          permissionResult: null,
          policySurface: null,
          inlineGuidance: {
            statusBadge: "unknown" as const,
            statusColor: "slate" as const,
            primaryMessage: "인증 정보 없음",
            blockerMessages: [],
            warningMessages: [],
            nextActionMessage: "",
            approverInfo: null,
          },
        };
      }
      return buildWorkspacePolicySurface(
        workspaceKey, actor, caseId, policyContext, snapshot, consumeGuardResult
      );
    },
    enabled: !!actor && !!caseId,
    staleTime: 3 * 60 * 1000, // 3분
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * useCasePolicySummary — 케이스 전체의 policy surface summary
 */
export function useCasePolicySummary(
  actor: ActorContext | null,
  caseId: string,
  policyContext: Partial<PolicyEvaluationContext> = {},
) {
  return useQuery({
    queryKey: APPROVAL_KEYS.casePolicySummary(caseId),
    queryFn: (): CasePolicySummary => {
      if (!actor) {
        return {
          caseId,
          totalWorkspaces: 0,
          allowedCount: 0,
          approvalNeededCount: 0,
          blockedCount: 0,
          reapprovalNeededCount: 0,
          escalationNeededCount: 0,
          workspaceSummaries: [],
          generatedAt: new Date().toISOString(),
        };
      }
      const surfaces = buildAllWorkspacePolicySurfaces(actor, caseId, policyContext);
      return buildCasePolicySummary(surfaces, caseId);
    },
    enabled: !!actor && !!caseId,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// ══════════════════════════════════════════════
// Approval Inbox Hooks
// ══════════════════════════════════════════════

/**
 * useApprovalInbox — 승인 대기 inbox 조회 + ranking
 *
 * sources는 서버에서 fetch → 여기서 projection + ranking.
 * staleTime 짧게 (1분) — inbox는 실시간에 가깝게 유지.
 */
export function useApprovalInbox(sources: ApprovalInboxSource[]) {
  return useQuery({
    queryKey: APPROVAL_KEYS.inbox(),
    queryFn: (): { items: ApprovalInboxItemV2[]; ranked: RankedApprovalItemV2[]; summary: ApprovalInboxSummaryV2 } => {
      const now = new Date();
      const items = projectApprovalInbox(sources, now);
      const ranked = rankApprovalInboxItems(items, now);
      const summary = computeInboxSummary(items);
      return { items, ranked, summary };
    },
    staleTime: 1 * 60 * 1000, // 1분
    gcTime: 5 * 60 * 1000,
  });
}

// ══════════════════════════════════════════════
// Invalidation Helpers
// ══════════════════════════════════════════════

/**
 * useApprovalInvalidation — mutation 후 관련 query 강제 refetch
 *
 * approval action 실행 후 반드시 호출.
 * optimistic update 금지 — invalidate + refetch로 truth 재로드.
 */
export function useApprovalInvalidation() {
  const queryClient = useQueryClient();

  return {
    /** 특정 workspace policy surface invalidate */
    invalidatePolicySurface: (workspaceKey: string, caseId: string) => {
      queryClient.invalidateQueries({ queryKey: APPROVAL_KEYS.policySurface(workspaceKey, caseId) });
    },
    /** 케이스 전체 policy summary invalidate */
    invalidateCaseSummary: (caseId: string) => {
      queryClient.invalidateQueries({ queryKey: APPROVAL_KEYS.casePolicySummary(caseId) });
    },
    /** Inbox 전체 invalidate */
    invalidateInbox: () => {
      queryClient.invalidateQueries({ queryKey: APPROVAL_KEYS.inbox() });
    },
    /** 특정 workbench invalidate */
    invalidateWorkbench: (domain: ApprovalDomain, sessionId: string) => {
      queryClient.invalidateQueries({ queryKey: APPROVAL_KEYS.workbench(domain, sessionId) });
    },
    /** 모든 approval 관련 query invalidate (approval action 후) */
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: APPROVAL_KEYS.all });
    },
  };
}
