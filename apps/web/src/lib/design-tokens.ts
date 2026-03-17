/**
 * BioInsight Lab — Operational Console Design Tokens
 *
 * Premium / Precise / Operational / High-Trust
 * Dark navy/charcoal base + precise blue accent
 */

// ── Background ──
export const BG = {
  page: "bg-slate-950",
  surface: "bg-slate-900",
  elevated: "bg-slate-800",
  hover: "bg-slate-800/60",
  selected: "bg-blue-600/10",
  muted: "bg-slate-900/50",
} as const;

// ── Border ──
export const BORDER = {
  default: "border-slate-800",
  subtle: "border-slate-800/50",
  active: "border-blue-600",
  divider: "divide-slate-800",
  severity: {
    critical: "border-l-red-500",
    warning: "border-l-amber-500",
    info: "border-l-blue-500",
    success: "border-l-emerald-500",
    neutral: "border-l-slate-700",
  },
} as const;

// ── Text ──
export const TEXT = {
  primary: "text-slate-100",
  secondary: "text-slate-400",
  muted: "text-slate-500",
  accent: "text-blue-400",
  danger: "text-red-400",
  warning: "text-amber-400",
  success: "text-emerald-400",
} as const;

// ── Typography Scale ──
export const TYPE = {
  pageTitle: "text-base font-semibold text-slate-100",
  sectionTitle: "text-xs font-medium uppercase tracking-wider text-slate-500",
  rowTitle: "text-sm font-medium text-slate-200",
  metadata: "text-xs text-slate-500",
  timestamp: "text-[11px] text-slate-600 tabular-nums",
  value: "text-sm font-semibold tabular-nums text-slate-100",
  valueLarge: "text-lg font-bold tabular-nums text-slate-100",
  badge: "text-[10px] font-medium px-1.5 py-0.5",
  label: "text-xs font-medium text-slate-400",
} as const;

// ── Surface ──
export const SURFACE = {
  panel: "bg-slate-900 border border-slate-800 rounded",
  panelElevated: "bg-slate-800 border border-slate-700 rounded",
  row: "px-3 py-2 border-b border-slate-800/50 hover:bg-slate-800/40 transition-colors",
  rowSelected: "px-3 py-2 border-b border-slate-800/50 bg-blue-600/10 border-l-2 border-l-blue-500",
  strip: "flex flex-wrap items-center gap-4 border border-slate-800 rounded px-3 py-1.5 bg-slate-900",
  sectionHeader: "border-b border-slate-800 pb-2",
  alertStrip: "border-l-[3px] rounded px-3 py-2 bg-slate-900 border border-slate-800",
} as const;

// ── CTA Hierarchy ──
export const CTA = {
  primary: "bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-3 py-1.5 rounded transition-colors",
  secondary: "border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-medium px-3 py-1.5 rounded transition-colors",
  destructive: "bg-red-600/80 hover:bg-red-500 text-white text-xs font-medium px-3 py-1.5 rounded transition-colors",
  ghost: "hover:bg-slate-800 text-slate-400 text-xs px-2 py-1 rounded transition-colors",
} as const;

// ── Spacing ──
export const SPACING = {
  page: "p-4 md:p-6",
  section: "space-y-4",
  panel: "px-4 py-3",
  row: "px-3 py-2",
  strip: "px-3 py-1.5",
  gap: "gap-4",
  gapTight: "gap-2",
} as const;

// ── Motion ──
export const MOTION = {
  fast: "duration-[120ms] ease-out",
  normal: "duration-[180ms] ease-out",
  slow: "duration-[220ms] ease-out",
  fadeSwitch: "animate-motion-fade-switch",
  softRefresh: "animate-motion-soft-refresh",
  optimistic: "animate-motion-optimistic",
} as const;
