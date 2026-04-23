/**
 * #28 Regression: /api/admin/quotes handler must not reference non-existent
 * Prisma relations on Quote model.
 *
 * Root cause (confirmed 2026-04-23): handler previously included
 *   `_count: { select: { listItems: true, items: true } }`
 * The Quote model's QuoteListItem relation is named `items`, not `listItems`.
 * Prisma threw `prisma:error Invalid prisma.quote.findMany` → 500 on every call.
 * UI silently rendered the error as an empty state (fake success).
 *
 * This test locks the handler contract so the drift cannot re-appear:
 *   - Source file must NOT include `listItems` inside the Prisma `_count.select` block.
 *   - Source file must still include the valid `items` relation count.
 *
 * Scope is deliberately source-level (not runtime Prisma mock) because:
 *   - Runtime mocking of `@/lib/db` for this file would require heavy fixture setup.
 *   - The failure mode is a static string drift vs. schema.prisma — a source lint is
 *     the smallest diff that catches regression with zero flakiness.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROUTE_PATH = resolve(
  __dirname,
  "../../../app/api/admin/quotes/route.ts",
);
const SCHEMA_PATH = resolve(
  __dirname,
  "../../../../prisma/schema.prisma",
);

describe("/api/admin/quotes handler — Prisma relation contract (#28)", () => {
  const source = readFileSync(ROUTE_PATH, "utf8");
  const schema = readFileSync(SCHEMA_PATH, "utf8");

  it("does NOT reference a non-existent `listItems` relation on Quote", () => {
    // If this fails: someone re-introduced the drift. Do not ship.
    expect(source).not.toMatch(/\blistItems\s*:\s*true\b/);
  });

  it("still counts the valid `items` relation (QuoteListItem)", () => {
    expect(source).toMatch(/\bitems\s*:\s*true\b/);
  });

  it("Quote model in schema.prisma exposes `items` (not `listItems`) for QuoteListItem", () => {
    // Guard against schema.prisma ever renaming back to `listItems` without updating
    // the handler in lockstep.
    const quoteModelMatch = schema.match(/model Quote \{[\s\S]*?\n\}/);
    expect(quoteModelMatch).not.toBeNull();
    const quoteModel = quoteModelMatch![0];
    expect(quoteModel).toMatch(/\bitems\s+QuoteListItem\[\]/);
    expect(quoteModel).not.toMatch(/\blistItems\s+QuoteListItem\[\]/);
  });
});
