/**
 * §dev-prod-db-separation — Prisma 개발 명령이 운영 DB 가드를 우회하지 않는다
 *
 * 배경 (2026-08-10 실측):
 *   `db:migrate` 가 `prisma migrate dev` 였고 `.env` 는 운영 Supabase 를 가리켰다.
 *   `npm run db:migrate` 한 번이 운영 스키마를 직접 건드리는 상태였다
 *   (migrate dev = shadow DB 생성 + drift 시 reset 제안. DEV_RUNBOOK §9.9 사고 경로).
 *
 * 계약:
 *   G1. 개발용 파괴적 스크립트는 가드를 **먼저** 통과해야 한다.
 *   G2. 가드는 판정 규칙을 **재구현하지 않고** production-database.ts 를 재사용한다.
 *       (규칙이 두 곳에 있으면 갈리고, 갈리면 한쪽이 뚫린다)
 *   G3. 판정기는 `DIRECT_URL` 도 본다 — 마이그레이션이 그것을 쓰므로
 *       `DATABASE_URL` 만 보면 이 가드가 통째로 우회된다.
 *   G4. 운영 적용 경로(`migrate deploy`)는 별도로 남아 있다 — 가드가 배포를 막으면 안 된다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(WEB_ROOT, rel), "utf8");

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
const GUARD = "scripts/db-guard.ts";

/** 개발용(= 스키마를 바꾸거나 데이터를 넣는) 스크립트 — 가드 필수 */
const GUARDED_SCRIPTS = ["db:migrate", "db:seed"];

describe("§dev-prod-db-separation G1 — 개발 명령은 가드를 먼저 통과한다", () => {
  it.each(GUARDED_SCRIPTS)("%s 가 db-guard 를 먼저 실행한다", (name) => {
    const cmd = pkg.scripts[name];
    expect(cmd, `${name} 스크립트가 없다`).toBeDefined();
    expect(cmd).toMatch(/scripts\/db-guard\.ts/);
    // 가드가 실제 명령보다 **앞**에 와야 && 로 차단된다
    expect(cmd.indexOf("db-guard.ts")).toBeLessThan(cmd.indexOf("&&"));
  });

  it("가드 없이 prisma 개발 명령을 직접 부르는 스크립트가 없다", () => {
    const offenders = Object.entries(pkg.scripts)
      .filter(([, cmd]) => /prisma\s+(migrate\s+dev|db\s+push)/.test(cmd))
      .filter(([, cmd]) => !cmd.includes("db-guard.ts"))
      .map(([name]) => name);
    expect(offenders).toEqual([]);
  });
});

describe("§dev-prod-db-separation G2/G3 — 가드는 판정기를 재사용한다", () => {
  it("G2. db-guard 가 production-database 판정기를 import 한다", () => {
    const code = stripComments(read(GUARD));
    expect(code).toMatch(/isProductionDatabase/);
    expect(code).toMatch(/production-database/);
    // 규칙 재구현 금지 — 가드 안에서 host 패턴을 직접 매칭하면 갈린다
    expect(code).not.toMatch(/supabase\.com\s*\//);
  });

  it("G3. 판정기가 DIRECT_URL 도 본다", () => {
    const code = stripComments(read("src/lib/security/production-database.ts"));
    expect(code).toMatch(/DATABASE_URL/);
    expect(code).toMatch(/DIRECT_URL/);
  });

  it("G1-b. 가드가 실패 시 비영 종료코드를 낸다", () => {
    const code = stripComments(read(GUARD));
    expect(code).toMatch(/process\.exit\(\s*1\s*\)/);
  });
});

describe("§dev-prod-db-separation G4 — 운영 적용 경로는 남아 있다", () => {
  it("prisma:migrate 는 migrate deploy 이며 가드를 거치지 않는다", () => {
    const cmd = pkg.scripts["prisma:migrate"];
    expect(cmd).toMatch(/migrate\s+deploy/);
    expect(cmd).not.toMatch(/migrate\s+dev/);
  });
});
