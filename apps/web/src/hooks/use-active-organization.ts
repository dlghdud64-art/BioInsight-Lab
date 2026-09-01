"use client";

/**
 * §invite-flow Phase 1 — 활성 조직 훅 (UI 축의 유일한 선택 지점)
 *   (PLAN: docs/plans/PLAN_invite-flow.md Phase 1 · Phase 2 가 orgs[0] 15곳을 여기로 모은다)
 *
 * 왜 훅인가: `orgs[0]` 는 화면마다 자기 나름대로 첫 조직을 골랐다 — 같은 사용자가 권한
 *   화면과 예산 화면에서 다른 조직을 볼 수 있었다(2중 소속이 생기는 순간 실재화).
 *   선택은 한 곳에서만 일어나야 하고, 그 한 곳은 서버 resolver 의 결과를 읽는다.
 *
 * 🛑 이 훅은 서버 판정을 **읽기만** 한다. 로컬 state 가 활성 조직 노릇을 하지 않는다 —
 *    전환은 setActiveOrganization(=PATCH) 후 refetch 로 서버 진실을 다시 받는다.
 */
import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { csrfFetch } from "@/lib/api-client";

export interface ActiveOrganization {
  id: string;
  name: string;
  role?: string;
  [key: string]: unknown;
}

export interface UseActiveOrganizationReturn {
  /** 활성 조직 (없으면 null — 조직 0 이거나 로딩 중) */
  organization: ActiveOrganization | null;
  /** 활성 조직 id */
  organizationId: string | null;
  /** 가입한 조직 전체 (switcher 용) */
  organizations: ActiveOrganization[];
  /** 사용자가 직접 고른 값인가 (false = createdAt asc fallback) */
  persisted: boolean;
  isLoading: boolean;
  /** 활성 조직 전환 — 서버에 저장한 뒤 관련 캐시를 무효화한다 */
  setActiveOrganization: (organizationId: string) => Promise<void>;
  isSwitching: boolean;
}

export function useActiveOrganization(): UseActiveOrganizationReturn {
  const { status } = useSession();
  const queryClient = useQueryClient();
  const enabled = status === "authenticated";

  const orgsQuery = useQuery({
    queryKey: ["user-organizations"],
    queryFn: async (): Promise<ActiveOrganization[]> => {
      const res = await fetch("/api/organizations");
      if (!res.ok) throw new Error("Failed to fetch organizations");
      const json = await res.json();
      return (json.organizations ?? []) as ActiveOrganization[];
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const activeQuery = useQuery({
    queryKey: ["active-organization"],
    queryFn: async (): Promise<{ organizationId: string | null; persisted: boolean }> => {
      const res = await fetch("/api/me/active-organization");
      if (!res.ok) throw new Error("Failed to fetch active organization");
      return res.json();
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const switchMutation = useMutation({
    mutationFn: async (organizationId: string) => {
      const res = await csrfFetch("/api/me/active-organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "활성 조직 저장에 실패했습니다.");
      }
      return res.json();
    },
    onSuccess: () => {
      // 서버 진실을 다시 읽는다 — 낙관적 로컬 값이 canonical 을 덮지 않는다.
      queryClient.invalidateQueries({ queryKey: ["active-organization"] });
      queryClient.invalidateQueries({ queryKey: ["user-organizations"] });
      queryClient.invalidateQueries({ queryKey: ["user-org-membership"] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
  });

  const organizations = orgsQuery.data ?? [];
  const organizationId = activeQuery.data?.organizationId ?? null;

  const organization = useMemo(() => {
    if (!organizationId) return null;
    return organizations.find((o) => o.id === organizationId) ?? null;
  }, [organizations, organizationId]);

  return {
    organization,
    organizationId,
    organizations,
    persisted: activeQuery.data?.persisted ?? false,
    isLoading: enabled && (orgsQuery.isLoading || activeQuery.isLoading),
    setActiveOrganization: async (id: string) => {
      await switchMutation.mutateAsync(id);
    },
    isSwitching: switchMutation.isPending,
  };
}
