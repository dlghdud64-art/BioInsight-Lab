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
 *                                     is production DB (xhidynwpkqeaojuudhsw).
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

// §prisma-target-helper (호영님 명시 승인 2026-08-30 · A-1a) — 공통 핵심 승계.
//   URL 파싱 · ref 추출 · allow-list 파싱은 smoke guard 와 글자까지 같은 사본이었다.
//   정책(prod 금지 vs opt-in 허용)은 방향이 반대라 여기 남기고, 기계만 내렸다.
import {
  parseAllowList,
  resolveProjectRef,
} from "../lib/db-target-core";

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
  const allowList = parseAllowList(env.ALLOWED_PILOT_DB_SENTINELS);

  if (allowList.length === 0) {
    return {
      ok: false,
      reason: "empty_allow_list",
      detail:
        "ALLOWED_PILOT_DB_SENTINELS is empty. Pilot seeding refuses to run without an explicit allow list (production ref must be listed on purpose).",
    };
  }

  // 4. Parse URL and extract the Supabase project-ref.
  //    §prisma-target-helper — 공통 핵심이 든다. 문안은 여기서 자기 env 키로 만든다.
  const resolved = resolveProjectRef(rawUrl);
  if (!resolved.ok) {
    if (resolved.reason === "unparseable_url") {
      return {
        ok: false,
        reason: "unparseable_url",
        detail: `DATABASE_URL_PILOT is not a parseable URL: ${resolved.parseError}`,
      };
    }
    return {
      ok: false,
      reason: "project_ref_not_extractable",
      detail:
        "Could not extract a Supabase project-ref from DATABASE_URL_PILOT. Expected `postgres.<ref>` user or `db.<ref>.supabase.co` host.",
    };
  }
  const projectRef = resolved.projectRef;

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

/*
 * §prisma-target-helper (호영님 명시 승인 2026-08-30) — **결정 교체**.
 *
 * 이 자리에 있던 `extractSupabaseProjectRef` 사본과 그 근거 주석을 걷었다.
 * 옛 근거(by design 이력, 원문):
 *   "Kept local (not shared with smoke guard) so the two tracks stay independent
 *    and diverge without coupling. The shape is identical to smoke guard's
 *    extractor by design."
 *
 * 교체 사유:
 *   그 주석이 잠근 것은 **정책 독립**인데, 내려간 core(`scripts/lib/db-target-core`)는
 *   **정책을 하나도 갖지 않는 파서**다. prod 금지(smoke) / opt-in 허용(pilot) 은
 *   각 wrapper 에 그대로 남는다 — 두 트랙은 여전히 독립적으로 갈라질 수 있고,
 *   공유되는 것은 "Supabase URL 에서 ref 를 뽑는 법" 뿐이다.
 *   🔑 그 형식이 두 트랙에서 갈라지는 날이 오면 그건 분기가 아니라
 *     **둘 중 하나가 깨진 것**이다(호영님).
 *   승인 커밋: 이 파일을 바꾼 커밋 메시지 참조 (§prisma-target-helper A-1a).
 *
 * 🛑 이 파일의 정책(opt-in 토큰 · allow-list · 실패 사유 union · 메시지 문안)은
 *   한 글자도 바뀌지 않았다. pilot-guard 13 it 이 그 증거다.
 */


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
