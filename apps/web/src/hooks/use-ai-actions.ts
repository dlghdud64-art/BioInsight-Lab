"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ── Types ──

export interface AiActionItem {
  id: string;
  type: string;
  status: string;
  priority: string;
  title: string;
  description: string | null;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  aiModel?: string | null;
  createdAt: string;
  expiresAt: string | null;
  resolvedAt: string | null;
}

export interface AiActionsResponse {
  items: AiActionItem[];
  total: number;
  pendingCount: number;
}

interface GenerateQuoteDraftInput {
  items: Array<{
    productName: string;
    catalogNumber?: string;
    brand?: string;
    quantity: number;
    unit?: string;
  }>;
  vendorNames?: string[];
  deliveryDate?: string;
  additionalNotes?: string;
}

interface GenerateVendorEmailInput {
  vendorName: string;
  vendorEmail?: string;
  items: Array<{
    productName: string;
    catalogNumber?: string;
    quantity: number;
    unit?: string;
  }>;
  deliveryDate?: string;
  customMessage?: string;
  quoteId?: string;
}

// ── Query Keys ──

export const AI_ACTION_KEYS = {
  all: ["ai-actions"] as const,
  list: (filters?: Record<string, string>) => ["ai-actions", "list", filters] as const,
  detail: (id: string) => ["ai-actions", "detail", id] as const,
  pendingCount: ["ai-actions", "pending-count"] as const,
};

// ── Hooks ──

/**
 * AI 작업함 목록 조회
 */
export function useAiActions(filters?: { status?: string; type?: string; limit?: number }) {
  return useQuery<AiActionsResponse>({
    queryKey: AI_ACTION_KEYS.list(filters as Record<string, string>),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.set("status", filters.status);
      if (filters?.type) params.set("type", filters.type);
      if (filters?.limit) params.set("limit", String(filters.limit));

      const res = await fetch(`/api/ai-actions?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch AI actions");
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 15 * 60 * 1000,
  });
}

/**
 * AI 작업 단건 상세
 */
export function useAiActionDetail(id: string) {
  return useQuery<{ item: AiActionItem }>({
    queryKey: AI_ACTION_KEYS.detail(id),
    queryFn: async () => {
      const res = await fetch(`/api/ai-actions/${id}`);
      if (!res.ok) throw new Error("Failed to fetch AI action detail");
      return res.json();
    },
    enabled: !!id,
  });
}

/**
 * AI 작업 승인 — 낙관적 업데이트 포함
 *
 * 승인 클릭 즉시 카드를 목록에서 제거하고,
 * 서버 실패 시 롤백합니다.
 */
export function useApproveAiAction() {
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
      // 진행 중인 refetch 취소
      await queryClient.cancelQueries({ queryKey: AI_ACTION_KEYS.all });

      // 모든 list 캐시에서 낙관적 제거
      const queryCache = queryClient.getQueryCache();
      const listQueries = queryCache.findAll({ queryKey: ["ai-actions", "list"] });
      const snapshots: Array<{ key: readonly unknown[]; data: unknown }> = [];

      for (const query of listQueries) {
        const prev = query.state.data as AiActionsResponse | undefined;
        if (prev) {
          snapshots.push({ key: query.queryKey, data: prev });
          queryClient.setQueryData(query.queryKey, {
            ...prev,
            items: prev.items.filter((item: AiActionItem) => item.id !== id),
            total: Math.max(0, prev.total - 1),
            pendingCount: Math.max(0, prev.pendingCount - 1),
          });
        }
      }

      return { snapshots };
    },
    onError: (_err, _vars, context) => {
      // 롤백
      if (context?.snapshots) {
        for (const { key, data } of context.snapshots) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: AI_ACTION_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

/**
 * AI 작업 무시 — 낙관적 업데이트 포함
 *
 * 무시 클릭 즉시 카드를 목록에서 제거하고,
 * 서버 실패 시 롤백합니다.
 */
export function useDismissAiAction() {
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
      // 진행 중인 refetch 취소
      await queryClient.cancelQueries({ queryKey: AI_ACTION_KEYS.all });

      // 모든 list 캐시에서 낙관적 제거
      const queryCache = queryClient.getQueryCache();
      const listQueries = queryCache.findAll({ queryKey: ["ai-actions", "list"] });
      const snapshots: Array<{ key: readonly unknown[]; data: unknown }> = [];

      for (const query of listQueries) {
        const prev = query.state.data as AiActionsResponse | undefined;
        if (prev) {
          snapshots.push({ key: query.queryKey, data: prev });
          queryClient.setQueryData(query.queryKey, {
            ...prev,
            items: prev.items.filter((item: AiActionItem) => item.id !== id),
            total: Math.max(0, prev.total - 1),
            pendingCount: Math.max(0, prev.pendingCount - 1),
          });
        }
      }

      return { snapshots };
    },
    onError: (_err, _id, context) => {
      // 롤백
      if (context?.snapshots) {
        for (const { key, data } of context.snapshots) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: AI_ACTION_KEYS.all });
    },
  });
}

/**
 * 견적 초안 생성
 */
export function useGenerateQuoteDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: GenerateQuoteDraftInput) => {
      const res = await fetch("/api/ai-actions/generate/quote-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || "Failed to generate");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AI_ACTION_KEYS.all });
    },
  });
}

/**
 * 벤더 이메일 초안 생성
 */
export function useGenerateVendorEmailDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: GenerateVendorEmailInput) => {
      const res = await fetch("/api/ai-actions/generate/vendor-email-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || "Failed to generate");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AI_ACTION_KEYS.all });
    },
  });
}
