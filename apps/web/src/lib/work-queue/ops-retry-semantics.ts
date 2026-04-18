/**
 * Ops Retry/Recovery Semantics — Pure Definitions
 *
 * CTA 실행 실패 시 에러 유형별 재시도·복구 정책을 정의합니다.
 * 순수 정의 파일 — DB 호출 없음.
 */

// ── Types ──

export type RecoveryAction = "retry" | "resync" | "manual" | "none";

export interface RetryPolicy {
  errorType: string;
  retryable: boolean;
  maxRetries: number;
  userMessage: string;
  recoveryAction: RecoveryAction;
}

// ── Canonical Retry Policies ──

export const OPS_RETRY_POLICIES: Record<string, RetryPolicy> = {
  "409_conflict": {
    errorType: "409_conflict",
    retryable: false,
    maxRetries: 0,
    userMessage: "이미 처리된 작업입니다.",
    recoveryAction: "none",
  },
  execution_failed: {
    errorType: "execution_failed",
    retryable: true,
    maxRetries: 1,
    userMessage: "실행 실패 — 재시도 가능합니다.",
    recoveryAction: "retry",
  },
  invalid_state: {
    errorType: "invalid_state",
    retryable: false,
    maxRetries: 0,
    userMessage: "상태 불일치 — 동기화가 필요합니다.",
    recoveryAction: "resync",
  },
  network_error: {
    errorType: "network_error",
    retryable: true,
    maxRetries: 2,
    userMessage: "네트워크 오류 — 잠시 후 재시도합니다.",
    recoveryAction: "retry",
  },
  forbidden: {
    errorType: "forbidden",
    retryable: false,
    maxRetries: 0,
    userMessage: "권한이 없습니다.",
    recoveryAction: "none",
  },
  unknown_action: {
    errorType: "unknown_action",
    retryable: false,
    maxRetries: 0,
    userMessage: "알 수 없는 작업입니다.",
    recoveryAction: "manual",
  },
};

// ── Lookup ──

/**
 * 에러 코드로 재시도 정책을 조회합니다.
 * HTTP 상태 코드 + 에러 본문 코드를 모두 지원합니다.
 */
export function resolveRetryPolicy(errorCode: string): RetryPolicy | null {
  return OPS_RETRY_POLICIES[errorCode] ?? null;
}

/**
 * HTTP 응답에서 에러 코드를 추출하여 재시도 정책을 반환합니다.
 */
export function resolveRetryPolicyFromResponse(
  status: number,
  errorBody?: { error?: string },
): RetryPolicy | null {
  // HTTP status-based mapping
  if (status === 409) return OPS_RETRY_POLICIES["409_conflict"];
  if (status === 403) return OPS_RETRY_POLICIES["forbidden"];

  // Error body code mapping
  if (errorBody?.error) {
    const code = errorBody.error.toLowerCase();
    if (code === "duplicate_action") return OPS_RETRY_POLICIES["409_conflict"];
    if (code === "invalid_state") return OPS_RETRY_POLICIES["invalid_state"];
    if (code === "unknown_action") return OPS_RETRY_POLICIES["unknown_action"];
    if (code === "execution_failed") return OPS_RETRY_POLICIES["execution_failed"];
  }

  // Network/server errors
  if (status >= 500) return OPS_RETRY_POLICIES["execution_failed"];
  if (status === 0) return OPS_RETRY_POLICIES["network_error"];

  return null;
}
