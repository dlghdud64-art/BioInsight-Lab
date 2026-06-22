"use client";

/**
 * §main-dashboard-redesign P2 — 섹션별 독립 로드 훅 (capMs 10s 4상태)
 *
 * 정본: docs/plans/PLAN_main-dashboard-redesign.md (P2)
 *
 * react-query useQuery 래핑(retry 2·지수 backoff — §11.361/§11.366 canonical 보존) +
 * capMs hard-cap 타이머(§11.366/§11.375 패턴 재사용, 신규 경쟁 primitive 0) +
 * deriveSectionState 합성 → {state,data,error,retry,timedOut}.
 *
 * capMs 기본 10s: §11.375 라이브 정합(콜드스타트 5~6s 거짓 에러 깜빡임 방지).
 *   프로토타입 2.6초 값 폐기(호영님 2026-06-15). 무한 스켈레톤 금지 — 10s 후 데이터
 *   없으면 error 전환 + 카드별 재시도(retry()).
 *
 * page 미교체 — P3~5 에서 모듈별 채택. 훅 revert = 페이지 무영향.
 */

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getGuestKey } from "@/lib/guest-key";
// §session-expiry-global — GET 을 csrfFetch 경유 → 401 시 전역 재로그인 유도(가짜 empty 폴백 차단).
import { csrfFetch } from "@/lib/api-client";
import {
  deriveSectionState,
  CAPMS_DEFAULT,
  type SectionState,
} from "@/lib/dashboard/section-state";

export interface UseDashboardSectionOptions<T> {
  /** react-query 캐시 키. */
  queryKey: readonly unknown[];
  /** 읽기 endpoint(예: "/api/dashboard/summary"). */
  url: string;
  /** 활성 조건(예: status === "authenticated"). 기본 true. */
  enabled?: boolean;
  /** 인증 세션 로딩 중(status === "loading"). loading 상태 도출에 반영. */
  authLoading?: boolean;
  /** 데이터 빈 판정 — empty 상태 도출(가드①, 빈 차트 미렌더). */
  isEmpty: (data: T) => boolean;
  /** hard-error 상한(ms). 기본 10s. 10s 미만 금지(§11.375). */
  capMs?: number;
}

export interface UseDashboardSectionResult<T> {
  state: SectionState;
  data: T | undefined;
  error: Error | null;
  /** 카드별 재시도 — timeout reset + refetch. */
  retry: () => void;
  timedOut: boolean;
}

export function useDashboardSection<T>({
  queryKey,
  url,
  enabled = true,
  authLoading = false,
  isEmpty,
  capMs = CAPMS_DEFAULT,
}: UseDashboardSectionOptions<T>): UseDashboardSectionResult<T> {
  const { data, isLoading, error, refetch } = useQuery<T>({
    queryKey,
    queryFn: async () => {
      const guestKey = getGuestKey();
      const headers: Record<string, string> = {};
      if (guestKey) headers["x-guest-key"] = guestKey;
      const response = await csrfFetch(url, { headers });
      if (!response.ok) {
        // §11.361-1b — !ok 는 throw(return null 금지) → react-query retry 동작.
        throw new Error(`${url} ${response.status}`);
      }
      return response.json();
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
    refetchOnWindowFocus: false,
  });

  // capMs hard-cap — 로딩 중 + 데이터 없을 때만 활성, 회복/도착 시 reset.
  //   §11.375 정합: 콜드스타트(5~6s 느린 성공)는 상한 전 회복, 진짜 무한만 10s 후 error.
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const stillLoading = authLoading || (isLoading && !data);
    if (!stillLoading) {
      setTimedOut(false);
      return;
    }
    const t = setTimeout(() => setTimedOut(true), capMs);
    return () => clearTimeout(t);
  }, [authLoading, isLoading, data, capMs]);

  const state = deriveSectionState({
    authLoading,
    queryLoading: isLoading,
    queryError: !!error,
    hasData: data !== undefined && data !== null,
    isEmpty: data !== undefined && data !== null ? isEmpty(data) : false,
    timedOut,
  });

  return {
    state,
    data,
    error: (error as Error) ?? null,
    retry: () => {
      setTimedOut(false);
      void refetch();
    },
    timedOut,
  };
}
