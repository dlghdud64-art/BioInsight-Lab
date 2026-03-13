"use client";

import { useQuery } from "@tanstack/react-query";

// ── Types ──

export interface ActivityLogEntry {
  id: string;
  activityType: string;
  entityType: string;
  entityId: string | null;
  taskType: string | null;
  beforeStatus: string | null;
  afterStatus: string | null;
  actorRole: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  organization: {
    id: string;
    name: string;
  } | null;
}

export interface ActivityLogsResponse {
  logs: ActivityLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

// ── Query Keys ──

export const ACTIVITY_LOG_KEYS = {
  all: ["activity-logs"] as const,
  list: (filters?: Record<string, string>) => ["activity-logs", "list", filters] as const,
  entity: (entityType: string, entityId: string) =>
    ["activity-logs", "entity", entityType, entityId] as const,
};

// ── Hooks ──

/**
 * 특정 엔티티의 최근 활동 로그 조회
 */
export function useEntityActivityLogs(
  entityType: string,
  entityId: string | null | undefined,
  options?: { limit?: number; enabled?: boolean }
) {
  return useQuery<ActivityLogsResponse>({
    queryKey: ACTIVITY_LOG_KEYS.entity(entityType, entityId || ""),
    queryFn: async () => {
      const params = new URLSearchParams({
        entityType,
        entityId: entityId || "",
        limit: String(options?.limit ?? 5),
      });
      const res = await fetch(`/api/activity-logs?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch activity logs");
      return res.json();
    },
    enabled: (options?.enabled ?? true) && !!entityId,
    staleTime: 2 * 60 * 1000, // 2분
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * AI 파이프라인 활동 로그 조회
 */
export function useAiActivityLogs(filters?: {
  taskType?: string;
  limit?: number;
}) {
  return useQuery<ActivityLogsResponse>({
    queryKey: ACTIVITY_LOG_KEYS.list({
      entityType: "AI_ACTION",
      ...(filters?.taskType ? { taskType: filters.taskType } : {}),
    } as Record<string, string>),
    queryFn: async () => {
      const params = new URLSearchParams({
        entityType: "AI_ACTION",
        limit: String(filters?.limit ?? 10),
      });
      if (filters?.taskType) params.set("taskType", filters.taskType);
      const res = await fetch(`/api/activity-logs?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch AI activity logs");
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// ── 활동 타입 한국어 매핑 ──

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  AI_TASK_CREATED: "AI 작업 생성",
  AI_TASK_OPENED: "AI 초안 열람",
  QUOTE_DRAFT_GENERATED: "견적 초안 생성",
  QUOTE_DRAFT_REVIEWED: "견적 초안 검토",
  EMAIL_DRAFT_GENERATED: "이메일 초안 생성",
  EMAIL_SENT: "이메일 발송",
  VENDOR_REPLY_LOGGED: "벤더 회신 수신",
  ORDER_FOLLOWUP_GENERATED: "주문 후속 생성",
  ORDER_STATUS_CHANGE_PROPOSED: "상태 변경 제안",
  ORDER_STATUS_CHANGE_APPROVED: "상태 변경 승인",
  INVENTORY_RESTOCK_SUGGESTED: "재발주 제안",
  INVENTORY_RESTOCK_REVIEWED: "재발주 검토",
  PURCHASE_REQUEST_CREATED: "구매 요청 생성",
  AI_TASK_COMPLETED: "AI 작업 완료",
  AI_TASK_FAILED: "AI 작업 실패",
  // 기존 타입
  QUOTE_CREATED: "견적 생성",
  QUOTE_UPDATED: "견적 수정",
  QUOTE_VIEWED: "견적 조회",
  QUOTE_SHARED: "견적 공유",
  QUOTE_STATUS_CHANGED: "견적 상태 변경",
};

export const STATUS_LABELS: Record<string, string> = {
  PENDING: "대기",
  APPROVED: "승인",
  DISMISSED: "무시",
  EXPIRED: "만료",
  EXECUTING: "실행 중",
  FAILED: "실패",
};
