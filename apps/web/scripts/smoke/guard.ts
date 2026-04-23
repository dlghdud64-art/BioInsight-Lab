/**
 * Smoke DB Target Guard
 *
 * ADR-001 §6.1 — pre-smoke host / project-ref guard for #26 S01/S02/S03.
 *
 * Contract (fail-closed):
 *   - Reads DATABASE_URL_SMOKE only. It does NOT fall back to DATABASE_URL.
 *   - Extracts the Supabase project-ref from the connection string.
 *   - Accepts the connection only when the project-ref is present in
 *     ALLOWED_SMOKE_DB_SENTINELS (comma separated).
 *   - If PRODUCTION_DB_PROJECT_REF is set and happens to appear in the
 *     allow list, the guard refuses to run — the allow list itself is
 *     poisoned.
 *   - On any failure, exits the process with a governance message.
 *
 * This file is read-only in terms of production: no queries, no writes,
 * no fetch. It only parses env strings.
 *
 * See docs/decisions/ADR-001-isolated-write-db-for-smoke.md §5.1 for the
 * operating constraints that this guard enforces.
 */

export interface SmokeDatabaseGuardEnv {
  readonly DATABASE_URL_SMOKE?: string;
  readonly ALLOWED_SMOKE_DB_SENTINELS?: string;
  readonly PRODUCTION_DB_PROJECT_REF?: string;
}

export type SmokeGuardFailureReason =
  | "missing_smoke_url"
  | "empty_allow_list"
  | "unparseable_url"
  | "project_ref_not_extractable"
  | "project_ref_not_in_allow_list"
  | "production_ref_in_allow_list";

export interface SmokeGuardSuccess {
  readonly ok: true;
  readonly projectRef: string;
  readonly allowList: readonly string[];
}

export interface SmokeGuardFailure {
  readonly ok: false;
  readonly reason: SmokeGuardFailureReason;
  readonly detail: string;
  readonly projectRef?: string;
  readonly allowList?: readonly string[];
}

export type SmokeGuardResult = SmokeGuardSuccess | SmokeGuardFailure;

/**
 * Pure function — no side effects. Unit tests drive this form directly
 * without touching process.exit.
 */
export function checkSmokeDatabaseTarget(
  env: SmokeDatabaseGuardEnv,
): SmokeGuardResult {
  const rawUrl = env.DATABASE_URL_SMOKE;
  if (!rawUrl || rawUrl.trim() === "") {
    return {
      ok: false,
      reason: "missing_smoke_url",
      detail:
        "DATABASE_URL_SMOKE is not set. Smoke refuses to fall back to DATABASE_URL.",
    };
  }

  const rawAllowList = env.ALLOWED_SMOKE_DB_SENTINELS ?? "";
  const allowList = rawAllowList
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (allowList.length === 0) {
    return {
      ok: false,
      reason: "empty_allow_list",
      detail:
        "ALLOWED_SMOKE_DB_SENTINELS is empty. Smoke refuses to run without an explicit allow list.",
    };
  }

  const productionRef = env.PRODUCTION_DB_PROJECT_REF?.trim();
  if (productionRef && allowList.includes(productionRef)) {
    return {
      ok: false,
      reason: "production_ref_in_allow_list",
      detail:
        "PRODUCTION_DB_PROJECT_REF appears inside ALLOWED_SMOKE_DB_SENTINELS. The allow list is poisoned; refusing to proceed.",
      allowList,
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch (err) {
    return {
      ok: false,
      reason: "unparseable_url",
      detail: `DATABASE_URL_SMOKE is not a parseable URL: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }

  const projectRef = extractSupabaseProjectRef(parsed);
  if (!projectRef) {
    return {
      ok: false,
      reason: "project_ref_not_extractable",
      detail:
        "Could not extract a Supabase project-ref from DATABASE_URL_SMOKE. Expected `postgres.<ref>` user or `db.<ref>.supabase.co` host.",
    };
  }

  if (!allowList.includes(projectRef)) {
    return {
      ok: false,
      reason: "project_ref_not_in_allow_list",
      detail: `project-ref "${projectRef}" is not in ALLOWED_SMOKE_DB_SENTINELS. Smoke refuses to proceed.`,
      projectRef,
      allowList,
    };
  }

  return {
    ok: true,
    projectRef,
    allowList,
  };
}

/**
 * Extract the Supabase project-ref from a connection URL.
 *
 * Supported shapes (ADR-001 Option B uses Supabase):
 *   - Pooler:  postgresql://postgres.<REF>:password@aws-0-REGION.pooler.supabase.com:6543/postgres
 *   - Direct:  postgresql://postgres:password@db.<REF>.supabase.co:5432/postgres
 *
 * Returns null for non-Supabase URLs (localhost, other providers). The
 * guard will then reject them — the ADR commits us to Supabase only.
 */
function extractSupabaseProjectRef(u: URL): string | null {
  const username = decodeURIComponent(u.username || "");
  if (username.startsWith("postgres.")) {
    const ref = username.slice("postgres.".length);
    if (ref.length > 0) return ref;
  }

  const host = u.hostname;
  const directMatch = host.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
  if (directMatch) return directMatch[1];

  return null;
}

/**
 * Runner-facing form. Call this at the very top of any smoke entry point.
 * On failure it prints a governance message and terminates the process.
 */
export function assertSmokeDatabaseTarget(
  env: SmokeDatabaseGuardEnv = process.env as SmokeDatabaseGuardEnv,
): SmokeGuardSuccess {
  const result = checkSmokeDatabaseTarget(env);
  if (!result.ok) {
    // eslint-disable-next-line no-console
    console.error(
      `[smoke-guard] ABORT (${result.reason}): ${result.detail}`,
    );
    process.exit(1);
  }
  return result;
}
