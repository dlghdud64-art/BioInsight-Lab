/**
 * P1-1 Slice-1D — Memory Query Helpers
 *
 * Shared pagination, sorting, and list utilities for Memory repositories.
 */

import type { ListQuery, ListResult } from "../types";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

/**
 * Apply ListQuery (sort, limit, cursor) to an in-memory array.
 * Returns ListResult with items and nextCursor.
 */
export function applyListQuery<T extends { id: string }>(
  items: T[],
  query: ListQuery | undefined,
  defaultSortField: string
): ListResult<T> {
  const limit = Math.min(Math.max(query?.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const order = query?.order ?? "DESC";

  // Sort
  const sorted = [...items].sort((a, b) => {
    const aVal = (a as Record<string, unknown>)[defaultSortField];
    const bVal = (b as Record<string, unknown>)[defaultSortField];
    if (aVal instanceof Date && bVal instanceof Date) {
      return order === "ASC"
        ? aVal.getTime() - bVal.getTime()
        : bVal.getTime() - aVal.getTime();
    }
    // Fallback: string comparison
    const aStr = String(aVal ?? "");
    const bStr = String(bVal ?? "");
    return order === "ASC" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
  });

  // Cursor-based pagination: find cursor position, skip past it
  let startIdx = 0;
  if (query?.cursor) {
    const cursorIdx = sorted.findIndex((item) => item.id === query.cursor);
    if (cursorIdx !== -1) {
      startIdx = cursorIdx + 1;
    }
  }

  const page = sorted.slice(startIdx, startIdx + limit);
  const nextCursor = page.length === limit && startIdx + limit < sorted.length
    ? page[page.length - 1].id
    : null;

  return { items: page, nextCursor };
}
