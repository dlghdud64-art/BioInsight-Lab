/**
 * §prisma-target-helper — 스크립트·프로브 DB 대상 게이트 (호영님 판정 2026-08-30).
 *
 * 순수 형태(`checkScriptDbTarget`)를 문다 — 러너 형태는 여기에 위임하므로
 * 순수 계약을 잠그면 러너도 잠긴다 (smoke/pilot guard 와 같은 구조).
 *
 * 배경: tvkl/xhid 사고의 구조 원인은 무인자 `new PrismaClient()` 가 `.env` 를
 *   **조용히** 읽는 것이었다. 조용한 게 문제였지 값이 문제가 아니었다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  checkScriptDbTarget,
  expectedProdToken,
  type ScriptDbTargetEnv,
} from "../../../scripts/lib/db-target";

const TEST_REF = "abcd1234efgh5678";
const PROD_REF = "zzzz9999yyyy8888";

const poolerUrl = (ref: string) =>
  `postgresql://postgres.${ref}:pw@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres`;
const directUrl = (ref: string) =>
  `postgresql://postgres:pw@db.${ref}.supabase.co:5432/postgres`;

const REPO_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

describe("checkScriptDbTarget — test 기본", () => {
  it("allow-list 에 있는 ref 는 mode=test 로 통과 (pooler)", () => {
    const env: ScriptDbTargetEnv = {
      DIRECT_URL: poolerUrl(TEST_REF),
      DEV_DATABASE_PROJECT_REF: TEST_REF,
    };
    const r = checkScriptDbTarget(env);
    expect(r).toMatchObject({ ok: true, projectRef: TEST_REF, mode: "test" });
  });

  it("direct URL 형태도 같은 ref 를 뽑는다", () => {
    const r = checkScriptDbTarget({
      DIRECT_URL: directUrl(TEST_REF),
      DEV_DATABASE_PROJECT_REF: ` ${TEST_REF} `,
    });
    expect(r).toMatchObject({ ok: true, projectRef: TEST_REF, mode: "test" });
  });

  it("DIRECT_URL 부재 → 추측하지 않고 중단", () => {
    const r = checkScriptDbTarget({ DEV_DATABASE_PROJECT_REF: TEST_REF });
    expect(r).toMatchObject({ ok: false, reason: "missing_direct_url" });
  });

  it("개발 프로젝트 미지정이면 중단 — 이름 없이 돌지 않는다", () => {
    const r = checkScriptDbTarget({ DIRECT_URL: poolerUrl(TEST_REF) });
    expect(r).toMatchObject({ ok: false, reason: "empty_allow_list" });
  });

  it("파싱 불가 URL → unparseable_url", () => {
    const r = checkScriptDbTarget({
      DIRECT_URL: "not a url",
      DEV_DATABASE_PROJECT_REF: TEST_REF,
    });
    expect(r).toMatchObject({ ok: false, reason: "unparseable_url" });
  });

  it("Supabase 형태가 아니면 ref 를 못 뽑고 중단", () => {
    const r = checkScriptDbTarget({
      DIRECT_URL: "postgresql://postgres:pw@localhost:5432/postgres",
      DEV_DATABASE_PROJECT_REF: TEST_REF,
    });
    expect(r).toMatchObject({ ok: false, reason: "project_ref_not_extractable" });
  });
});

describe("🛑 prod 는 목록이 아니라 토큰으로만 열린다", () => {
  it("목록 밖 ref + 토큰 없음 → 중단 (그리고 필요한 토큰을 알려준다)", () => {
    const r = checkScriptDbTarget({
      DIRECT_URL: poolerUrl(PROD_REF),
      DEV_DATABASE_PROJECT_REF: TEST_REF,
    });
    expect(r).toMatchObject({
      ok: false,
      reason: "not_allowed_and_no_prod_token",
      projectRef: PROD_REF,
    });
    expect((r as { detail: string }).detail).toContain(expectedProdToken(PROD_REF));
  });

  it("🔑 값이 **그 ref** 여야 한다 — 다른 환경에서 복사해 와도 못 연다", () => {
    const r = checkScriptDbTarget({
      DIRECT_URL: poolerUrl(PROD_REF),
      DEV_DATABASE_PROJECT_REF: TEST_REF,
      ALLOW_PROD_DATABASE_PROJECT_REF: expectedProdToken("some-other-prod-ref"),
    });
    expect(r).toMatchObject({ ok: false, reason: "prod_token_ref_mismatch" });
  });

  it("ref 가 맞는 토큰이면 mode=prod 로 통과", () => {
    const r = checkScriptDbTarget({
      DIRECT_URL: poolerUrl(PROD_REF),
      DEV_DATABASE_PROJECT_REF: TEST_REF,
      ALLOW_PROD_DATABASE_PROJECT_REF: expectedProdToken(PROD_REF),
    });
    expect(r).toMatchObject({ ok: true, projectRef: PROD_REF, mode: "prod" });
  });

  it("prod 승인 값이 있어도 개발 프로젝트면 test 다 — 값이 test 를 prod 로 만들지 않는다", () => {
    const r = checkScriptDbTarget({
      DIRECT_URL: poolerUrl(TEST_REF),
      DEV_DATABASE_PROJECT_REF: TEST_REF,
      ALLOW_PROD_DATABASE_PROJECT_REF: expectedProdToken(TEST_REF),
    });
    expect(r).toMatchObject({ ok: true, mode: "test" });
  });

  it("prod 승인 값의 정본 형식 — **ref 이름 그 자체**", () => {
    /* 🔑 `YES-PROD-<ref>` 문자열에서 ref 이름으로 바꿨다(호영님 판정 2026-08-31).
     * 기존 정본(production-database.ts)의 설계 원칙을 승계한다 —
     * "boolean 플래그가 아니라 ref 이름이라, 운영 환경에 실수로 복사해도
     *  ref 가 달라 아무 효과가 없다." 승계하는 것은 문자열이 아니라 그 설계다. */
    expect(expectedProdToken("abc")).toBe("abc");
  });
});

describe("🔑 정본 1개 — 파서는 core 가 든다 (사본 부활 잠금)", () => {
  it("smoke·pilot·일반 wrapper 가 모두 core 를 쓴다", () => {
    for (const rel of [
      "scripts/smoke/guard.ts",
      "scripts/pilot/guard.ts",
      "scripts/lib/db-target.ts",
    ]) {
      const src = stripComments(read(rel));
      expect(src).toMatch(/from "\.\.\/\.\.\/src\/lib\/db\/target-core"/);
      expect(src).toMatch(/resolveProjectRef\(/);
      expect(src).toMatch(/parseAllowList\(/);
    }
  });

  it("🛑 ref 추출 사본이 되살아나면 RED", () => {
    /* smoke·pilot 에 글자까지 같은 사본이 있었다(408 vs 406 바이트, 차이는 빈 줄뿐).
     * core 는 **정책을 하나도 갖지 않는 파서**라 두 트랙의 독립성은 훼손되지 않는다
     * (호영님 A-1a 승인). 사본이 다시 생기면 그 근거가 무너진다. */
    for (const rel of ["scripts/smoke/guard.ts", "scripts/pilot/guard.ts", "scripts/lib/db-target.ts"]) {
      const src = stripComments(read(rel));
      expect(src).not.toMatch(/function extractSupabaseProjectRef/);
    }
    const core = stripComments(read("src/lib/db/target-core.ts"));
    expect(core).toMatch(/export function extractSupabaseProjectRef/);
    /* 🔑 런타임 정본도 이 파서를 쓴다 — 규칙이 두 곳에 있으면 갈리고, 갈리면 뚫린다 */
    const prod = stripComments(read("src/lib/security/production-database.ts"));
    expect(prod).toMatch(/import \{ extractSupabaseProjectRef \} from "\.\.\/db\/target-core"/);
    expect(prod).not.toMatch(/SUPABASE_PROJECT_REF = \//);
  });

  it("🛑 core 는 정책을 갖지 않는다 — env 키를 모른다", () => {
    /* 정책이 core 로 새면 "정책 셋 · 파서 하나" 구조가 깨지고, pilot 사본 제거의
     * 승인 근거(정책 독립 보존)가 사후에 거짓이 된다. */
    const core = stripComments(read("src/lib/db/target-core.ts"));
    expect(core).not.toMatch(/DATABASE_URL|DIRECT_URL|ALLOWED_|ALLOW_PROD|OPT_IN/);
    expect(core).not.toMatch(/process\.(env|exit)/);
    expect(core).not.toMatch(/console\./);
  });

  it("각 wrapper 는 자기 정책을 그대로 갖는다 (셋이 서로 다르다)", () => {
    const smoke = stripComments(read("scripts/smoke/guard.ts"));
    const pilot = stripComments(read("scripts/pilot/guard.ts"));
    const gen = stripComments(read("scripts/lib/db-target.ts"));
    expect(smoke).toMatch(/production_ref_in_allow_list/); // prod 금지
    expect(pilot).toMatch(/REQUIRED_OPT_IN_TOKEN/); // prod opt-in
    expect(gen).toMatch(/not_allowed_and_no_prod_token/); // test 기본 · 토큰으로 prod
  });
});

describe("🔑 시작 로그 형식 고정 — 대상 확정 증빙", () => {
  it("assert 형태가 [db-target] ref=<ref> mode=<mode> 를 찍는다", () => {
    /* 이후 모든 프로브 보고에서 이 줄이 §2c 의 '대상 확정' 증빙이 된다.
     * 형식이 흔들리면 보고서끼리 대조가 안 된다. */
    const src = stripComments(read("scripts/lib/db-target.ts"));
    expect(src).toMatch(
      /console\.log\(`\[db-target\] ref=\$\{result\.projectRef\} mode=\$\{result\.mode\}`\)/,
    );
    /* 실패는 governance 한 줄 + exit — soft mode 없다 */
    expect(src).toMatch(/console\.error\(`\[db-target\] ABORT \(\$\{result\.reason\}\)/);
    expect(src).toMatch(/process\.exit\(1\)/);
  });
});
