/**
 * Console Visual Grammar — Canonical Design Tokens
 *
 * 모든 Ops Console surface가 참조하는 시각 문법 정의.
 * card-based SaaS → enterprise operational console 전환의 기반.
 *
 * §1 Typography Scale — 3-tier 텍스트 계층
 * §2 Spacing Scale — tight consistency 간격 체계
 * §3 Surface Hierarchy — 3단 surface 깊이
 * §4 Severity Indicators — priority tier → 시각 토큰 매핑
 * §5 CTA Hierarchy — 행당 CTA 규칙
 * §6 Queue Column Definitions — 큐 뷰 고정 column
 * §7 Metadata Placement Order — 전 surface 통일 순서
 *
 * 순수 정의 파일 — DB 호출 없음.
 */

import type { PriorityTier } from "./console-priorities";

// ══════════════════════════════════════════════════════
// §1: Typography Scale
// ══════════════════════════════════════════════════════

/**
 * 3-tier 텍스트 계층.
 * - heading: 적고 강하게
 * - body: row content
 * - micro: 작지만 읽혀야 함
 */
export const TYPOGRAPHY = {
  pageTitle: "text-lg font-semibold tracking-tight",
  sectionTitle: "text-xs font-semibold uppercase tracking-wide text-muted-foreground",
  rowTitle: "text-sm font-medium",
  metadata: "text-xs text-muted-foreground",
  timestamp: "text-xs tabular-nums text-muted-foreground",
  badge: "text-[10px] font-medium",
  cta: "text-xs font-medium",
} as const;

export type TypographyKey = keyof typeof TYPOGRAPHY;

// ══════════════════════════════════════════════════════
// §2: Spacing Scale
// ══════════════════════════════════════════════════════

/**
 * tight consistency — 넓은 여백보다 divider와 alignment로 구분.
 */
export const SPACING = {
  sectionGap: "space-y-6",
  groupGap: "space-y-0",
  rowPadding: "px-3 py-2",
  panelPadding: "p-4",
  metadataGap: "gap-3",
  ctaCluster: "gap-2",
  stickyHeader: "py-2 px-3",
  stripPadding: "px-3 py-1.5",
} as const;

export type SpacingKey = keyof typeof SPACING;

// ══════════════════════════════════════════════════════
// §3: Surface Hierarchy (3단 이내)
// ══════════════════════════════════════════════════════

/**
 * box-shadow 금지. border/divider 중심. radius 최소.
 */
export const SURFACE = {
  page: "bg-background",
  primary: "bg-card border rounded-md",
  secondary: "bg-muted/30",
  alertStrip: "border-l-[3px] bg-muted/20 px-3 py-2 rounded-sm",
  summaryStrip: "border-b bg-muted/10 px-3 py-2",
  sectionHeader: "border-b pb-2",
  row: "border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer",
  rowSelected: "bg-muted/50 border-b border-border/50",
} as const;

export type SurfaceKey = keyof typeof SURFACE;

// ══════════════════════════════════════════════════════
// §4: Severity Indicators
// ══════════════════════════════════════════════════════

/**
 * PriorityTier → 시각 토큰 매핑.
 *
 * 규칙:
 * - 배경색(bg-red-50 등) 완전 금지
 * - severity는 오직 left border 3px + dot + text color
 * - 동일 severity는 모든 화면에서 같은 treatment
 */
export interface SeverityIndicator {
  borderColor: string;
  dotColor: string;
  dotPulse: boolean;
  textColor: string;
}

export const SEVERITY_INDICATORS: Record<PriorityTier, SeverityIndicator> = {
  urgent_blocker: {
    borderColor: "border-l-red-500",
    dotColor: "red",
    dotPulse: true,
    textColor: "text-red-700",
  },
  approval_needed: {
    borderColor: "border-l-orange-400",
    dotColor: "amber",
    dotPulse: false,
    textColor: "text-orange-700",
  },
  action_needed: {
    borderColor: "border-l-yellow-400",
    dotColor: "yellow",
    dotPulse: false,
    textColor: "text-yellow-700",
  },
  monitoring: {
    borderColor: "border-l-blue-300",
    dotColor: "blue",
    dotPulse: false,
    textColor: "text-blue-600",
  },
  informational: {
    borderColor: "border-l-gray-200",
    dotColor: "slate",
    dotPulse: false,
    textColor: "text-muted-foreground",
  },
} as const;

// ══════════════════════════════════════════════════════
// §5: CTA Hierarchy
// ══════════════════════════════════════════════════════

/**
 * 행에 primary 1개 + secondary 최대 2개. 나머지는 detail panel overflow.
 */
export interface CtaRule {
  variant: "default" | "outline" | "destructive" | "ghost";
  size: "sm";
  maxPerRow: number;
  inDetailOnly: boolean;
}

export const CTA_HIERARCHY: Record<string, CtaRule> = {
  primary: { variant: "default", size: "sm", maxPerRow: 1, inDetailOnly: false },
  secondary: { variant: "outline", size: "sm", maxPerRow: 2, inDetailOnly: false },
  destructive: { variant: "destructive", size: "sm", maxPerRow: 1, inDetailOnly: false },
  overflow: { variant: "ghost", size: "sm", maxPerRow: 0, inDetailOnly: true },
} as const;

export type CtaLevel = keyof typeof CTA_HIERARCHY;

// ══════════════════════════════════════════════════════
// §6: Queue Column Definitions
// ══════════════════════════════════════════════════════

export interface QueueColumnDef {
  id: string;
  label: string;
  width: string;
  align: "left" | "center" | "right";
}

export const QUEUE_COLUMNS: readonly QueueColumnDef[] = [
  { id: "severity", label: "", width: "w-1", align: "left" },
  { id: "title", label: "항목", width: "flex-1 min-w-0", align: "left" },
  { id: "state", label: "상태", width: "w-20", align: "center" },
  { id: "owner", label: "담당", width: "w-16", align: "center" },
  { id: "whyHere", label: "사유", width: "w-32", align: "left" },
  { id: "age", label: "경과", width: "w-16", align: "right" },
  { id: "cta", label: "", width: "w-24", align: "right" },
] as const;

// ══════════════════════════════════════════════════════
// §7: Metadata Placement Order
// ══════════════════════════════════════════════════════

/**
 * 모든 surface에서 동일 순서. metadata가 화면마다 다르면 enterprise feel이 깨진다.
 */
export const METADATA_ORDER = [
  "current_state",
  "owner_assignee",
  "latest_action",
  "last_updated",
  "sla_stale_breach",
  "linked_entity",
  "remediation_handoff_note",
] as const;

export type MetadataField = (typeof METADATA_ORDER)[number];

// ══════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════

/** PriorityTier의 severity indicator를 반환합니다. */
export function getSeverityIndicator(tier: PriorityTier): SeverityIndicator {
  return SEVERITY_INDICATORS[tier];
}

/** CTA level에 따른 Button variant를 반환합니다. */
export function getCtaVariant(level: CtaLevel): CtaRule["variant"] {
  return CTA_HIERARCHY[level]?.variant ?? "ghost";
}
