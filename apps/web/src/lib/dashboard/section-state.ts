/**
 * §main-dashboard-redesign P2 — 대시보드 섹션 로드 4상태 머신 (순수)
 *
 * 정본: docs/plans/PLAN_main-dashboard-redesign.md (P2: capMs 상태머신 + empty 4상태)
 *
 * React/DB 의존 0 — use-dashboard-section 훅이 합성. 격리 node 단위 검증 가능.
 *
 * 4상태(가드①): loading / error / empty(ready·빈) / ready(ready·데이터).
 *   - empty = 정상 응답이나 데이터 0 → 빈 데이터 차트 미렌더 + "데이터 쌓이면 표시".
 *   - ready = 데이터 1건+ → 실차트/실값.
 *
 * 무한 스켈레톤 금지: capMs(기본 10s) 초과 시 데이터 없으면 error 전환.
 *   ⚠️ §11.375 P1 라이브 정합 — 콜드스타트 serverless 5~6s(느린 성공)가 짧은
 *   상한에 걸려 거짓 에러카드 깜빡이던 인시던트 때문에 상한 6→10s 였음. 프로토타입
 *   2.6초 값 폐기, 10s 채택(호영님 2026-06-15 결정). 짧은 capMs 금지.
 */

/** capMs hard-error 기본 상한(ms). §11.375 라이브 정합 — 10s 미만 금지. */
export const CAPMS_DEFAULT = 10000;

export type SectionState = "loading" | "error" | "empty" | "ready";

export interface SectionStateInput {
  /** 인증 세션 로딩 중(next-auth status === "loading"). */
  authLoading: boolean;
  /** react-query isLoading. */
  queryLoading: boolean;
  /** react-query error 존재(retry 소진 후). */
  queryError: boolean;
  /** 데이터 도착 여부(undefined/null = 미도착). */
  hasData: boolean;
  /** 데이터가 도착했으나 비어있음(예: summary.derived.allEmpty 또는 모듈 0건). */
  isEmpty: boolean;
  /** capMs 초과 타임아웃(데이터 미도착 상태에서만 의미). */
  timedOut: boolean;
}

/**
 * 섹션 로드 상태 도출.
 *
 * 우선순위:
 *   1. timedOut && 데이터 없음 → error (무한 스켈레톤 금지 — capMs hard cap)
 *   2. queryError && 데이터 없음 → error (retry 소진)
 *   3. authLoading || (queryLoading && 데이터 없음) → loading
 *   4. 데이터 없음(에러·로딩 아님) → loading (전이 중 안전 기본)
 *   5. isEmpty → empty (정직한 빈 — 차트 미렌더)
 *   6. → ready
 *
 * stale-while-revalidate: 데이터가 이미 있으면(hasData) 재검증 중 error/timeout 이어도
 *   기존 데이터 유지(ready/empty) — 깜빡임 방지.
 */
export function deriveSectionState(input: SectionStateInput): SectionState {
  const { authLoading, queryLoading, queryError, hasData, isEmpty, timedOut } = input;

  if (!hasData) {
    if (timedOut) return "error";
    if (queryError) return "error";
    if (authLoading || queryLoading) return "loading";
    return "loading";
  }

  // 데이터 보유: 재검증 중 transient error/timeout 은 무시(stale 유지).
  return isEmpty ? "empty" : "ready";
}
