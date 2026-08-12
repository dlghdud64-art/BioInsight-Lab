"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import type { Permission } from "@/lib/permissions/permission-checker";

/**
 * 조직 역할별 권한 매핑 (permission-checker.ts의 ROLE_PERMISSIONS 미러)
 * 클라이언트 번들에서 사용하기 위해 별도 정의
 */
const ORG_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  VIEWER: [
    "quotes.view", "products.view", "reports.view", "inventory.view",
  ],
  REQUESTER: [
    "quotes.view", "quotes.create", "quotes.update",
    "products.view", "reports.view", "inventory.view",
  ],
  APPROVER: [
    "quotes.view", "quotes.create", "quotes.update", "quotes.approve",
    "products.view", "budgets.view", "reports.view", "reports.export",
    "inventory.view",
  ],
  ADMIN: [
    "quotes.view", "quotes.create", "quotes.update", "quotes.delete", "quotes.approve",
    "products.view", "products.create", "products.update", "products.delete",
    "organizations.view", "organizations.create", "organizations.update",
    "organizations.delete", "organizations.manage_members",
    "budgets.view", "budgets.create", "budgets.update", "budgets.delete",
    "reports.view", "reports.export",
    "inventory.view", "inventory.create", "inventory.update", "inventory.delete",
    "settings.view", "settings.update",
    "audit_logs.view", "sso.configure",
  ],
  OWNER: [
    "quotes.view", "quotes.create", "quotes.update", "quotes.delete", "quotes.approve",
    "products.view", "products.create", "products.update", "products.delete",
    "organizations.view", "organizations.update", "organizations.manage_members",
    "budgets.view", "budgets.create", "budgets.update", "budgets.delete",
    "reports.view", "reports.export",
    "inventory.view", "inventory.create", "inventory.update", "inventory.delete",
    "settings.view", "settings.update",
    "audit_logs.view",
  ],
};

interface OrgData {
  id: string;
  name: string;
  role: string;
  [key: string]: unknown;
}

export interface UsePermissionReturn {
  /** 사용자의 조직 역할 (VIEWER | REQUESTER | APPROVER | ADMIN | OWNER) */
  role: string | null;
  /** 활성 조직 ID */
  organizationId: string | null;
  /** 데이터 로딩 중 */
  isLoading: boolean;
  /** OWNER 여부 */
  isOwner: boolean;
  /** ADMIN 여부 */
  isAdmin: boolean;
  /** ADMIN 또는 OWNER 여부 */
  isAdminOrOwner: boolean;
  /** 특정 권한 보유 여부 */
  can: (permission: Permission) => boolean;
  /** 나열된 권한 중 하나라도 보유 여부 */
  canAny: (...permissions: Permission[]) => boolean;
}

/**
 * 조직 역할 기반 권한 체크 훅
 *
 * GET /api/organizations 응답에서 첫 번째 조직의 role을 가져와 캐싱.
 * ADMIN/OWNER는 모든 권한 true.
 * 기존 fetchActiveOrg + canEditBudget 패턴을 대체.
 */
export function usePermission(): UsePermissionReturn {
  const { status: sessionStatus } = useSession();

  const { data, isLoading: queryLoading } = useQuery({
    queryKey: ["user-org-membership"],
    queryFn: async (): Promise<OrgData | null> => {
      const res = await fetch("/api/organizations");
      if (!res.ok) return null;
      const json = await res.json();
      const orgs = json.organizations as OrgData[] | undefined;
      if (!orgs || orgs.length === 0) return null;
      // 첫 번째 조직 (대부분의 사용자는 1개 조직 소속)
      return orgs[0]!;
    },
    enabled: sessionStatus === "authenticated",
    staleTime: 5 * 60 * 1000, // 5분
    retry: 1,
  });

  const role = data?.role ?? null;
  const organizationId = data?.id ?? null;
  const isLoading = sessionStatus === "loading" || queryLoading;

  const isOwner = role === "OWNER";
  const isAdmin = role === "ADMIN";
  const isAdminOrOwner = isOwner || isAdmin;

  const permissions = useMemo(() => {
    if (!role) return new Set<Permission>();
    const perms = ORG_ROLE_PERMISSIONS[role];
    return new Set<Permission>(perms ?? []);
  }, [role]);

  const can = useMemo(
    () => (permission: Permission): boolean => {
      if (isAdminOrOwner) return true;
      return permissions.has(permission);
    },
    [isAdminOrOwner, permissions],
  );

  const canAny = useMemo(
    () => (...perms: Permission[]): boolean => {
      if (isAdminOrOwner) return true;
      return perms.some((p) => permissions.has(p));
    },
    [isAdminOrOwner, permissions],
  );

  return {
    role,
    organizationId,
    isLoading,
    isOwner,
    isAdmin,
    isAdminOrOwner,
    can,
    canAny,
  };
}
