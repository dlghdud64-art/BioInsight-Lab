"use client";

/**
 * Block State UI Components
 *
 * BlockSkeleton / EmptyState / ErrorState / UnavailableState
 * 모든 Block 컴포넌트가 공유하는 상태별 UI.
 *
 * 규칙:
 * - empty에 retry 버튼 금지
 * - error에서 자동 재시도 무한 루프 금지
 * - unavailable에서 버튼 클릭 가능하게 두지 말 것
 * - skeleton 없이 갑작스러운 UI 점프 금지
 */

import { Button } from "@/components/ui/button";
import { AlertTriangle, Lock, RefreshCw } from "lucide-react";

// ═══════════════════════════════════════════════════
// 1. BlockSkeleton (loading)
// ═══════════════════════════════════════════════════

interface SkeletonBarProps {
  height?: number;
  width?: string;
}

function SkeletonBar({ height = 16, width = "100%" }: SkeletonBarProps) {
  return (
    <div
      className="bg-st/50 rounded animate-pulse"
      style={{ height: `${height}px`, width }}
    />
  );
}

interface BlockSkeletonProps {
  children?: React.ReactNode;
  minHeight?: number;
}

export function BlockSkeleton({ children, minHeight }: BlockSkeletonProps) {
  return (
    <div
      className="bg-pn border border-bd rounded-xl p-4 space-y-3"
      style={{ minHeight: minHeight ? `${minHeight}px` : undefined }}
      role="status"
      aria-busy="true"
      aria-label="데이터를 불러오는 중"
      data-testid="block-skeleton"
    >
      {children ?? (
        <>
          <SkeletonBar height={24} width="40%" />
          <SkeletonBar height={16} width="100%" />
          <SkeletonBar height={16} width="75%" />
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// 2. EmptyState
// ═══════════════════════════════════════════════════

interface EmptyStateProps {
  title: string;
  description?: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  icon?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  primaryAction,
  secondaryAction,
  icon,
}: EmptyStateProps) {
  return (
    <div className="bg-pn border border-bd rounded-xl p-6 text-center" role="status" data-testid="block-empty-state">
      {icon && <div className="flex justify-center mb-3">{icon}</div>}
      <p className="text-sm font-medium text-slate-600 mb-1">{title}</p>
      {description && <p className="text-xs text-slate-500 mb-4">{description}</p>}
      {(primaryAction || secondaryAction) && (
        <div className="flex items-center justify-center gap-2">
          {primaryAction && (
            <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-500" onClick={primaryAction.onClick}>
              {primaryAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button size="sm" variant="outline" className="h-8 text-xs border-bd" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// 3. ErrorState
// ═══════════════════════════════════════════════════

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryCta?: string;
}

export function ErrorState({
  title = "데이터를 불러오지 못했습니다",
  description = "잠시 후 다시 시도해주세요",
  onRetry,
  retryCta = "다시 불러오기",
}: ErrorStateProps) {
  return (
    <div className="bg-pn border border-amber-500/20 rounded-xl p-5 flex items-center justify-between" role="alert" data-testid="block-error-state">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-slate-700">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
      </div>
      {onRetry && (
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs border-bd shrink-0"
          onClick={onRetry}
        >
          <RefreshCw className="h-3 w-3 mr-1.5" />
          {retryCta}
        </Button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// 4. UnavailableState
// ═══════════════════════════════════════════════════

interface UnavailableStateProps {
  title: string;
  description?: string;
  primaryAction?: {
    label: string;
    href: string;
  };
}

export function UnavailableState({
  title,
  description,
  primaryAction,
}: UnavailableStateProps) {
  return (
    <div className="bg-pn border border-bd rounded-xl p-5 text-center opacity-75" role="status" aria-label="기능 사용 불가" data-testid="block-unavailable-state">
      <Lock className="h-5 w-5 text-slate-500 mx-auto mb-2" aria-hidden="true" />
      <p className="text-sm font-medium text-slate-600 mb-1">{title}</p>
      {description && <p className="text-xs text-slate-500 mb-3">{description}</p>}
      {primaryAction && (
        <Button size="sm" variant="outline" className="h-8 text-xs border-bd pointer-events-none opacity-50" disabled>
          {primaryAction.label}
        </Button>
      )}
    </div>
  );
}
