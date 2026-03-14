/**
 * P1-1 Slice-1C — Shared Prisma Query Helpers
 *
 * Pagination, ordering, and Prisma error detection utilities.
 * Internal to the Prisma adapter — not exported outside.
 */

import type { ListQuery } from "../types";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

/**
 * Build Prisma pagination args from ListQuery.
 */
export function buildPagination(query?: ListQuery): { take: number; skip?: number; cursor?: { id: string } } {
  const limit = Math.min(Math.max(query?.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  if (query?.cursor) {
    return {
      take: limit,
      skip: 1,
      cursor: { id: query.cursor },
    };
  }
  return { take: limit };
}

/**
 * Build Prisma orderBy from ListQuery.
 */
export function buildOrderBy(
  query?: ListQuery,
  defaultField: string = "createdAt"
): Record<string, string> {
  return { [defaultField]: query?.order === "ASC" ? "asc" : "desc" };
}

/**
 * Check if a Prisma error is a unique constraint violation (P2002).
 */
export function isUniqueConstraintError(e: unknown): boolean {
  return (e as { code?: string })?.code === "P2002";
}

/**
 * Check if a Prisma error is a record not found (P2025).
 */
export function isRecordNotFoundError(e: unknown): boolean {
  return (e as { code?: string })?.code === "P2025";
}
