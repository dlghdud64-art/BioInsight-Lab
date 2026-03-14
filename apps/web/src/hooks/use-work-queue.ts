"use client";

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

// ── Re-exports for UI convenience ──

export { TASK_STATUS_SORT_ORDER, TASK_STATUS_BADGE, APPROVAL_STATUS_BADGE };
export type { TaskStatus, ApprovalStatus };
