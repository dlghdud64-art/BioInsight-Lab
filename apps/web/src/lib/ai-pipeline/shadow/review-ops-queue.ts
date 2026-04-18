/**
 * Review Operations Queue — 구조화된 리뷰 운영 큐
 *
 * Priority/AssignedTo/DueAt/ResolutionType 기반 리뷰 큐 관리
 */

// ── Types ──

export type ReviewPriority = "P0_CRITICAL" | "P1_HIGH" | "P2_MEDIUM" | "P3_LOW";
export type ReviewResolutionType = "CONFIRMED_CORRECT" | "CONFIRMED_INCORRECT" | "ESCALATED" | "DEFERRED" | "AUTO_RESOLVED";
export type ReviewStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "ESCALATED";

export interface ReviewItem {
  id: string;
  documentType: string;
  comparisonLogId: string;
  priority: ReviewPriority;
  status: ReviewStatus;
  assignedTo: string | null;
  createdAt: Date;
  dueAt: Date;
  resolvedAt: Date | null;
  resolutionType: ReviewResolutionType | null;
  resolutionNotes: string | null;
  mismatchCategory: string;
  confidence: number | null;
  isFalseSafeCandidate: boolean;
  orgId: string;
  tags: string[];
}

export interface ReviewQueueStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  escalated: number;
  overdue: number;
  byPriority: Record<ReviewPriority, number>;
  avgResolutionHours: number;
  capacityPercent: number;
}

// ── In-memory store (production: DB-backed) ──

const reviewQueue: ReviewItem[] = [];
const MAX_CAPACITY = 200;

/**
 * 리뷰 항목 추가
 */
export function enqueueReview(params: {
  documentType: string;
  comparisonLogId: string;
  mismatchCategory: string;
  confidence: number | null;
  isFalseSafeCandidate: boolean;
  orgId: string;
  tags?: string[];
}): ReviewItem {
  const priority = computeReviewPriority(params);
  const dueAt = computeDueDate(priority);

  const item: ReviewItem = {
    id: `RV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    documentType: params.documentType,
    comparisonLogId: params.comparisonLogId,
    priority,
    status: "OPEN",
    assignedTo: null,
    createdAt: new Date(),
    dueAt,
    resolvedAt: null,
    resolutionType: null,
    resolutionNotes: null,
    mismatchCategory: params.mismatchCategory,
    confidence: params.confidence,
    isFalseSafeCandidate: params.isFalseSafeCandidate,
    orgId: params.orgId,
    tags: params.tags ?? [],
  };

  reviewQueue.push(item);
  return item;
}

/**
 * 리뷰 항목 할당
 */
export function assignReview(reviewId: string, assignedTo: string): boolean {
  const item = reviewQueue.find((r) => r.id === reviewId);
  if (!item || item.status === "RESOLVED") return false;
  item.assignedTo = assignedTo;
  item.status = "IN_PROGRESS";
  return true;
}

/**
 * 리뷰 완료 처리
 */
export function resolveReview(reviewId: string, resolution: {
  type: ReviewResolutionType;
  notes?: string;
}): boolean {
  const item = reviewQueue.find((r) => r.id === reviewId);
  if (!item) return false;
  item.status = resolution.type === "ESCALATED" ? "ESCALATED" : "RESOLVED";
  item.resolvedAt = new Date();
  item.resolutionType = resolution.type;
  item.resolutionNotes = resolution.notes ?? null;
  return true;
}

/**
 * 큐 조회 — 우선순위 정렬
 */
export function getReviewQueue(params?: {
  documentType?: string;
  status?: ReviewStatus;
  priority?: ReviewPriority;
  limit?: number;
}): ReviewItem[] {
  let items = [...reviewQueue];

  if (params?.documentType) items = items.filter((i) => i.documentType === params.documentType);
  if (params?.status) items = items.filter((i) => i.status === params.status);
  if (params?.priority) items = items.filter((i) => i.priority === params.priority);

  // Sort: priority → dueAt → createdAt
  const priorityOrder: Record<ReviewPriority, number> = {
    P0_CRITICAL: 0,
    P1_HIGH: 1,
    P2_MEDIUM: 2,
    P3_LOW: 3,
  };

  items.sort((a, b) => {
    const pd = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pd !== 0) return pd;
    return a.dueAt.getTime() - b.dueAt.getTime();
  });

  return params?.limit ? items.slice(0, params.limit) : items;
}

/**
 * 큐 통계
 */
export function getReviewQueueStats(): ReviewQueueStats {
  const now = new Date();
  const open = reviewQueue.filter((r) => r.status === "OPEN").length;
  const inProgress = reviewQueue.filter((r) => r.status === "IN_PROGRESS").length;
  const resolved = reviewQueue.filter((r) => r.status === "RESOLVED").length;
  const escalated = reviewQueue.filter((r) => r.status === "ESCALATED").length;
  const overdue = reviewQueue.filter((r) =>
    (r.status === "OPEN" || r.status === "IN_PROGRESS") && r.dueAt < now,
  ).length;

  const byPriority: Record<ReviewPriority, number> = {
    P0_CRITICAL: 0, P1_HIGH: 0, P2_MEDIUM: 0, P3_LOW: 0,
  };
  for (const r of reviewQueue.filter((r) => r.status !== "RESOLVED")) {
    byPriority[r.priority]++;
  }

  const resolvedItems = reviewQueue.filter((r) => r.resolvedAt);
  const avgResolutionHours = resolvedItems.length > 0
    ? resolvedItems.reduce((sum, r) => sum + (r.resolvedAt!.getTime() - r.createdAt.getTime()), 0) / resolvedItems.length / 3600_000
    : 0;

  return {
    total: reviewQueue.length,
    open,
    inProgress,
    resolved,
    escalated,
    overdue,
    byPriority,
    avgResolutionHours: Math.round(avgResolutionHours * 10) / 10,
    capacityPercent: Math.round(((open + inProgress) / MAX_CAPACITY) * 100),
  };
}

// ── Helpers ──

function computeReviewPriority(params: {
  mismatchCategory: string;
  isFalseSafeCandidate: boolean;
  confidence: number | null;
}): ReviewPriority {
  if (params.isFalseSafeCandidate) return "P0_CRITICAL";
  if (params.mismatchCategory === "AUTO_VERIFY_RISK") return "P0_CRITICAL";
  if (params.mismatchCategory === "DOC_TYPE_DIFF") return "P1_HIGH";
  if (params.mismatchCategory === "VERIFICATION_DIFF") return "P1_HIGH";
  if (params.confidence !== null && params.confidence >= 0.8) return "P2_MEDIUM";
  return "P3_LOW";
}

function computeDueDate(priority: ReviewPriority): Date {
  const now = new Date();
  const hoursMap: Record<ReviewPriority, number> = {
    P0_CRITICAL: 4,
    P1_HIGH: 24,
    P2_MEDIUM: 72,
    P3_LOW: 168, // 1 week
  };
  return new Date(now.getTime() + hoursMap[priority] * 3600_000);
}
