"use client";

/**
 * Page Shell — 운영 페이지 공통 골격
 *
 * 모든 핵심 페이지가 공유하는 구조:
 * - h1 title + description + header actions
 * - page-level state 처리 (loading/error/unavailable)
 * - ready 상태에서만 children 렌더
 * - 공통 spacing / width 제어
 */

import type { BlockState } from "@/lib/review-queue/ops-hub-block-states";
import { BlockSkeleton, ErrorState, UnavailableState } from "./block-state-ui";

// ═══════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════

export type PageRole = "ops-hub" | "search" | "analysis" | "detail";

interface PageShellProps {
  /** 페이지 제목 (h1) */
  title: string;
  /** 보조 설명 */
  description?: string;
  /** 우측 header actions */
  headerActions?: React.ReactNode;
  /** 페이지 역할 (문서화 용도) */
  role?: PageRole;

  /** page-level 상태 */
  state: BlockState;
  /** error 시 메시지 */
  errorMessage?: string;
  /** error 시 retry 가능 여부 */
  isRetryable?: boolean;
  /** retry handler */
  onRetry?: () => void;
  /** unavailable 시 정보 */
  unavailable?: {
    title: string;
    description?: string;
  };

  /** ready 상태 본문 */
  children: React.ReactNode;
}

// ═══════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════

export function PageShell({
  title,
  description,
  headerActions,
  state,
  errorMessage,
  isRetryable,
  onRetry,
  unavailable,
  children,
}: PageShellProps) {
  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900">{title}</h1>
          {description && (
            <p className="text-xs text-slate-400 mt-0.5">{description}</p>
          )}
        </div>
        {headerActions && state === "ready" && (
          <div className="flex items-center gap-2 shrink-0">{headerActions}</div>
        )}
      </header>

      {/* ── Page-level state ── */}
      {state === "loading" && (
        <div className="space-y-4" role="status" aria-busy="true" aria-label="페이지 로딩 중">
          <BlockSkeleton minHeight={80} />
          <BlockSkeleton minHeight={120} />
          <BlockSkeleton minHeight={200} />
        </div>
      )}

      {state === "error" && (
        <ErrorState
          title="페이지 데이터를 불러오지 못했습니다"
          description={errorMessage}
          onRetry={isRetryable ? onRetry : undefined}
        />
      )}

      {state === "unavailable" && (
        <UnavailableState
          title={unavailable?.title ?? "이 페이지를 사용할 수 없습니다"}
          description={unavailable?.description}
        />
      )}

      {state === "empty" && children}
      {state === "ready" && children}
    </div>
  );
}
