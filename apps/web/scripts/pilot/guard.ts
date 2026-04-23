/**
 * Pilot DB Target Guard — #P01 / ADR-002 §6
 *
 * Gatekeeper that every pilot-seed or pilot-cleanup invocation must
 * clear before a single Prisma call reaches the network. Inverted
 * semantics versus apps/web/scripts/smoke/guard.ts:
 *
 *   - smoke guard : rejects connection if the production project-ref
 *                   ever appears in the allow list. Its whole purpose
 *                   is to refuse production.
 *   - pilot guard : REQUIRES the production project-ref to be
 *                   explicitly allow-listed. Its whole purpose is to
 *                   seed into production safely, behind a paranoid
 *                   opt-in token.
 *
 * Because the semantics are opposite, the two files live in separate
 * directories and never import from each other. Mixing env vars
 * across tracks is blocked by different env names — see below.
 *
 * Env contract (set by the operator, never committed)
 * ---------------------------------------------------
 *   DATABASE_URL_PILOT              — full connection string, target
 *                                     is production DB (xhidynwpkqeaqjuudhsw).
 *   ALLOWED_PILOT_DB_SENTINELS      — comma list. Must include the
 *                                     production project-ref for the
 *                                     guard to clear.
 *   PILOT_REQUIRES_EXPLICIT_OPT_IN  — must equal REQUIRED_OPT_IN_TOKEN
 *                                     verbatim (case-sensitive).
 *
 * Fail-closed: every missing / mismatched field aborts the process
 * with a single-line governance message. There is no fallback to
 * DATABASE_URL, no soft mode.
 */

/**
 * Exact opt-in token (Q4 approved 2026-04-23).
 *
 * Case-sensitive. Any drift (whitespace, case, typo) aborts the
 * guard. Rotate this constant together with an ADR-002 changelog
 * entry when the pilot boundary changes.
 */
export const REQUIRED_OPT_IN_TOKEN = "YES-SEED-PRODUCTION-PILOT-2026";

export interface PilotDatabaseGuardEnv {
  readonly DATABASE_URL_PILOT?: string;
  readonly ALLOWED_PILOT_DB_SENTINELS?: string;
  readonly PILOT_REQUIRES_EXPLICIT_OPT_IN?: string;
}

export type PilotGuardFailureReason =
  | "missing_pilot_url"
  | "missing_opt_in_token"
  | "invalid_opt_in_token"
  | "empty_allow_list"
  | "unparseable_url"
  | "project_ref_not_extractable"
  | "project_ref_not_in_allow_list";

export interface PilotGuardSuccess {
  readonly ok: true;
  readonly projectRef: string;
  readonly allowList: readonly string[];
}

export interface PilotGuardFailure {
  readonly ok: false;
  readonly reason: PilotGuardFailureReason;
  readonly detail: string;
  readonly projectRef?: string;
  readonly allowList?: readonly string[];
}

export type PilotGuardResult = PilotGuardSuccess | PilotGuardFailure;

/**
 * Pure function — no side effects, no process.exit. The runner
 * wrapper below turns a failure into a governance message + exit.
 */
export function checkPilotDatabaseTarget(
  env: PilotDatabaseGuardEnv,
): PilotGuardResult {
  // 1. Opt-in token must be present AND match exactly. Checked first
  //    so a missing token aborts before we touch anything else.
  const optIn = env.PILOT_REQUIRES_EXPLICIT_OPT_IN;
  if (optIn === undefined || optIn === "") {
    return {
      ok: false,
      reason: "missing_opt_in_token",
      detail:
        "PILOT_REQUIRES_EXPLICIT_OPT_IN is not set. Pilot seeding refuses to run without an explicit opt-in token.",
    };
  }
  if (optIn !== REQUIRED_OPT_IN_TOKEN) {
    return {
      ok: false,
      reason: "invalid_opt_in_token",
      detail:
        "PILOT_REQUIRES_EXPLICIT_OPT_IN does not match the expected token. Case, whitespace, and every character must match exactly.",
    };
  }

  // 2. DATABASE_URL_PILOT required. No fallback to DATABASE_URL.
  const rawUrl = env.DATABASE_URL_PILOT;
  if (!rawUrl || rawUrl.trim() === "") {
    return {
      ok: false,
      reason: "missing_pilot_url",
      detail:
        "DATABASE_URL_PILOT is not set. Pilot seeding refuses to fall back to DATABASE_URL.",
    };
  }

  // 3. Allow list must contain something we can match against.
  const rawAllowList = env.ALLOWED_PILOT_DB_SENTINELS ?? "";
  const allowList = rawAllowList
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (allowList.length === 0) {
    return {
      ok: false,
      reason: "empty_allow_list",
      detail:
        "ALLOWED_PILOT_DB_SENTINELS is empty. Pilot seeding refuses to run without an explicit allow list (production ref must be listed on purpose).",
    };
  }

  // 4. Parse URL and extract the Supabase project-ref.
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch (err) {
    return {
      ok: false,
      reason: "unparseable_url",
      detail: `DATABASE_URL_PILOT is not a parseable URL: ${
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
        "Could not extract a Supabase project-ref from DATABASE_URL_PILOT. Expected `postgres.<ref>` user or `db.<ref>.supabase.co` host.",
    };
  }

  // 5. project-ref must appear in the allow list. The production ref
  //    being allow-listed is the normal path here (opposite of smoke).
  if (!allowList.includes(projectRef)) {
    return {
      ok: false,
      reason: "project_ref_not_in_allow_list",
      detail: `project-ref "${projectRef}" is not in ALLOWED_PILOT_DB_SENTINELS. Pilot seeding refuses to proceed against an unlisted target.`,
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
 * Kept local (not shared with smoke guard) so the two tracks stay
 * independent and diverge without coupling. The shape is identical
 * to smoke guard's extractor by design.
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
 * Runner wrapper — call at the very top of any pilot-seed or
 * pilot-cleanup entry point. Prints a governance message and
 * terminates the process on failure.
 */
export function assertPilotDatabaseTarget(
  env: PilotDatabaseGuardEnv = process.env as PilotDatabaseGuardEnv,
): PilotGuardSuccess {
  const result = checkPilotDatabaseTarget(env);
  if (!result.ok) {
    // eslint-disable-next-line no-console
    console.error(
      `[pilot-guard] ABORT (${result.reason}): ${result.detail}`,
    );
    process.exit(1);
  }
  return result;
}
