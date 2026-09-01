"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { useActiveOrganization } from "@/hooks/use-active-organization";
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
 * 활성 조직(useActiveOrganization)의 role 로 판정한다. ADMIN/OWNER 는 모든 권한 true.
 *
 * §invite-flow Phase 2 (2026-09-01) — 이전에는 이 훅이 `/api/organizations` 를 직접 받아
 *   `orgs[0]` 을 골랐다. 화면마다 각자 첫 조직을 고르던 15곳 중 **가장 무거운 자리**였다 —
 *   2중 소속이 생기면 권한 화면과 예산 화면이 서로 다른 조직을 기준으로 판정할 수 있었다.
 *   선택은 이제 한 곳(서버 resolver)에서만 일어나고, 이 훅은 그 결과를 읽는다.
 *   🔑 단일 조직 사용자에게는 결과가 같다 — resolver 의 fallback 이 createdAt asc 첫 멤버십이라
 *      `orgs[0]`(= /api/organizations 의 첫 항목)과 같은 조직으로 떨어진다.
 */
export function usePermission(): UsePermissionReturn {
  const { status: sessionStatus } = useSession();

  const { organization, isLoading: activeLoading } = useActiveOrganization();
  const data = (organization as OrgData | null) ?? null;

  const role = data?.role ?? null;
  const organizationId = data?.id ?? null;
  const isLoading = sessionStatus === "loading" || activeLoading;

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
