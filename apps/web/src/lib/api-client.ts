/**
 * Global API Client Wrapper
 * Handles standardized error responses, Toast notifications, and automatic redirects
 *
 * Security Batch 10: CSRF token 자동 부착
 * - state-changing method (POST/PUT/PATCH/DELETE)에 x-labaxis-csrf-token 헤더 자동 추가
 * - __Host-labaxis-csrf cookie에서 토큰 읽기
 * - 토큰 없으면 /api/security/csrf-token에서 bootstrap
 */

import { extractApiErrorMessage, getErrorMessage } from "@/lib/errors";
import { toast } from "@/hooks/use-toast";

export interface ApiErrorResponse {
  error: string | { code?: string; message?: string };
  details?: any;
}

export interface ApiClientOptions extends RequestInit {
  skipErrorToast?: boolean; // Skip automatic error toast (caller will handle)
  skipAuthRedirect?: boolean; // Skip automatic redirect on 401
  skipCsrf?: boolean; // Skip CSRF token attachment (for non-mutation or internal calls)
}

// ═══════════════════════════════════════════════════════
// CSRF Token Management
// ═══════════════════════════════════════════════════════

const CSRF_COOKIE_NAME = 'labaxis-csrf'; // cookie name without __Host- prefix (browser strips it)
const CSRF_HEADER_NAME = 'x-labaxis-csrf-token';
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** 캐시된 CSRF 토큰 (메모리, bootstrap 중복 방지) */
let _csrfTokenCache: string | null = null;
let _csrfBootstrapPromise: Promise<string | null> | null = null;

/**
 * Cookie에서 CSRF 토큰 읽기
 */
function getCsrfTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)(?:__Host-)?${CSRF_COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * CSRF 토큰 bootstrap (서버에서 발급)
 * 중복 호출 방지를 위해 진행 중인 promise를 재사용
 */
async function bootstrapCsrfToken(): Promise<string | null> {
  // 이미 bootstrap 진행 중이면 재사용
  if (_csrfBootstrapPromise) return _csrfBootstrapPromise;

  _csrfBootstrapPromise = (async () => {
    try {
      const res = await fetch('/api/security/csrf-token', {
        method: 'GET',
        credentials: 'same-origin',
      });
      if (!res.ok) return null;
      const data = await res.json();
      _csrfTokenCache = data.csrfToken || null;
      return _csrfTokenCache;
    } catch {
      return null;
    } finally {
      _csrfBootstrapPromise = null;
    }
  })();

  return _csrfBootstrapPromise;
}

/**
 * CSRF 토큰 획득 (cookie → cache → bootstrap)
 */
async function acquireCsrfToken(): Promise<string | null> {
  // 1. Cookie에서 읽기
  const fromCookie = getCsrfTokenFromCookie();
  if (fromCookie) {
    _csrfTokenCache = fromCookie;
    return fromCookie;
  }

  // 2. 메모리 캐시
  if (_csrfTokenCache) return _csrfTokenCache;

  // 3. Bootstrap
  return bootstrapCsrfToken();
}

/**
 * CSRF 토큰 강제 갱신 (만료 등의 이유로)
 */
export async function refreshCsrfToken(): Promise<string | null> {
  _csrfTokenCache = null;
  return bootstrapCsrfToken();
}

/**
 * Standardized API client wrapper
 * - Handles standardized error responses: { error: { code, message } }
 * - Shows Toast notifications for errors
 * - Redirects to login on 401
 * - Provides consistent error handling
 */
export async function apiClient<T = any>(
  url: string,
  options: ApiClientOptions = {}
): Promise<T> {
  const { skipErrorToast = false, skipAuthRedirect = false, skipCsrf = false, ...fetchOptions } = options;

  try {
    // CSRF token 부착 (state-changing method만)
    const method = (fetchOptions.method || 'GET').toUpperCase();
    const csrfHeaders: Record<string, string> = {};
    if (!skipCsrf && STATE_CHANGING_METHODS.has(method)) {
      const csrfToken = await acquireCsrfToken();
      if (csrfToken) {
        csrfHeaders[CSRF_HEADER_NAME] = csrfToken;
      }
    }

    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        "Content-Type": "application/json",
        ...csrfHeaders,
        ...fetchOptions.headers,
      },
    });

    // Handle non-JSON responses (e.g., file downloads)
    const contentType = response.headers.get("content-type");
    if (contentType && !contentType.includes("application/json")) {
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      return response as any;
    }

    let data: any;
    try {
      data = await response.json();
    } catch (parseError) {
      // If response is not JSON and status is ok, return empty object
      if (response.ok) {
        return {} as T;
      }
      throw new Error("서버 응답을 처리할 수 없습니다.");
    }

    // Handle error responses
    if (!response.ok) {
      // Extract error message from standardized response format
      let errorMessage: string;

      if (data?.error) {
        if (typeof data.error === "string") {
          errorMessage = data.error;
        } else if (data.error?.message) {
          errorMessage = data.error.message;
        } else {
          errorMessage = extractApiErrorMessage(response, data);
        }
      } else {
        errorMessage = extractApiErrorMessage(response, data);
      }

      // Handle 401 Unauthorized - redirect to login
      if (response.status === 401 && !skipAuthRedirect) {
        const currentPath = window.location.pathname;
        const callbackUrl = encodeURIComponent(currentPath + window.location.search);
        window.location.href = `/auth/signin?callbackUrl=${callbackUrl}`;
        return Promise.reject(new Error("인증이 필요합니다."));
      }

      // Handle 500 Internal Server Error - could trigger error boundary
      if (response.status === 500 && !skipErrorToast) {
        toast({
          title: "서버 오류",
          description: errorMessage,
          variant: "destructive",
        });
      } else if (!skipErrorToast) {
        // Show toast for other errors
        toast({
          title: "오류가 발생했습니다",
          description: errorMessage,
          variant: "destructive",
        });
      }

      // Create error object that can be caught
      const error = new Error(errorMessage);
      (error as any).status = response.status;
      (error as any).code = data?.error?.code || data?.code;
      (error as any).data = data;
      throw error;
    }

    return data as T;
  } catch (error) {
    // Network errors, fetch failures, etc.
    if (error instanceof TypeError && error.message.includes("fetch")) {
      const networkError = "네트워크 연결을 확인해주세요.";
      if (!skipErrorToast) {
        toast({
          title: "연결 오류",
          description: networkError,
          variant: "destructive",
        });
      }
      throw new Error(networkError);
    }

    // Re-throw if it's already an Error we created
    if (error instanceof Error) {
      throw error;
    }

    // Unknown error
    const unknownError = getErrorMessage(error);
    if (!skipErrorToast) {
      toast({
        title: "오류가 발생했습니다",
        description: unknownError,
        variant: "destructive",
      });
    }
    throw new Error(unknownError);
  }
}

/**
 * Convenience methods for common HTTP methods
 */
export const api = {
  get: <T = any>(url: string, options?: ApiClientOptions) =>
    apiClient<T>(url, { ...options, method: "GET" }),

  post: <T = any>(url: string, data?: any, options?: ApiClientOptions) =>
    apiClient<T>(url, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T = any>(url: string, data?: any, options?: ApiClientOptions) =>
    apiClient<T>(url, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T = any>(url: string, data?: any, options?: ApiClientOptions) =>
    apiClient<T>(url, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T = any>(url: string, options?: ApiClientOptions) =>
    apiClient<T>(url, { ...options, method: "DELETE" }),
};

// ═══════════════════════════════════════════════════════
// csrfFetch — native fetch() drop-in with CSRF auto-attach
// ═══════════════════════════════════════════════════════

/**
 * Native `fetch()` 대체용 CSRF-aware wrapper
 *
 * 기존 raw `fetch()` 호출을 `csrfFetch()`로 교체하면
 * state-changing method에 CSRF header가 자동 부착됩니다.
 *
 * - 시그니처가 `fetch()`와 동일하므로 drop-in replacement
 * - GET / HEAD / OPTIONS는 CSRF 토큰 미부착 (그대로 통과)
 * - POST / PUT / PATCH / DELETE는 x-labaxis-csrf-token 자동 첨부
 * - cookie에서 토큰 읽기 → 없으면 /api/security/csrf-token bootstrap
 * - FormData / stream body도 지원 (Content-Type 강제 안함)
 *
 * 사용법:
 * ```ts
 * import { csrfFetch } from '@/lib/api-client';
 * const res = await csrfFetch('/api/quotes', { method: 'POST', body: JSON.stringify(data) });
 * ```
 */
export async function csrfFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const method = (init?.method || 'GET').toUpperCase();

  // Safe method → bypass, 원본 fetch 그대로
  if (!STATE_CHANGING_METHODS.has(method)) {
    return fetch(input, init);
  }

  // State-changing → CSRF 토큰 부착
  const csrfToken = await acquireCsrfToken();

  const existingHeaders = init?.headers instanceof Headers
    ? Object.fromEntries(init.headers.entries())
    : (init?.headers as Record<string, string>) || {};

  return fetch(input, {
    ...init,
    headers: {
      ...existingHeaders,
      ...(csrfToken ? { [CSRF_HEADER_NAME]: csrfToken } : {}),
    },
  });
}













