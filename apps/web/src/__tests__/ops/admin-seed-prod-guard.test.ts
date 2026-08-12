/**
 * §admin-seed-prod-guard — 프로덕션 시드 실행은 명시적 확인 없이는 차단된다
 *
 * 배경 (2026-08-10 §enforcement-handle-close-sweep 배치12 실측):
 *   `/api/admin/seed` 는 벤더/제품/연결을 upsert 하는 대량 쓰기다.
 *   라우트 자체에는 role 가드도 NODE_ENV 가드도 없었고, `src/middleware.ts` 의
 *   `/api/admin/*` 중앙 게이트(ADMIN deny-by-default)에만 의존했다.
 *   → 임의 사용자 도달은 불가하나, **확인 절차 없는 POST 한 번이 프로덕션 DB 를
 *     덮는 구조**는 그대로였다.
 *
 * 계약:
 *   S1. 프로덕션에서는 명시적 override 값 없이 실행되지 않는다.
 *   S2. override 는 우연히 만족될 수 없는 고정 문자열이며, truthy 검사가 아니다.
 *   S3. 차단 경로에서 lock 을 남기지 않는다 (fail()).
 *   S4. middleware 의 admin API 중앙 게이트가 살아 있다 (이 가드는 이중 방어일 뿐).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(WEB_ROOT, rel), "utf8");
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const ROUTE = "src/app/api/admin/seed/route.ts";
const MIDDLEWARE = "src/middleware.ts";
const GUARD = "src/lib/security/production-database.ts";

describe("§admin-seed-prod-guard S1/S2/S3 — 프로덕션 이중 게이트", () => {
  /**
   * ⚠️ 2026-08-10 교정 — **가드 기준이 NODE_ENV 에서 DB host 로 바뀌었다.**
   *
   * 로컬 `.env` 가 운영 Supabase 를 직접 가리키고 있어(§dev-prod-db-separation),
   * `NODE_ENV === "production"` 기준 가드는 로컬에서 통과된다. 즉 무력했다.
   * `NODE_ENV` 는 코드가 어디서 도는지를 말할 뿐, **데이터가 어디로 가는지**를 말하지 않는다.
   */
  it("S1. 가드가 존재하고 차단 코드/상태를 낸다", () => {
    const code = stripComments(read(ROUTE));
    expect(code).toMatch(/requiresDestructiveConfirmation\s*\(\s*\)/);
    expect(code).toMatch(/SEED_PRODUCTION_BLOCKED/);
    expect(code).toMatch(/status:\s*403/);
  });

  it("S1-c. 가드가 NODE_ENV 만 보는 형태로 되돌아가지 않는다", () => {
    const code = stripComments(read(ROUTE));
    // 라우트가 직접 NODE_ENV 를 판정 기준으로 쓰면 로컬→운영DB 구멍이 재발한다.
    expect(code).not.toMatch(/if\s*\(\s*process\.env\.NODE_ENV/);
  });

  it("S1-d. 판정기가 DB host 를 주 기준으로 본다", () => {
    const code = stripComments(read(GUARD));
    expect(code).toMatch(/DATABASE_URL/);
    expect(code).toMatch(/DIRECT_URL/);
    expect(code).toMatch(/supabase/i);
  });

  it("S2. override 는 고정 문자열 일치 검사다 (truthy 검사 금지)", () => {
    const code = stripComments(read(ROUTE));
    expect(code).toMatch(/const SEED_PRODUCTION_TOKEN\s*=\s*"[A-Z_]{8,}"/);
    expect(code).toMatch(/confirmProductionSeed\s*!==\s*SEED_PRODUCTION_TOKEN/);
    // `if (!body.confirmProductionSeed)` 같은 truthy 게이트로 약화되면 안 된다
    expect(code).not.toMatch(/!\s*body\??\.?\.?confirmProductionSeed\s*\)/);
  });

  it("S3. 차단 경로가 lock 을 남기지 않는다", () => {
    const code = stripComments(read(ROUTE));
    expect(code).toMatch(/enforcement\.fail\(\);[\s\S]{0,200}?SEED_PRODUCTION_BLOCKED/);
  });

  it("S1-b. 가드가 핸들 생성 이후에 온다 (거부도 집행 경로 안에서 일어난다)", () => {
    const code = stripComments(read(ROUTE));
    const lock = code.indexOf("enforceAction({");
    const guard = code.indexOf("requiresDestructiveConfirmation()");
    expect(lock).toBeGreaterThan(-1);
    expect(guard).toBeGreaterThan(lock);
  });
});

describe("§admin-seed-prod-guard S4 — middleware 중앙 게이트 무손상", () => {
  it("S4. /api/admin/* 는 ADMIN deny-by-default 로 막힌다", () => {
    const code = stripComments(read(MIDDLEWARE));
    expect(code).toMatch(/pathname\.startsWith\('\/api\/admin\/'\)/);
    expect(code).toMatch(/role\s*===\s*'ADMIN'/);
    // matcher 가 /api 를 덮지 않으면 위 가드는 실행조차 되지 않는다
    expect(code).toMatch(/"\/api\/:path\*"/);
  });
});
