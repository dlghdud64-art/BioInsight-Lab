"use client";

import type { ReactNode } from "react";
import { usePermission } from "@/hooks/use-permission";
import type { Permission } from "@/lib/permissions/permission-checker";

interface PermissionGateProps {
  /** 필요한 권한 (단일 또는 any-of 배열) */
  permission: Permission | Permission[];
  /** 권한 없을 때 대체 UI (기본: null = 숨김) */
  fallback?: ReactNode;
  /** 비활성 상태로 보여줄 대체 UI (disabled 버튼 등) */
  disabledFallback?: ReactNode;
  children: ReactNode;
}

/**
 * 권한 기반 조건부 렌더링 컴포넌트
 *
 * 3가지 모드:
 * 1. 숨김 (기본): 권한 없으면 렌더링 안 함
 * 2. 비활성: disabledFallback에 disabled 버튼 표시
 * 3. 메시지: fallback에 안내 문구 표시
 *
 * @example
 * // 숨김 모드
 * <PermissionGate permission="budgets.create">
 *   <Button>예산 추가</Button>
 * </PermissionGate>
 *
 * // 비활성 모드
 * <PermissionGate
 *   permission="budgets.create"
 *   disabledFallback={<Button disabled>예산 추가</Button>}
 * >
 *   <Button>예산 추가</Button>
 * </PermissionGate>
 */
export function PermissionGate({
  permission,
  fallback = null,
  disabledFallback,
  children,
}: PermissionGateProps) {
  const { can, canAny, isLoading } = usePermission();

  // 로딩 중에는 비활성 fallback 또는 숨김
  if (isLoading) {
    return <>{disabledFallback ?? fallback ?? null}</>;
  }

  const hasPermission = Array.isArray(permission)
    ? canAny(...permission)
    : can(permission);

  if (hasPermission) {
    return <>{children}</>;
  }

  // 권한 없음 → 비활성 fallback > fallback > null
  return <>{disabledFallback ?? fallback ?? null}</>;
}
