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

  /**
   * 🛑 `["user-organizations"]` 는 **이 훅 전용 키가 아니다.** 같은 키로 `res.json()`
   *    (= `{ organizations: [...] }`) 를 반환하는 useQuery 선언이 **8곳** 더 있다
   *    (전량 grep 실측 2026-09-03 — admin/safety:66 · safety-spend:83 · plans:334 ·
   *     settings/{audit:60,billing:36,security:36,workspace:57} · workspace-switcher:38.
   *     같은 키의 `invalidateQueries` 4곳은 선언이 아니므로 이 수에 넣지 않는다.
   *     BulkImportModal 은 Phase 2-10 에서 이 훅의 **소비자**가 되어 목록에서 빠졌다).
   *    TanStack 은 같은 키를 **하나의 캐시 항목**으로 공유하므로
   *    먼저 fetch 를 트리거한 observer 의 queryFn 결과가 그 항목에 들어간다.
   *    → 훅이 배열을 반환하면 페이지 쪽 `data?.organizations` 가 `undefined` 가 되고,
   *      페이지가 이기면 훅 쪽 `organizations.find(...)` 가 **TypeError** 로 터진다.
   *      (후자는 실제 도달 가능하다 — `dashboard-shell` 이 모든 대시보드 화면에
   *       `OperationalBriefPopup` → `usePermission` → 이 훅을 매단다.)
   *    그래서 **모양을 남들과 맞춘다** — 누가 이기든 캐시 값이 같아진다.
   */
  const orgsQuery = useQuery({
    queryKey: ["user-organizations"],
    queryFn: async (): Promise<{ organizations: ActiveOrganization[] }> => {
      const res = await fetch("/api/organizations");
      if (!res.ok) throw new Error("Failed to fetch organizations");
      return (await res.json()) as { organizations: ActiveOrganization[] };
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

  /* 위 주석의 공유 캐시 때문에, 읽는 쪽도 두 모양을 모두 견딘다 —
   * 모양을 맞춰도 배포 전 캐시·다른 세션 잔여분이 배열로 남아 있을 수 있다. */
  const rawOrgs: unknown = orgsQuery.data;
  const organizations: ActiveOrganization[] = Array.isArray(rawOrgs)
    ? (rawOrgs as ActiveOrganization[])
    : ((rawOrgs as { organizations?: ActiveOrganization[] } | undefined)
        ?.organizations ?? []);
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
