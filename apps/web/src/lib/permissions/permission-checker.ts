import { UserRole, OrganizationRole } from "@prisma/client";

/**
 * 권한 타입 정의
 */
export type Permission =
  | "quotes.view"
  | "quotes.create"
  | "quotes.update"
  | "quotes.delete"
  | "quotes.approve"
  | "products.view"
  | "products.create"
  | "products.update"
  | "products.delete"
  | "organizations.view"
  | "organizations.create"
  | "organizations.update"
  | "organizations.delete"
  | "organizations.manage_members"
  | "budgets.view"
  | "budgets.create"
  | "budgets.update"
  | "budgets.delete"
  | "reports.view"
  | "reports.export"
  | "inventory.view"
  | "inventory.create"
  | "inventory.update"
  | "inventory.delete"
  | "settings.view"
  | "settings.update"
  | "audit_logs.view"
  | "sso.configure";

/**
 * 역할별 권한 매핑
 */
const ROLE_PERMISSIONS: Record<UserRole | OrganizationRole, Permission[]> = {
  // 시스템 역할
  RESEARCHER: [
    "quotes.view",
    "quotes.create",
    "quotes.update",
    "products.view",
    "reports.view",
    "inventory.view",
  ],
  BUYER: [
    "quotes.view",
    "quotes.create",
    "quotes.update",
    "quotes.approve",
    "products.view",
    "budgets.view",
    "reports.view",
    "reports.export",
    "inventory.view",
  ],
  SUPPLIER: [
    "products.view",
    "products.create",
    "products.update",
  ],
  ADMIN: [
    "quotes.view",
    "quotes.create",
    "quotes.update",
    "quotes.delete",
    "quotes.approve",
    "products.view",
    "products.create",
    "products.update",
    "products.delete",
    "organizations.view",
    "organizations.create",
    "organizations.update",
    "organizations.delete",
    "organizations.manage_members",
    "budgets.view",
    "budgets.create",
    "budgets.update",
    "budgets.delete",
    "reports.view",
    "reports.export",
    "inventory.view",
    "inventory.create",
    "inventory.update",
    "inventory.delete",
    "settings.view",
    "settings.update",
    "audit_logs.view",
    "sso.configure",
  ],
  // 조직 역할
  VIEWER: [
    "quotes.view",
    "products.view",
    "reports.view",
    "inventory.view",
  ],
  REQUESTER: [
    "quotes.view",
    "quotes.create",
    "quotes.update",
    "products.view",
    "reports.view",
    "inventory.view",
  ],
  APPROVER: [
    "quotes.view",
    "quotes.create",
    "quotes.update",
    "quotes.approve",
    "products.view",
    "budgets.view",
    "reports.view",
    "reports.export",
    "inventory.view",
  ],
};

/**
 * 권한 확인
 */
export function hasPermission(
  userRole: UserRole,
  organizationRole: OrganizationRole | null,
  permission: Permission
): boolean {
  // 시스템 관리자는 모든 권한
  if (userRole === "ADMIN") {
    return true;
  }

  // 조직 역할이 있으면 조직 역할 권한 확인
  if (organizationRole) {
    const orgPermissions = ROLE_PERMISSIONS[organizationRole] || [];
    if (orgPermissions.includes(permission)) {
      return true;
    }
  }

  // 시스템 역할 권한 확인
  const userPermissions = ROLE_PERMISSIONS[userRole] || [];
  return userPermissions.includes(permission);
}

/**
 * 여러 권한 중 하나라도 있으면 true
 */
export function hasAnyPermission(
  userRole: UserRole,
  organizationRole: OrganizationRole | null,
  permissions: Permission[]
): boolean {
  return permissions.some((permission) =>
    hasPermission(userRole, organizationRole, permission)
  );
}

/**
 * 모든 권한이 있어야 true
 */
export function hasAllPermissions(
  userRole: UserRole,
  organizationRole: OrganizationRole | null,
  permissions: Permission[]
): boolean {
  return permissions.every((permission) =>
    hasPermission(userRole, organizationRole, permission)
  );
}

/**
 * 역할별 권한 목록 조회
 */
export function getPermissionsForRole(
  userRole: UserRole,
  organizationRole: OrganizationRole | null
): Permission[] {
  const permissions = new Set<Permission>();

  // 시스템 역할 권한 추가
  const userPermissions = ROLE_PERMISSIONS[userRole] || [];
  userPermissions.forEach((p) => permissions.add(p));

  // 조직 역할 권한 추가
  if (organizationRole) {
    const orgPermissions = ROLE_PERMISSIONS[organizationRole] || [];
    orgPermissions.forEach((p) => permissions.add(p));
  }

  return Array.from(permissions);
}



