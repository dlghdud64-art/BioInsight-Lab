/**
 * Organization Overview — Query Hook
 *
 * 책임: API 호출 + 캐시 키 + refetch + 서버 상태 노출
 * 금지: UI 해석, label 생성, badge 결정, empty copy
 */

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

// ── Raw Response Types (서버 계약) ──

export interface OverviewStatsRaw {
  reviewNeeded: number;
  compareNeeded: number;
  confirmed: number;
  approved: number;
  matchFailed: number;
  excluded: number;
  totalReview: number;
  totalCompare: number;
  totalQuoteDraft: number;
  activeMembers: number;
  recentActivityCount: number;
  budgetWarnings: number;
  inventoryDuplicates: number;
  pendingApprovals: number;
}

export interface OverviewAlertRaw {
  id: string;
  type: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  affectedCount: number;
  linkHref: string;
}

export interface OverviewActivityRaw {
  id: string;
  eventType: string;
  actorLabel: string;
  message: string;
  timestamp: string;
}

export interface OverviewQueryResult {
  stats: OverviewStatsRaw;
  alerts: OverviewAlertRaw[];
  recentActivity: OverviewActivityRaw[];
}

// ── Query Hook ──

const OVERVIEW_QUERY_KEY = ["organization-overview"] as const;

export function useOverviewQuery() {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  return useQuery<OverviewQueryResult>({
    queryKey: OVERVIEW_QUERY_KEY,
    queryFn: async () => {
      // P0: 클라이언트 사이드 review queue에서 계산
      // 향후 서버 API로 전환 시 이 함수만 교체
      return {
        stats: {
          reviewNeeded: 0,
          compareNeeded: 0,
          confirmed: 0,
          approved: 0,
          matchFailed: 0,
          excluded: 0,
          totalReview: 0,
          totalCompare: 0,
          totalQuoteDraft: 0,
          activeMembers: 1,
          recentActivityCount: 0,
          budgetWarnings: 0,
          inventoryDuplicates: 0,
          pendingApprovals: 0,
        },
        alerts: [],
        recentActivity: [],
      };
    },
    enabled: isAuthenticated,
    staleTime: 60_000, // 1분
    retry: 1,
  });
}

export function useOverviewQueryKey() {
  return OVERVIEW_QUERY_KEY;
}
