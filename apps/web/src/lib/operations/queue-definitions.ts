/**
 * P7-3 — Dashboard / Work Queue Definitions
 *
 * 6 canonical queues that drive the operational dashboard.
 * Each queue has:
 *   - source states that populate it
 *   - priority levels (P0–P3)
 *   - CTA actions available per row
 *   - sort/filter defaults
 */

import type { ScreenId } from "./cta-definitions";

// ══════════════════════════════════════════════════════════════════════════════
// Priority Levels
// ══════════════════════════════════════════════════════════════════════════════

export type PriorityLevel = "P0" | "P1" | "P2" | "P3";

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  P0: "긴급",
  P1: "높음",
  P2: "보통",
  P3: "낮음",
};

export const PRIORITY_BADGE_COLORS: Record<PriorityLevel, string> = {
  P0: "bg-red-900/40 text-red-800",
  P1: "bg-orange-900/40 text-orange-800",
  P2: "bg-blue-900/30 text-blue-800",
  P3: "bg-slate-800 text-slate-400",
};

// ══════════════════════════════════════════════════════════════════════════════
// Queue Definition
// ══════════════════════════════════════════════════════════════════════════════

export interface QueueDefinition {
  queueId: string;
  queueLabel: string;
  description: string;
  sourceStates: string[];
  defaultPriority: PriorityLevel;
  priorityRules: PriorityRule[];
  availableCTAs: string[];
  targetScreen: ScreenId;
  sortDefault: string;
  emptyMessage: string;
}

export interface PriorityRule {
  condition: string;
  priority: PriorityLevel;
  reason: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// 6 Canonical Queues
// ══════════════════════════════════════════════════════════════════════════════

export const CANONICAL_QUEUES: QueueDefinition[] = [
  // ── 1. 견적 회신 대기 ──
  {
    queueId: "Q-QUOTE-REPLY",
    queueLabel: "견적 회신 대기",
    description: "벤더 회신을 기다리는 견적 목록",
    sourceStates: ["SENT", "RESPONDED"],
    defaultPriority: "P2",
    priorityRules: [
      {
        condition: "sentAt > 7 days ago",
        priority: "P1",
        reason: "7일 이상 미회신",
      },
      {
        condition: "sentAt > 14 days ago",
        priority: "P0",
        reason: "14일 이상 미회신 — 긴급 후속 필요",
      },
    ],
    availableCTAs: ["CTA-Q2", "CTA-Q4"],
    targetScreen: "quote",
    sortDefault: "sentAt ASC",
    emptyMessage: "회신 대기 중인 견적이 없습니다.",
  },

  // ── 2. 구매 승인 대기 ──
  {
    queueId: "Q-PURCHASE-APPROVAL",
    queueLabel: "구매 승인 대기",
    description: "승인자 검토를 기다리는 구매 요청",
    sourceStates: ["PENDING (with approver)"],
    defaultPriority: "P2",
    priorityRules: [
      {
        condition: "requestedAt > 3 days ago",
        priority: "P1",
        reason: "3일 이상 미승인",
      },
      {
        condition: "totalAmount > budget threshold",
        priority: "P1",
        reason: "고액 구매 — 빠른 검토 필요",
      },
    ],
    availableCTAs: ["CTA-P2", "CTA-P3"],
    targetScreen: "purchase",
    sortDefault: "createdAt ASC",
    emptyMessage: "승인 대기 중인 구매 요청이 없습니다.",
  },

  // ── 3. 발주 추적 ──
  {
    queueId: "Q-ORDER-TRACKING",
    queueLabel: "발주 추적",
    description: "발주~배송 완료 사이의 주문 추적",
    sourceStates: ["ORDERED", "CONFIRMED", "SHIPPING"],
    defaultPriority: "P3",
    priorityRules: [
      {
        condition: "expectedDelivery < today",
        priority: "P0",
        reason: "배송 지연",
      },
      {
        condition: "expectedDelivery <= today + 2 days",
        priority: "P1",
        reason: "배송 임박",
      },
      {
        condition: "status === SHIPPING",
        priority: "P2",
        reason: "배송 중",
      },
    ],
    availableCTAs: ["CTA-O1", "CTA-O2", "CTA-O3", "CTA-O4"],
    targetScreen: "purchase",
    sortDefault: "expectedDelivery ASC",
    emptyMessage: "추적 중인 발주가 없습니다.",
  },

  // ── 4. 입고 대기 ──
  {
    queueId: "Q-RECEIVING",
    queueLabel: "입고 대기",
    description: "배송 완료 후 입고 처리가 필요한 항목",
    sourceStates: ["PENDING", "PARTIAL", "ISSUE"],
    defaultPriority: "P2",
    priorityRules: [
      {
        condition: "receivingStatus === ISSUE",
        priority: "P0",
        reason: "입고 이슈 발생 — 즉시 처리",
      },
      {
        condition: "createdAt > 3 days ago && receivingStatus === PENDING",
        priority: "P1",
        reason: "3일 이상 미처리",
      },
    ],
    availableCTAs: ["CTA-R1", "CTA-R2"],
    targetScreen: "receiving",
    sortDefault: "createdAt ASC",
    emptyMessage: "입고 대기 중인 항목이 없습니다.",
  },

  // ── 5. 재고 부족 / 재주문 ──
  {
    queueId: "Q-INVENTORY-LOW",
    queueLabel: "재고 부족",
    description: "안전재고 이하이거나 유효기한 임박 품목",
    sourceStates: ["LOW", "EXPIRING"],
    defaultPriority: "P2",
    priorityRules: [
      {
        condition: "currentQuantity === 0",
        priority: "P0",
        reason: "재고 소진",
      },
      {
        condition: "condition === EXPIRING && daysUntilExpiry <= 7",
        priority: "P0",
        reason: "7일 이내 만료",
      },
      {
        condition: "condition === LOW && currentQuantity < safetyStock * 0.5",
        priority: "P1",
        reason: "안전재고 50% 미만",
      },
    ],
    availableCTAs: ["CTA-I1"],
    targetScreen: "inventory",
    sortDefault: "currentQuantity ASC",
    emptyMessage: "재고 부족 품목이 없습니다.",
  },

  // ── 6. 폐기 / 만료 처리 ──
  {
    queueId: "Q-INVENTORY-DISPOSAL",
    queueLabel: "폐기 / 만료",
    description: "만료되었거나 폐기 예정인 품목",
    sourceStates: ["EXPIRED", "DISPOSAL_SCHEDULED"],
    defaultPriority: "P1",
    priorityRules: [
      {
        condition: "condition === EXPIRED && disposalScheduledAt is null",
        priority: "P0",
        reason: "만료 — 폐기 미예약",
      },
      {
        condition: "disposalScheduledAt < today + 3 days",
        priority: "P0",
        reason: "폐기일 임박",
      },
    ],
    availableCTAs: ["CTA-I2"],
    targetScreen: "inventory",
    sortDefault: "expiryDate ASC",
    emptyMessage: "폐기 또는 만료 처리가 필요한 품목이 없습니다.",
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// Dashboard Layout Zones
// ══════════════════════════════════════════════════════════════════════════════

export interface DashboardZone {
  zoneId: string;
  zoneLabel: string;
  queueIds: string[];
  layout: "card-grid" | "table-list";
}

export const DASHBOARD_ZONES: DashboardZone[] = [
  {
    zoneId: "ZONE-KPI",
    zoneLabel: "KPI 요약",
    queueIds: [],
    layout: "card-grid",
  },
  {
    zoneId: "ZONE-URGENT",
    zoneLabel: "긴급 작업",
    queueIds: [
      "Q-RECEIVING",
      "Q-INVENTORY-DISPOSAL",
    ],
    layout: "table-list",
  },
  {
    zoneId: "ZONE-PENDING",
    zoneLabel: "진행 중",
    queueIds: [
      "Q-QUOTE-REPLY",
      "Q-PURCHASE-APPROVAL",
      "Q-ORDER-TRACKING",
    ],
    layout: "table-list",
  },
  {
    zoneId: "ZONE-REORDER",
    zoneLabel: "재주문 필요",
    queueIds: [
      "Q-INVENTORY-LOW",
    ],
    layout: "table-list",
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// Work Queue Row Schema (for rendering)
// ══════════════════════════════════════════════════════════════════════════════

export interface WorkQueueRow {
  queueId: string;
  entityType: string;
  entityId: string;
  title: string;
  subtitle?: string;
  priority: PriorityLevel;
  priorityReason: string;
  status: string;
  statusLabel: string;
  ctaIds: string[];
  createdAt: Date;
  dueAt?: Date | null;
  metadata?: Record<string, unknown>;
}
