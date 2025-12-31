/**
 * Global API Client Wrapper
 * Handles standardized error responses, Toast notifications, and automatic redirects
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
  const { skipErrorToast = false, skipAuthRedirect = false, ...fetchOptions } = options;

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        "Content-Type": "application/json",
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









