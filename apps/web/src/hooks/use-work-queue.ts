"use client";

import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TaskStatus, ApprovalStatus } from "@/lib/work-queue/state-mapper";
import { TASK_STATUS_SORT_ORDER, TASK_STATUS_BADGE, APPROVAL_STATUS_BADGE } from "@/lib/work-queue/state-mapper";

// ── Types ──

export interface WorkQueueItem {
  id: string;
  type: string;
  taskStatus: TaskStatus;
  approvalStatus: ApprovalStatus;
  substatus: string | null;
  priority: string;
  title: string;
  summary: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  // ── 다차원 스코어링 ──
  impactScore: number;
  urgencyScore: number;
  totalScore: number;
  urgencyReason: string | null;
}

export interface WorkQueueResponse {
  items: WorkQueueItem[];
  activeCount: number;
  completedCount: number;
}

// ── Query Keys ──

export const WORK_QUEUE_KEYS = {
  all: ["work-queue"] as const,
  list: (filters?: Record<string, string>) => ["work-queue", "list", filters] as const,
  active: ["work-queue", "active"] as const,
  completed: ["work-queue", "completed"] as const,
  entity: (entityType: string, entityId: string) =>
    ["work-queue", "entity", entityType, entityId] as const,
};

// ── Hooks ──

/**
 * 대시보드 통합 Work Queue 목록 조회
 *
 * 기본: active 항목만. includeCompleted로 최근 완료 포함 가능.
 */
export function useWorkQueue(filters?: {
  taskStatus?: TaskStatus[];
  limit?: number;
  includeCompleted?: boolean;
  organizationId?: string;
}) {
  return useQuery<WorkQueueResponse>({
    queryKey: WORK_QUEUE_KEYS.list(filters as Record<string, string>),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.taskStatus?.length) {
        params.set("taskStatus", filters.taskStatus.join(","));
      }
      if (filters?.limit) params.set("limit", String(filters.limit));
      if (filters?.includeCompleted) params.set("includeCompleted", "true");
      if (filters?.organizationId) params.set("organizationId", filters.organizationId);

      const res = await fetch(`/api/work-queue?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch work queue");
      return res.json();
    },
    staleTime: 3 * 60 * 1000, // 3분
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Work Queue 항목 승인 — 낙관적 업데이트
 */
export function useApproveWorkItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload?: Record<string, unknown> }) => {
      const res = await fetch(`/api/ai-actions/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || "Failed to approve");
      }
      return res.json();
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: WORK_QUEUE_KEYS.all });

      const queryCache = queryClient.getQueryCache();
      const listQueries = queryCache.findAll({ queryKey: ["work-queue", "list"] });
      const snapshots: Array<{ key: readonly unknown[]; data: unknown }> = [];

      for (const query of listQueries) {
        const prev = query.state.data as WorkQueueResponse | undefined;
        if (prev) {
          snapshots.push({ key: query.queryKey, data: prev });
          queryClient.setQueryData(query.queryKey, {
            ...prev,
            items: prev.items.filter((item: WorkQueueItem) => item.id !== id),
            activeCount: Math.max(0, prev.activeCount - 1),
          });
        }
      }

      return { snapshots };
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshots) {
        for (const { key, data } of context.snapshots) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: WORK_QUEUE_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ["ai-actions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

/**
 * Work Queue 항목 무시(Dismiss) — 낙관적 업데이트
 */
export function useDismissWorkItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ai-actions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DISMISSED" }),
      });
      if (!res.ok) throw new Error("Failed to dismiss");
      return res.json();
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: WORK_QUEUE_KEYS.all });

      const queryCache = queryClient.getQueryCache();
      const listQueries = queryCache.findAll({ queryKey: ["work-queue", "list"] });
      const snapshots: Array<{ key: readonly unknown[]; data: unknown }> = [];

      for (const query of listQueries) {
        const prev = query.state.data as WorkQueueResponse | undefined;
        if (prev) {
          snapshots.push({ key: query.queryKey, data: prev });
          queryClient.setQueryData(query.queryKey, {
            ...prev,
            items: prev.items.filter((item: WorkQueueItem) => item.id !== id),
            activeCount: Math.max(0, prev.activeCount - 1),
          });
        }
      }

      return { snapshots };
    },
    onError: (_err, _id, context) => {
      if (context?.snapshots) {
        for (const { key, data } of context.snapshots) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: WORK_QUEUE_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ["ai-actions"] });
    },
  });
}

/**
 * Ops queue sync — 대시보드 마운트 시 ops-sync + compare-sync 병렬 호출
 *
 * 운영 도메인 큐 아이템을 실제 엔티티 상태와 동기화합니다.
 * 3분 디바운스로 중복 호출 방지.
 */
export function useSyncOpsQueue() {
  const synced = useRef(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (synced.current) return;
    synced.current = true;

    Promise.all([
      fetch("/api/work-queue/ops-sync", { method: "POST" }).catch(() => null),
      fetch("/api/work-queue/compare-sync", { method: "POST" }).catch(() => null),
    ]).then(() => {
      queryClient.invalidateQueries({ queryKey: WORK_QUEUE_KEYS.all });
    });
  }, [queryClient]);
}

/**
 * Ops CTA 실행 — 낙관적 업데이트
 *
 * ops-execute 엔드포인트를 호출하여 CTA 완료 정의에 따라
 * 상태 전이 + 소유권 이전 + 다음 큐 생성을 수행합니다.
 */
export function useExecuteOpsAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      actionId,
      itemId,
      payload,
    }: {
      actionId: string;
      itemId: string;
      payload?: Record<string, unknown>;
    }) => {
      const res = await fetch("/api/work-queue/ops-execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId, itemId, payload }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        const error = new Error(err.message || err.error || "Failed to execute action");
        (error as any).status = res.status;
        (error as any).errorCode = err.error;
        throw error;
      }
      return res.json();
    },
    onMutate: async ({ itemId }) => {
      await queryClient.cancelQueries({ queryKey: WORK_QUEUE_KEYS.all });

      const queryCache = queryClient.getQueryCache();
      const listQueries = queryCache.findAll({ queryKey: ["work-queue", "list"] });
      const snapshots: Array<{ key: readonly unknown[]; data: unknown }> = [];

      for (const query of listQueries) {
        const prev = query.state.data as WorkQueueResponse | undefined;
        if (prev) {
          snapshots.push({ key: query.queryKey, data: prev });
          queryClient.setQueryData(query.queryKey, {
            ...prev,
            items: prev.items.filter((item: WorkQueueItem) => item.id !== itemId),
            activeCount: Math.max(0, prev.activeCount - 1),
          });
        }
      }

      return { snapshots };
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshots) {
        for (const { key, data } of context.snapshots) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: WORK_QUEUE_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ["ai-actions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

/**
 * 특정 엔티티의 큐 아이템 조회 — 상세 화면용
 *
 * entityType + entityId로 해당 엔티티의 모든 큐 아이템을 조회합니다.
 * 완료/실패 항목도 포함하여 audit trail 확인 가능.
 */
export function useEntityQueueItems(
  entityType: string | null | undefined,
  entityId: string | null | undefined,
) {
  return useQuery<WorkQueueResponse>({
    queryKey: WORK_QUEUE_KEYS.entity(entityType!, entityId!),
    queryFn: async () => {
      const params = new URLSearchParams({
        entityType: entityType!,
        entityId: entityId!,
        includeCompleted: "true",
      });
      const res = await fetch(`/api/work-queue?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch entity queue items");
      return res.json();
    },
    enabled: !!entityType && !!entityId,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}

// ── Re-exports for UI convenience ──

export { TASK_STATUS_SORT_ORDER, TASK_STATUS_BADGE, APPROVAL_STATUS_BADGE };
export type { TaskStatus, ApprovalStatus };
