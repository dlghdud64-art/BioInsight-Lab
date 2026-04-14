"use client";

/**
 * PageShell + AppPageHeader
 *
 * 인증 후 앱 페이지의 통일된 상단 계약.
 *
 * PageShell: 페이지 가로 폭, 좌우 패딩, 상단 여백을 통일.
 * AppPageHeader: 3행 구조 (breadcrumb / title+chip / description+actions).
 *
 * 절대 규칙:
 * - white hero/header card 배경 금지
 * - decorative emoji 금지
 * - 영어 eyebrow (SPEND INTELLIGENCE 등) 금지
 * - Live/Beta/AI 장식 배지 금지 (진짜 gated rollout만 예외)
 * - primary CTA 최대 1개
 * - blue = CTA/active/selected
 * - green/amber/red = status only
 *
 * preset:
 * - overview: 대시보드 / 지출 분석 / 예산 관리 / 조직 관리
 * - workbench: 견적 관리 / 구매 운영 / 발주 전환 큐 / 재고 관리
 */

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ══════════════════════════════════════════════
// PageShell
// ══════════════════════════════════════════════

export type PageShellPreset = "overview" | "workbench";

interface PageShellProps {
  preset?: PageShellPreset;
  children: React.ReactNode;
  className?: string;
}

/**
 * 페이지 최외곽 wrapper. max-width + padding을 통일한다.
 * header와 body가 동일한 x-axis를 공유.
 */
export function PageShell({ preset = "overview", children, className }: PageShellProps) {
  return (
    <div
      className={cn(
        "w-full mx-auto space-y-5",
        preset === "workbench" ? "max-w-full" : "max-w-7xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ══════════════════════════════════════════════
// AppPageHeader
// ══════════════════════════════════════════════

type HeaderActionTone = "primary" | "secondary" | "ghost";
type HeaderStatusTone = "neutral" | "info" | "success" | "warning" | "danger";

interface HeaderBreadcrumb {
  label: string;
  href?: string;
}

interface HeaderAction {
  label: string;
  href?: string;
  onClick?: () => void;
  tone?: HeaderActionTone;
  icon?: React.ReactNode;
  disabled?: boolean;
  /** 커스텀 렌더링 (DropdownMenu 등) */
  render?: React.ReactNode;
}

interface HeaderStatusChip {
  label: string;
  tone: HeaderStatusTone;
}

interface AppPageHeaderProps {
  breadcrumbs?: HeaderBreadcrumb[];
  title: string;
  description?: string;
  statusChip?: HeaderStatusChip;
  actions?: HeaderAction[];
  /** 추가 className */
  className?: string;
}

const STATUS_CHIP_STYLES: Record<HeaderStatusTone, string> = {
  neutral: "bg-slate-100 text-slate-600 border-slate-200",
  info: "bg-blue-50 text-blue-700 border-blue-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-red-50 text-red-700 border-red-200",
};

const ACTION_TONE_STYLES: Record<HeaderActionTone, string> = {
  primary: "bg-blue-600 hover:bg-blue-700 text-white shadow-sm",
  secondary: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
  ghost: "text-slate-500 hover:text-slate-700 hover:bg-slate-100",
};

export function AppPageHeader({
  breadcrumbs,
  title,
  description,
  statusChip,
  actions,
  className,
}: AppPageHeaderProps) {
  return (
    <div className={cn("space-y-1", className)}>
      {/* Row 1: breadcrumb */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-xs text-slate-500">
          {breadcrumbs.map((crumb, idx) => (
            <span key={idx} className="flex items-center gap-1.5">
              {idx > 0 && <ChevronRight className="h-3 w-3 text-slate-300" />}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-slate-700 transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-slate-900 font-medium">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Row 2-3: title/description + actions */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          {/* Row 2: title + optional chip */}
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900 leading-tight">
              {title}
            </h1>
            {statusChip && (
              <span
                className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border",
                  STATUS_CHIP_STYLES[statusChip.tone],
                )}
              >
                {statusChip.label}
              </span>
            )}
          </div>
          {/* Row 3: description */}
          {description && (
            <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
          )}
        </div>

        {/* Actions */}
        {actions && actions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
            {actions.map((action, idx) => {
              if (action.render) return <span key={idx}>{action.render}</span>;

              const tone = action.tone ?? "secondary";
              const Comp = action.href ? Link : "button";
              const compProps = action.href
                ? { href: action.href }
                : { type: "button" as const, onClick: action.onClick, disabled: action.disabled };

              return (
                <Comp key={idx} {...(compProps as any)}>
                  <Button
                    size="sm"
                    variant={tone === "ghost" ? "ghost" : "outline"}
                    className={cn(
                      "h-9 text-xs sm:text-sm gap-1.5 font-semibold",
                      ACTION_TONE_STYLES[tone],
                    )}
                    disabled={action.disabled}
                    onClick={!action.href ? action.onClick : undefined}
                  >
                    {action.icon}
                    {action.label}
                  </Button>
                </Comp>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Legacy export (하위 호환) ──
export const PageHeader = AppPageHeader;
