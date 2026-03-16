/**
 * Compare Decision & Inquiry Draft — shared state configs
 *
 * Single source of truth for labels, colors, and badge rendering
 * across compare-history-section, compare-analysis-drawer, and dashboard.
 */

// ── Decision State ──

export interface DecisionStateConfig {
  label: string;
  dotColor: string;
  className: string;
  pulse?: boolean;
}

export const DECISION_STATE_CONFIG: Record<string, DecisionStateConfig> = {
  UNDECIDED: { label: "검토 중", dotColor: "amber", className: "text-amber-700 bg-amber-50", pulse: true },
  APPROVED: { label: "승인", dotColor: "emerald", className: "text-emerald-700 bg-emerald-50" },
  HELD: { label: "보류", dotColor: "blue", className: "text-blue-700 bg-blue-50" },
  REJECTED: { label: "반려", dotColor: "red", className: "text-red-700 bg-red-50" },
};

export const DECISION_STATE_FALLBACK: DecisionStateConfig = {
  label: "미결정",
  dotColor: "slate",
  className: "text-slate-500 bg-slate-50",
};

export function getDecisionConfig(state: string | null): DecisionStateConfig {
  if (!state) return DECISION_STATE_FALLBACK;
  return DECISION_STATE_CONFIG[state] ?? DECISION_STATE_FALLBACK;
}

// ── Inquiry Draft Status ──

export interface DraftStatusConfig {
  label: string;
  className: string;
}

export const INQUIRY_DRAFT_STATUS_CONFIG: Record<string, DraftStatusConfig> = {
  GENERATED: { label: "생성됨", className: "bg-blue-50 text-blue-700" },
  COPIED: { label: "복사됨", className: "bg-green-50 text-green-700" },
  SENT: { label: "발송됨", className: "bg-purple-50 text-purple-700" },
};

export function getDraftStatusConfig(status: string): DraftStatusConfig {
  return INQUIRY_DRAFT_STATUS_CONFIG[status] ?? INQUIRY_DRAFT_STATUS_CONFIG.GENERATED;
}

// ── Verdict ──

export interface VerdictConfig {
  label: string;
  className: string;
}

export const VERDICT_CONFIG: Record<string, VerdictConfig> = {
  EQUIVALENT: { label: "동일", className: "bg-green-50 text-green-700" },
  MINOR_DIFFERENCES: { label: "경미", className: "bg-blue-50 text-blue-700" },
  SIGNIFICANT_DIFFERENCES: { label: "중요", className: "bg-orange-50 text-orange-700" },
  INCOMPATIBLE: { label: "불가", className: "bg-red-50 text-red-700" },
  REQUIRES_EXPERT: { label: "전문가", className: "bg-purple-50 text-purple-700" },
};

// ── Formatting ──

export function formatDecisionTimestamp(decidedAt: string | null): string {
  if (!decidedAt) return "";
  const d = new Date(decidedAt);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}
