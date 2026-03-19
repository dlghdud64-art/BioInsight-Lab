"use client";

/**
 * Overview Shell — 조직 운영 허브 개요 탭 공통 셸 컴포넌트
 *
 * 모든 overview 블록이 공유하는 레이아웃/상태 문법.
 * - Section wrapper (title + helperText + body + footer)
 * - Block state renderer (loading/normal/empty/unavailable)
 * - Empty/Unavailable card
 * - Two-column layout
 * - Block skeleton
 * - Footer CTA
 */

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, RefreshCw, ArrowRight, Search } from "lucide-react";
import Link from "next/link";

// ═══════════════════════════════════════════════════
// 1. OrganizationOverviewSection
// ═══════════════════════════════════════════════════

interface OverviewSectionProps {
  title: string;
  helperText?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  headerAction?: React.ReactNode;
  tone?: "default" | "subtle";
  className?: string;
}

export function OverviewSection({
  title,
  helperText,
  children,
  footer,
  headerAction,
  tone = "default",
  className,
}: OverviewSectionProps) {
  return (
    <section className={cn("space-y-3", className)}>
      {/* Header */}
      <OverviewSectionHeader
        title={title}
        helperText={helperText}
        action={headerAction}
        tone={tone}
      />
      {/* Body */}
      <div>{children}</div>
      {/* Footer */}
      {footer && <div className="pt-1">{footer}</div>}
    </section>
  );
}

// ═══════════════════════════════════════════════════
// 2. OverviewSectionHeader
// ═══════════════════════════════════════════════════

interface SectionHeaderProps {
  title: string;
  helperText?: string;
  action?: React.ReactNode;
  tone?: "default" | "subtle";
}

export function OverviewSectionHeader({ title, helperText, action, tone = "default" }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h3 className={cn(
          "font-bold",
          tone === "default" ? "text-sm text-slate-100" : "text-xs text-slate-300"
        )}>
          {title}
        </h3>
        {helperText && (
          <span className="text-[10px] text-slate-500 hidden md:inline">{helperText}</span>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// 3. OverviewSectionFooter
// ═══════════════════════════════════════════════════

interface SectionFooterProps {
  children: React.ReactNode;
}

export function OverviewSectionFooter({ children }: SectionFooterProps) {
  return (
    <div className="flex items-center justify-end gap-2 pt-1">
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// 4. OverviewBlockStateRenderer
// ═══════════════════════════════════════════════════

type BlockUiState = "loading" | "normal" | "empty" | "unavailable";

interface BlockStateRendererProps {
  state: BlockUiState;
  loadingMessage?: string;
  emptyMessage?: string;
  emptyDescription?: string;
  emptyCta?: { label: string; href: string };
  unavailableMessage?: string;
  retryCta?: string;
  onRetry?: () => void;
  skeletonHeight?: number;
  children: React.ReactNode; // normal state content
}

export function OverviewBlockStateRenderer({
  state,
  loadingMessage = "데이터를 불러오는 중...",
  emptyMessage = "표시할 항목이 없습니다",
  emptyDescription,
  emptyCta,
  unavailableMessage = "데이터를 불러오지 못했습니다",
  retryCta = "다시 불러오기",
  onRetry,
  skeletonHeight,
  children,
}: BlockStateRendererProps) {
  if (state === "loading") {
    return <OverviewBlockSkeleton message={loadingMessage} height={skeletonHeight} />;
  }
  if (state === "empty") {
    return (
      <OverviewEmptyCard
        message={emptyMessage}
        description={emptyDescription}
        cta={emptyCta}
      />
    );
  }
  if (state === "unavailable") {
    return (
      <OverviewUnavailableCard
        message={unavailableMessage}
        retryCta={retryCta}
        onRetry={onRetry}
      />
    );
  }
  return <>{children}</>;
}

// ═══════════════════════════════════════════════════
// 5. OverviewEmptyCard
// ═══════════════════════════════════════════════════

interface EmptyCardProps {
  message: string;
  description?: string;
  icon?: React.ReactNode;
  cta?: { label: string; href: string };
}

export function OverviewEmptyCard({ message, description, icon, cta }: EmptyCardProps) {
  return (
    <div className="bg-pn border border-bd rounded-lg p-5 text-center">
      {icon && <div className="flex justify-center mb-2">{icon}</div>}
      <p className="text-xs text-slate-400">{message}</p>
      {description && <p className="text-[10px] text-slate-500 mt-1">{description}</p>}
      {cta && (
        <Button asChild variant="outline" size="sm" className="h-7 text-[11px] mt-3 border-bd">
          <Link href={cta.href}>{cta.label}</Link>
        </Button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// 6. OverviewUnavailableCard
// ═══════════════════════════════════════════════════

interface UnavailableCardProps {
  message: string;
  retryCta?: string;
  onRetry?: () => void;
}

export function OverviewUnavailableCard({
  message,
  retryCta = "다시 불러오기",
  onRetry,
}: UnavailableCardProps) {
  return (
    <div className="bg-pn border border-amber-500/20 rounded-lg p-4 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
        <span className="text-xs text-slate-400">{message}</span>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 transition-colors shrink-0"
        >
          <RefreshCw className="h-3 w-3" />
          {retryCta}
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// 7. OverviewBlockSkeleton
// ═══════════════════════════════════════════════════

interface SkeletonProps {
  message?: string;
  height?: number;
}

export function OverviewBlockSkeleton({ message = "데이터를 불러오는 중...", height }: SkeletonProps) {
  return (
    <div
      className="bg-pn border border-bd rounded-lg flex items-center justify-center gap-2 text-slate-500"
      style={{ minHeight: height ? `${height}px` : "80px" }}
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      <span className="text-xs">{message}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// 8. OverviewTwoColumnLayout
// ═══════════════════════════════════════════════════

interface TwoColumnProps {
  children: React.ReactNode;
  ratio?: "1:1" | "2:1" | "1:2";
  className?: string;
}

export function OverviewTwoColumnLayout({ children, ratio = "1:1", className }: TwoColumnProps) {
  const gridCls =
    ratio === "2:1" ? "md:grid-cols-[2fr_1fr]" :
    ratio === "1:2" ? "md:grid-cols-[1fr_2fr]" :
    "md:grid-cols-2";

  return (
    <div className={cn("grid gap-3", gridCls, className)}>
      {children}
    </div>
  );
}
