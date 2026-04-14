"use client";

/**
 * PageHeader — 인증 후 앱 페이지의 통일된 상단 헤더 계약
 *
 * 모든 authenticated route의 page header는 이 컴포넌트를 사용한다.
 * 본문 density는 route마다 달라도 되지만, header grammar는 동일해야 한다.
 *
 * 구조 (3행):
 *  1행: breadcrumb
 *  2행: title + optional status chip
 *  3행: description + action group (우측 정렬)
 *
 * 금지:
 * - white hero/header card 배경
 * - decorative emoji
 * - marketing eyebrow (SPEND INTELLIGENCE 등)
 * - 영어 배지 (Live, Beta, AI) — 진짜 gated rollout만 예외
 * - semantic color를 브랜드 장식으로 사용
 */

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  /** breadcrumb 경로 */
  breadcrumbs?: Breadcrumb[];
  /** 페이지 제목 */
  title: string;
  /** 제목 우측 상태 chip (optional) */
  statusChip?: React.ReactNode;
  /** 한 줄 설명 */
  description?: string;
  /** 우측 액션 그룹 */
  actions?: React.ReactNode;
  /** 추가 className */
  className?: string;
}

export function PageHeader({
  breadcrumbs,
  title,
  statusChip,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-1", className)}>
      {/* 1행: breadcrumb */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-xs text-slate-500">
          {breadcrumbs.map((crumb, idx) => (
            <span key={idx} className="flex items-center gap-1.5">
              {idx > 0 && <ChevronRight className="h-3 w-3 text-slate-400" />}
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

      {/* 2-3행: title/description + actions */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          {/* 2행: title + chip */}
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900 leading-tight">
              {title}
            </h1>
            {statusChip}
          </div>
          {/* 3행: description */}
          {description && (
            <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
          )}
        </div>
        {/* actions */}
        {actions && (
          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
