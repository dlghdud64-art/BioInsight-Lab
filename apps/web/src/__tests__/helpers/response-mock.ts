/**
 * Test helper: typed mock for `NextResponse.json` shape.
 *
 * Used by route/integration tests that mock `next/server` and
 * `@/lib/api-error-handler` to avoid the real NextResponse constructor.
 *
 * Safe to reference inside `vi.mock(...)` factories because this module
 * is imported via ES `import` at module top (hoisted above vi.mock calls).
 */

export interface MockJsonResponse<T = unknown> {
  status: number;
  json: () => Promise<T>;
}

export const mockJsonResponse = <T>(
  data: T,
  init?: { status?: number }
): MockJsonResponse<T> => ({
  status: init?.status ?? 200,
  json: async () => data,
});
