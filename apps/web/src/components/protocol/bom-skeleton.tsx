"use client";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * BOM 테이블 스켈레톤 UI
 * Empty State에서 사용할 가짜 테이블 UI
 */
export function BOMSkeleton() {
  return (
    <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
      <div className="w-full max-w-2xl space-y-4 p-6">
        {/* 테이블 헤더 */}
        <div className="flex gap-4 pb-2 border-b border-slate-200">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-28" />
        </div>
        
        {/* 테이블 행들 */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 items-center">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

