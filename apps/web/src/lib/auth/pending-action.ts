/**
 * Pending Action — 비로그인 사용자의 의도한 액션을 저장/복원
 *
 * 비로그인 상태에서 검색 실행, 비교 추가, 견적 담기 등의 액션을 시도하면
 * sessionStorage에 pending state를 저장하고, 로그인 성공 후 복원한다.
 */

export type PendingActionType =
  | "run_search"
  | "add_compare"
  | "add_request"
  | "start_compare"
  | "create_request";

export interface PendingAction {
  action: PendingActionType;
  query?: string;
  target?: string;
}

const STORAGE_KEY_ACTION = "bioinsight_pendingAction";
const STORAGE_KEY_QUERY = "bioinsight_pendingQuery";
const STORAGE_KEY_TARGET = "bioinsight_pendingTarget";

/** pending state 저장 */
export function savePendingAction(pending: PendingAction): void {
  try {
    sessionStorage.setItem(STORAGE_KEY_ACTION, pending.action);
    if (pending.query) sessionStorage.setItem(STORAGE_KEY_QUERY, pending.query);
    if (pending.target) sessionStorage.setItem(STORAGE_KEY_TARGET, pending.target);
  } catch {
    // sessionStorage 불가 (SSR 등)
  }
}

/** pending state 읽기 (제거하지 않음) */
export function getPendingAction(): PendingAction | null {
  try {
    const action = sessionStorage.getItem(STORAGE_KEY_ACTION) as PendingActionType | null;
    if (!action) return null;
    return {
      action,
      query: sessionStorage.getItem(STORAGE_KEY_QUERY) ?? undefined,
      target: sessionStorage.getItem(STORAGE_KEY_TARGET) ?? undefined,
    };
  } catch {
    return null;
  }
}

/** pending state 제거 */
export function clearPendingAction(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY_ACTION);
    sessionStorage.removeItem(STORAGE_KEY_QUERY);
    sessionStorage.removeItem(STORAGE_KEY_TARGET);
  } catch {
    // sessionStorage 불가
  }
}

/**
 * 로그인 성공 후 restore URL 계산
 * pending action이 있으면 해당 URL, 없으면 fallback
 */
export function getRestoreUrl(fallback: string = "/app/search"): string {
  const pending = getPendingAction();
  if (!pending) return fallback;

  switch (pending.action) {
    case "run_search":
      return pending.query
        ? `/app/search?q=${encodeURIComponent(pending.query)}`
        : "/app/search";
    case "add_compare":
    case "add_request":
    case "start_compare":
    case "create_request":
      // 검색 결과 페이지로 보내고, restore action은 클라이언트에서 처리
      return pending.query
        ? `/app/search?q=${encodeURIComponent(pending.query)}&restore=${pending.action}${pending.target ? `&target=${pending.target}` : ""}`
        : "/app/search";
    default:
      return fallback;
  }
}
