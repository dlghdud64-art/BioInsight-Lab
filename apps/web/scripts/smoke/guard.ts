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

// §prisma-target-helper (호영님 판정 A · 2026-08-30) — 공통 핵심 승계.
//   URL 파싱 · ref 추출 · allow-list 파싱은 pilot guard 와 **글자까지 같은 사본**이었다.
//   정책(prod 금지 vs opt-in 허용)은 방향이 반대라 여기 남기고, 기계만 내렸다.
import {
  parseAllowList,
  resolveProjectRef,
} from "../lib/db-target-core";

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

  const allowList = parseAllowList(env.ALLOWED_SMOKE_DB_SENTINELS);

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

  // §prisma-target-helper — URL 파싱 + ref 추출은 공통 핵심이 든다.
  //   실패 사유는 중립 이름으로 오고, 문안은 여기서 자기 env 키를 넣어 만든다
  //   (기존 메시지 한 글자도 안 바뀐다 — 그것이 이 통합의 회귀 증거다).
  const resolved = resolveProjectRef(rawUrl);
  if (!resolved.ok) {
    if (resolved.reason === "unparseable_url") {
      return {
        ok: false,
        reason: "unparseable_url",
        detail: `DATABASE_URL_SMOKE is not a parseable URL: ${resolved.parseError}`,
      };
    }
    return {
      ok: false,
      reason: "project_ref_not_extractable",
      detail:
        "Could not extract a Supabase project-ref from DATABASE_URL_SMOKE. Expected `postgres.<ref>` user or `db.<ref>.supabase.co` host.",
    };
  }
  const projectRef = resolved.projectRef;

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
