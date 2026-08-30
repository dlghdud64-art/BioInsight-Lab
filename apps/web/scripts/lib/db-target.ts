/**
 * §prisma-target-helper — 스크립트·프로브의 **일반 축** DB 대상 게이트.
 *   (호영님 판정 2026-08-30 · P1 원안 복귀 + 키 판정 3건)
 *
 * 왜 세 번째 정책인가:
 *   smoke  = prod **금지** (allow-list 에 prod ref 가 있으면 그것만으로 거부)
 *   pilot  = prod **허용**, 단 opt-in 토큰 (production seeding 이 목적)
 *   일반   = **test 기본 · prod 는 토큰으로만** ← 이 파일
 *   10지점(스크립트·프로브)은 smoke 도 pilot 도 아니다. 사본이 아니라
 *   **정책 셋 · 파서 하나** 구조다 — 파서는 `src/lib/db/target-core` 가 든다.
 *
 * 배경 (HANDOFF_2026-08-30 §2c):
 *   tvkl/xhid 사고의 구조 원인은 무인자 `new PrismaClient()` 가 `.env`(테스트 DB)를
 *   **조용히** 읽는 것이었다. 조용한 게 문제였지 값이 문제가 아니었다.
 *   그래서 이 헬퍼의 일은 URL 을 고르는 게 아니라 **고른 URL 의 ref 를 말하게 하는 것**이다.
 *
 * env 계약 (키 판정 · 호영님 2026-08-30)
 * -------------------------------------
 *   DIRECT_URL              — **재사용한다.** 새 URL 키를 만들면 그것이 URL 의
 *                             두 번째 진실이 된다 — 이 트랙이 죽인 것과 같은 형태를
 *                             env 에 만드는 셈이다. guard 의 일은 URL 을 따로 갖는 게
 *                             아니라 그 URL 의 ref 를 검증하는 것.
 *   DEV_DATABASE_PROJECT_REF — **기존 정본 키를 승계한다**(호영님 판정 2026-08-31).
 *                             `src/lib/security/production-database.ts` 가 이미 쓰던
 *                             키다. 어제 신설했던 `SCRIPT_DB_ALLOWED_REFS` 는 이 키의
 *                             **두 번째 진실**이었다 — 실측 결과 두 파일 모두에 이미
 *                             같은 ref 가 들어 있었다. 철회하고 이 키로 이관했다.
 *                             🛑 prod ref 는 여기 넣지 않는다 — 넣는 순간 "허용된 대상" 이
 *                               되고 아래 토큰의 존재 이유가 사라진다.
 *   ALLOW_PROD_DATABASE_PROJECT_REF
 *                           — prod 를 겨냥할 때만 준다. 값은 **그 prod 의 ref 자체**다.
 *                             🔑 `YES-PROD-<ref>` 문자열이 아니라 **ref 이름**으로 바꿨다:
 *                               기존 정본의 설계 원칙이 그것이다 —
 *                               "boolean 플래그가 아니라 ref 이름이라, 이 변수를 운영
 *                                환경에 실수로 복사해도 ref 가 달라 아무 효과가 없다."
 *                               승계하는 것은 문자열이 아니라 그 설계다.
 *
 * 시작 로그 (형식 고정)
 *   [db-target] ref=<ref> mode=<test|prod>
 *   → 이후 모든 프로브 보고에서 이 줄이 **대상 확정 증빙**이 된다(§2c).
 *
 * fail-closed: 모든 실패는 governance 한 줄 + process.exit(1). soft mode 없다.
 */

import { parseAllowList, resolveProjectRef } from "../../src/lib/db/target-core";

export interface ScriptDbTargetEnv {
  readonly DIRECT_URL?: string;
  readonly DEV_DATABASE_PROJECT_REF?: string;
  readonly ALLOW_PROD_DATABASE_PROJECT_REF?: string;
}

export type ScriptDbTargetMode = "test" | "prod";

export type ScriptDbTargetFailureReason =
  | "missing_direct_url"
  | "empty_allow_list"
  | "unparseable_url"
  | "project_ref_not_extractable"
  | "not_allowed_and_no_prod_token"
  | "prod_token_ref_mismatch";

export interface ScriptDbTargetSuccess {
  readonly ok: true;
  readonly projectRef: string;
  readonly mode: ScriptDbTargetMode;
  readonly allowList: readonly string[];
}

export interface ScriptDbTargetFailure {
  readonly ok: false;
  readonly reason: ScriptDbTargetFailureReason;
  readonly detail: string;
  readonly projectRef?: string;
  readonly allowList?: readonly string[];
}

export type ScriptDbTargetResult = ScriptDbTargetSuccess | ScriptDbTargetFailure;

/**
 * prod 를 여는 값의 정본 형식 — **ref 이름 그 자체**.
 * 🔑 값이 곧 대상이라, 다른 환경에 복사해도 ref 가 달라 아무 효과가 없다
 *   (`production-database.ts` 의 `DEV_DATABASE_PROJECT_REF` 와 같은 설계).
 */
export function expectedProdToken(projectRef: string): string {
  return projectRef;
}

/**
 * 순수 함수 — 부작용 없음. 단위 테스트가 이 형태를 직접 문다
 * (smoke/pilot guard 와 같은 구조).
 */
export function checkScriptDbTarget(env: ScriptDbTargetEnv): ScriptDbTargetResult {
  const rawUrl = env.DIRECT_URL;
  if (!rawUrl || rawUrl.trim() === "") {
    return {
      ok: false,
      reason: "missing_direct_url",
      detail: "DIRECT_URL is not set. Script DB access refuses to guess a target.",
    };
  }

  const allowList = parseAllowList(env.DEV_DATABASE_PROJECT_REF);
  if (allowList.length === 0) {
    return {
      ok: false,
      reason: "empty_allow_list",
      detail:
        "DEV_DATABASE_PROJECT_REF is not set. Script DB access refuses to run without an explicitly named dev project.",
    };
  }

  const resolved = resolveProjectRef(rawUrl);
  if (!resolved.ok) {
    if (resolved.reason === "unparseable_url") {
      return {
        ok: false,
        reason: "unparseable_url",
        detail: `DIRECT_URL is not a parseable URL: ${resolved.parseError}`,
      };
    }
    return {
      ok: false,
      reason: "project_ref_not_extractable",
      detail:
        "Could not extract a Supabase project-ref from DIRECT_URL. Expected `postgres.<ref>` user or `db.<ref>.supabase.co` host.",
    };
  }
  const projectRef = resolved.projectRef;

  // 기본 경로 — allow-list 에 있으면 test 다.
  if (allowList.includes(projectRef)) {
    return { ok: true, projectRef, mode: "test", allowList };
  }

  // 목록 밖 = prod 후보. 토큰이 없으면 여기서 끝난다.
  const token = env.ALLOW_PROD_DATABASE_PROJECT_REF?.trim();
  if (!token) {
    return {
      ok: false,
      reason: "not_allowed_and_no_prod_token",
      detail: `project-ref "${projectRef}" is not the declared dev project (DEV_DATABASE_PROJECT_REF) and ALLOW_PROD_DATABASE_PROJECT_REF is not set. Set ALLOW_PROD_DATABASE_PROJECT_REF=${expectedProdToken(
        projectRef,
      )} to target it on purpose.`,
      projectRef,
      allowList,
    };
  }

  // 🔑 토큰 값이 **이 ref** 를 물고 있어야 한다. 복사한 토큰이 다른 prod 를 열지 못한다.
  if (token !== expectedProdToken(projectRef)) {
    return {
      ok: false,
      reason: "prod_token_ref_mismatch",
      detail: `ALLOW_PROD_DATABASE_PROJECT_REF does not match this target. Expected "${expectedProdToken(
        projectRef,
      )}" for project-ref "${projectRef}".`,
      projectRef,
      allowList,
    };
  }

  return { ok: true, projectRef, mode: "prod", allowList };
}

/**
 * 러너 형태 — 스크립트·프로브의 **첫 줄**에서 부른다.
 * Prisma 클라이언트를 만들기 **전에** 불러야 의미가 있다: 대상을 말하지 않은 채
 * 접속이 열리면 이 헬퍼가 없는 것과 같다.
 *
 * 성공 시 고정 형식 한 줄을 찍는다 — 이 줄이 대상 확정 증빙이다.
 *   [db-target] ref=<ref> mode=<test|prod>
 */
export function assertScriptDbTarget(
  env: ScriptDbTargetEnv = process.env as ScriptDbTargetEnv,
): ScriptDbTargetSuccess {
  const result = checkScriptDbTarget(env);
  if (!result.ok) {
    // eslint-disable-next-line no-console
    console.error(`[db-target] ABORT (${result.reason}): ${result.detail}`);
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.log(`[db-target] ref=${result.projectRef} mode=${result.mode}`);
  return result;
}
