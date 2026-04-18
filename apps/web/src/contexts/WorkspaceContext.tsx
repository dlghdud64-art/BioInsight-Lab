"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";

// Types (inline, don't import from contract to avoid circular)
export interface ActiveWorkspaceContext {
  organizationId: string;
  organizationName: string;
  workspaceId: string; // For now, same as organizationId (1 workspace per org)
  workspaceName: string; // Same as organizationName for now
  currentRole: string; // "OWNER" | "ADMIN" | "APPROVER" | "REQUESTER" | "VIEWER"
  plan?: string;
}

export type AggregateMode = "single" | "aggregate";

interface WorkspaceContextValue {
  /** 현재 활성 워크스페이스 (null = 미선택) */
  current: ActiveWorkspaceContext | null;
  /** 집계 모드: single(단일 워크스페이스) vs aggregate(전체 조직) */
  aggregateMode: AggregateMode;
  /** 워크스페이스 전환 */
  switchWorkspace: (ctx: ActiveWorkspaceContext) => void;
  /** 집계 모드 전환 */
  setAggregateMode: (mode: AggregateMode) => void;
  /** 로딩 상태 */
  isLoading: boolean;
  /** 전환 확인 필요 여부 (unsaved changes 등) */
  pendingSwitchTarget: ActiveWorkspaceContext | null;
  /** 전환 확인 완료 */
  confirmSwitch: () => void;
  /** 전환 취소 */
  cancelSwitch: () => void;
  /** unsaved changes 가드 등록 */
  registerGuard: (id: string, hasUnsaved: () => boolean) => void;
  /** 가드 해제 */
  unregisterGuard: (id: string) => void;
}

const WorkspaceCtx = createContext<WorkspaceContextValue | null>(null);

const STORAGE_KEY = "labaxis_active_workspace";
const RECENT_KEY = "labaxis_recent_workspaces";
const MAX_RECENT = 5;

/** State preservation rules - what resets on workspace switch */
const RESET_KEYS_ON_SWITCH = [
  "review_queue_draft",
  "compare_basket",
  "quote_draft",
  "active_filters",
  "selected_items",
];

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<ActiveWorkspaceContext | null>(null);
  const [aggregateMode, setAggregateMode] = useState<AggregateMode>("single");
  const [isLoading, setIsLoading] = useState(true);
  const [pendingSwitchTarget, setPendingSwitchTarget] = useState<ActiveWorkspaceContext | null>(null);
  const [guards] = useState(() => new Map<string, () => boolean>());

  // Restore from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        setCurrent(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
    setIsLoading(false);
  }, []);

  // Persist to sessionStorage on change
  useEffect(() => {
    if (current) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(current));
        // Update recent list
        const recentRaw = sessionStorage.getItem(RECENT_KEY);
        const recent: ActiveWorkspaceContext[] = recentRaw ? JSON.parse(recentRaw) : [];
        const filtered = recent.filter((r) => r.organizationId !== current.organizationId);
        filtered.unshift(current);
        sessionStorage.setItem(RECENT_KEY, JSON.stringify(filtered.slice(0, MAX_RECENT)));
      } catch {
        // ignore
      }
    }
  }, [current]);

  const registerGuard = useCallback((id: string, hasUnsaved: () => boolean) => {
    guards.set(id, hasUnsaved);
  }, [guards]);

  const unregisterGuard = useCallback((id: string) => {
    guards.delete(id);
  }, [guards]);

  const hasUnsavedChanges = useCallback((): boolean => {
    for (const [, check] of guards) {
      if (check()) return true;
    }
    return false;
  }, [guards]);

  const performSwitch = useCallback((ctx: ActiveWorkspaceContext) => {
    // Reset workspace-scoped state
    RESET_KEYS_ON_SWITCH.forEach((key) => {
      try { sessionStorage.removeItem(key); } catch { /* ignore */ }
    });
    setCurrent(ctx);
    setPendingSwitchTarget(null);
  }, []);

  const switchWorkspace = useCallback((ctx: ActiveWorkspaceContext) => {
    // Same workspace - no-op
    if (current?.organizationId === ctx.organizationId) return;
    // Check guards
    if (hasUnsavedChanges()) {
      setPendingSwitchTarget(ctx);
      return;
    }
    performSwitch(ctx);
  }, [current, hasUnsavedChanges, performSwitch]);

  const confirmSwitch = useCallback(() => {
    if (pendingSwitchTarget) {
      performSwitch(pendingSwitchTarget);
    }
  }, [pendingSwitchTarget, performSwitch]);

  const cancelSwitch = useCallback(() => {
    setPendingSwitchTarget(null);
  }, []);

  const value = useMemo<WorkspaceContextValue>(() => ({
    current,
    aggregateMode,
    switchWorkspace,
    setAggregateMode,
    isLoading,
    pendingSwitchTarget,
    confirmSwitch,
    cancelSwitch,
    registerGuard,
    unregisterGuard,
  }), [current, aggregateMode, switchWorkspace, setAggregateMode, isLoading, pendingSwitchTarget, confirmSwitch, cancelSwitch, registerGuard, unregisterGuard]);

  return <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>;
}

/** 워크스페이스 컨텍스트 훅 */
export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceCtx);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

/** 현재 워크스페이스가 반드시 있어야 하는 곳에서 사용 */
export function useRequiredWorkspace(): ActiveWorkspaceContext {
  const { current } = useWorkspace();
  if (!current) throw new Error("Workspace context is required but not set");
  return current;
}
