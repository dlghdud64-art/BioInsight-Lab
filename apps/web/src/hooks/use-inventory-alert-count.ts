"use client";

/**
 * §bottom-nav-badge P3 — 하단 내비 재고 탭 뱃지 canonical 훅.
 *
 * truth: GET /api/inventory/alert-count (공유 isReorderNeeded 파생 — stats KPI 동일 값).
 * ❌ F8 금지 경로: ops-store/seed 카운트 · dashboard-stats heavy fetch · 파생 규칙 중복.
 *
 * queryKey 를 ["inventories", *] prefix 로 잡아 기존 재고 mutation 들의
 * `invalidateQueries({ queryKey: ["inventories"] })` (inventory-content ·
 * inventory-main · SmartReceivingScannerModal 등)가 추가 배선 0 으로 뱃지까지
 * 자동 invalidate — 신규 mutation 이 생겨도 동일 규약이면 자동 편승.
 *
 * 신선도: staleTime 60s. BottomNav 는 상주(remount 없음)라 refetchOnMount 무효 —
 * 라우트 전환 시 60s 초과분만 수동 refetch (호출 빈도 상한 유지, 폴링 0).
 * 대시보드 KPI 와 최대 60s 순간 불일치 가능(계획서 §5 P3 수용·문서화).
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

export const INVENTORY_ALERT_COUNT_QUERY_KEY = ["inventories", "alert-count"] as const;
const STALE_MS = 60_000;

export function useInventoryAlertCount(): { count: number | null } {
  const pathname = usePathname();

  const { data, dataUpdatedAt, isError, refetch } = useQuery<{ count: number }>({
    queryKey: INVENTORY_ALERT_COUNT_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/inventory/alert-count");
      if (!res.ok) {
        // 401/500 → throw → isError → 뱃지 미렌더 (가짜 0/고정 카운트 금지)
        throw Object.assign(new Error("alert-count fetch failed"), { status: res.status });
      }
      return res.json();
    },
    staleTime: STALE_MS,
    refetchOnWindowFocus: false, // 상주 컴포넌트 — 포커스마다 재조회 금지(계획서 Risk 3)
  });

  // 라우트 전환 시 stale(60s 초과)만 재조회 — 상주라 mount 기반 refetch 부재 보완.
  useEffect(() => {
    if (dataUpdatedAt > 0 && Date.now() - dataUpdatedAt > STALE_MS) {
      void refetch();
    }
    // dataUpdatedAt/refetch 를 deps 에 넣으면 응답 도착마다 재평가 — pathname 전환시에만 판정.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // 로딩(undefined)·에러 → null: 호출측 0건 미렌더 규약과 합류.
  return { count: isError ? null : data?.count ?? null };
}
