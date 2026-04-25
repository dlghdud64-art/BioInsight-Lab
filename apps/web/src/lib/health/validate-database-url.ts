/**
 * apps/web/src/lib/health/validate-database-url.ts
 *
 * #P01-followup-health-precheck (ADR-002 §11.14 follow-up):
 * structural validation of a DATABASE_URL / DIRECT_URL connection
 * string before Prisma even tries to use it. Lets /api/health
 * distinguish "env value is malformed" from "env is fine, DB is
 * down" from "Prisma client misconfigured" in a single probe.
 *
 * Pure function. No I/O. No env reads — caller passes the string in.
 *
 * Background:
 *   2026-04-25 §11.14 incident — operator's DIRECT_URL cleanup
 *   accidentally mutated DATABASE_URL. Prisma's parser rejected it
 *   with "Error parsing connection string: invalid port number".
 *   Every Prisma route returned 500 simultaneously. Triage took
 *   minutes because the failure surface (every endpoint) was much
 *   wider than the cause surface (one env). This validator surfaces
 *   the cause directly in /api/health.
 *
 * Scope:
 *   Structural / syntactic checks only. Does NOT attempt to connect.
 *   "URL is well-formed" is necessary but not sufficient for "DB
 *   reachable" — the existing $queryRaw probe still validates the
 *   latter.
 */

export type DatabaseUrlValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

const ALLOWED_PROTOCOLS = ["postgresql:", "postgres:"] as const;

/**
 * Validate the structural shape of a Postgres connection URL.
 *
 * Returns `{ ok: true }` if the string parses as a URL with:
 *   - protocol postgresql: or postgres:
 *   - non-empty hostname
 *   - port (if present) is an integer in [1, 65535]
 *   - pathname carries a database name (i.e. not just "/")
 *
 * Returns `{ ok: false, reason }` otherwise. `reason` is a short
 * human-readable string suitable for /api/health output and ops logs.
 * Never throws.
 *
 * Empty / undefined input is treated as a structural failure
 * (the env var is missing or empty), not a "skip" — caller decides
 * whether absence is acceptable.
 */
export function validateDatabaseUrl(
  raw: string | undefined | null,
): DatabaseUrlValidation {
  if (!raw || raw.length === 0) {
    return { ok: false, reason: "empty or unset" };
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `URL constructor rejected: ${msg}` };
  }

  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol as (typeof ALLOWED_PROTOCOLS)[number])) {
    return {
      ok: false,
      reason: `unexpected protocol "${parsed.protocol}" (expected postgresql: or postgres:)`,
    };
  }

  if (!parsed.hostname) {
    return { ok: false, reason: "missing hostname" };
  }

  // URL.port is "" when no port is specified; allow that (Postgres
  // would default to 5432). When present, must be a valid integer
  // in the TCP range.
  if (parsed.port !== "") {
    if (!/^\d+$/.test(parsed.port)) {
      return { ok: false, reason: `port "${parsed.port}" is not numeric` };
    }
    const p = Number(parsed.port);
    if (!Number.isInteger(p) || p < 1 || p > 65535) {
      return { ok: false, reason: `port ${p} out of range [1, 65535]` };
    }
  }

  // Pathname for postgres URLs is "/<dbname>". Empty pathname or
  // bare "/" means the database name was lost (a common symptom
  // when the URL gets truncated mid-edit).
  if (!parsed.pathname || parsed.pathname === "/" || parsed.pathname === "") {
    return { ok: false, reason: "missing database name in pathname" };
  }

  return { ok: true };
}
