/**
 * BioInsight Lab Mobile — Canonical Icon & UI Color Tokens
 *
 * lucide-react-native의 color prop은 Tailwind className이 아닌 hex string을 받으므로
 * 여기서 한 곳에 정의하고 전체 앱에서 import하여 사용합니다.
 *
 * Tailwind 등가 색상을 주석으로 병기합니다.
 */

// ── Icon Colors (lucide color prop용) ──────────────────────────
export const iconColor = {
  /** 기본 아이콘 — slate-400 */
  muted: "#94a3b8",
  /** 본문 수준 아이콘 — slate-500 */
  secondary: "#64748b",
  /** 강조 아이콘 — slate-700 */
  emphasis: "#475569",
  /** 비활성/chevron — slate-300 */
  faint: "#cbd5e1",
  /** 프라이머리 액션 — blue-600 */
  primary: "#2563eb",
  /** 성공 — emerald-600 */
  success: "#059669",
  /** 경고 — amber-500 */
  warning: "#f59e0b",
  /** 위험/에러 — red-500 */
  danger: "#ef4444",
  /** 보라 — violet-500 */
  violet: "#8b5cf6",
  /** 스카이 — sky-500 */
  sky: "#0ea5e9",
  /** 흰색 — 버튼 내 아이콘 */
  white: "#ffffff",
} as const;

// ── ActivityIndicator / Spinner 색상 ───────────────────────────
export const spinnerColor = iconColor.primary;

// ── 상태 배경색 (Tailwind className으로 사용) ──────────────────
export const statusBg = {
  amber: "bg-amber-50",
  red: "bg-red-50",
  emerald: "bg-emerald-50",
  blue: "bg-blue-50",
  purple: "bg-purple-50",
  slate: "bg-slate-50",
} as const;

// ── 타이포그래피 참조 (className 조합) ─────────────────────────
export const typo = {
  /** 페이지 타이틀 */
  pageTitle: "text-lg font-bold text-slate-900",
  /** 섹션 헤더 */
  sectionHeader: "text-base font-bold text-slate-900",
  /** 서브 섹션 헤더 */
  subHeader: "text-sm font-bold text-slate-900",
  /** 카드 제목 */
  cardTitle: "text-sm font-semibold text-slate-900",
  /** 본문 */
  body: "text-sm text-slate-700",
  /** 메타/날짜 */
  meta: "text-xs text-slate-500",
  /** 힌트/보조 */
  hint: "text-xs text-slate-400",
  /** 섹션 라벨 (설정 등 그룹 제목) */
  sectionLabel: "text-xs font-semibold text-slate-500 uppercase tracking-wide",
} as const;
