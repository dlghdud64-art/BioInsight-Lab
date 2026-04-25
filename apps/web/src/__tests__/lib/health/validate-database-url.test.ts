/**
 * apps/web/src/__tests__/lib/health/validate-database-url.test.ts
 *
 * Tests for #P01-followup-health-precheck (ADR-002 §11.14 follow-up).
 * Covers all branches of validateDatabaseUrl().
 */

import { describe, it, expect } from "vitest";
import { validateDatabaseUrl } from "@/lib/health/validate-database-url";

describe("validateDatabaseUrl", () => {
  // ──────────────────────────────────────────────────────────
  // Happy paths
  // ──────────────────────────────────────────────────────────

  it("[1] canonical Supabase pooler URL → ok", () => {
    const r = validateDatabaseUrl(
      "postgresql://postgres.xhidynwpkqeaojuudhsw:pw@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require",
    );
    expect(r.ok).toBe(true);
  });

  it("[2] postgres:// (alt protocol) → ok", () => {
    const r = validateDatabaseUrl("postgres://u:p@host:5432/db");
    expect(r.ok).toBe(true);
  });

  it("[3] no port (Postgres defaults 5432) → ok", () => {
    const r = validateDatabaseUrl("postgresql://u:p@host/db");
    expect(r.ok).toBe(true);
  });

  it("[4] direct connection (db.<ref>.supabase.co) → ok", () => {
    const r = validateDatabaseUrl(
      "postgresql://postgres:pw@db.xhidynwpkqeaojuudhsw.supabase.co:5432/postgres?sslmode=require",
    );
    expect(r.ok).toBe(true);
  });

  // ──────────────────────────────────────────────────────────
  // Empty / unset
  // ──────────────────────────────────────────────────────────

  it("[5] undefined → ok=false reason 'empty or unset'", () => {
    const r = validateDatabaseUrl(undefined);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("empty or unset");
  });

  it("[6] null → ok=false reason 'empty or unset'", () => {
    const r = validateDatabaseUrl(null);
    expect(r.ok).toBe(false);
  });

  it("[7] empty string → ok=false reason 'empty or unset'", () => {
    const r = validateDatabaseUrl("");
    expect(r.ok).toBe(false);
  });

  // ──────────────────────────────────────────────────────────
  // Malformed shapes (the §11.14 incident class)
  // ──────────────────────────────────────────────────────────

  it("[8] not-a-URL string → URL constructor rejects", () => {
    const r = validateDatabaseUrl("hello world");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/URL constructor rejected/);
  });

  it("[9] wrong protocol (mysql://) → ok=false", () => {
    const r = validateDatabaseUrl("mysql://u:p@host:3306/db");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/unexpected protocol/);
  });

  it("[10] http:// scheme → ok=false (different parsing path; URL accepts http and we reject by protocol)", () => {
    const r = validateDatabaseUrl("http://host:5432/db");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/unexpected protocol/);
  });

  it("[11] missing pathname (no database name) → ok=false", () => {
    const r = validateDatabaseUrl("postgresql://u:p@host:5432");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/missing database name/);
  });

  it("[12] bare slash pathname → ok=false", () => {
    const r = validateDatabaseUrl("postgresql://u:p@host:5432/");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/missing database name/);
  });

  it("[13] port out of range (port=99999) → ok=false", () => {
    const r = validateDatabaseUrl("postgresql://u:p@host:99999/db");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/out of range|not numeric|URL constructor rejected/);
  });

  it("[14] port=0 → ok=false (out of range)", () => {
    const r = validateDatabaseUrl("postgresql://u:p@host:0/db");
    expect(r.ok).toBe(false);
  });

  // ──────────────────────────────────────────────────────────
  // Edge: ipv4 host, ipv6 host
  // ──────────────────────────────────────────────────────────

  it("[15] ipv4 host → ok", () => {
    const r = validateDatabaseUrl("postgresql://u:p@127.0.0.1:5432/db");
    expect(r.ok).toBe(true);
  });

  it("[16] ipv6 host → ok (URL parses [::1] form)", () => {
    const r = validateDatabaseUrl("postgresql://u:p@[::1]:5432/db");
    expect(r.ok).toBe(true);
  });
});
