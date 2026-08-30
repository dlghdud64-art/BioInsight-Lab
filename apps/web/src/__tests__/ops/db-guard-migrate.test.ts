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
import { describe, it, expect, vi } from "vitest";
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

/**
 * §dev-prod-db-separation **2단계** — 호스트만으로는 dev/prod 가 갈리지 않는다
 *
 * 실측 (2026-08-12, 개발 프로젝트 전환 시점):
 *   개발용 Supabase 프로젝트로 `.env` 를 바꿨는데 가드가 **여전히 운영으로 판정**했다.
 *   두 프로젝트가 같은 `pooler.supabase.com` 을 쓰기 때문이다 —
 *   호스트 패턴은 "Supabase 인가" 만 답하고 "**어느 프로젝트인가**" 는 답하지 못한다.
 *
 * 교정: **project ref** 로 갈린다(`postgres.<ref>`).
 *   `DEV_DATABASE_PROJECT_REF` 가 현재 URL 의 ref 와 **일치할 때만** 개발로 본다.
 *
 * 계약:
 *   G5. ref 판정이 존재한다 (호스트 단독 판정 부활 차단)
 *   G6. **fail-closed** — 선언이 없거나 다르면 운영으로 판정
 *   G7. boolean 플래그가 아니라 **ref 이름 비교**다 —
 *       운영 환경에 이 변수가 실수로 복사돼도 ref 가 달라 무효여야 한다
 */
describe("§dev-prod-db-separation G5~G7 — 프로젝트 ref 로 갈린다", () => {
  const SRC = read("src/lib/security/production-database.ts");

  it("G5. project ref 를 추출해 판정에 쓴다", () => {
    /* 🔑 승계 (§prisma-target-helper · 호영님 판정 2026-08-31 · 파서 정본 일원화).
     * 옛 단언은 이 파일 안의 **정규식 리터럴**(`postgres\.([a-z0-9]{16,})`)을 핀했다.
     * 잠그는 결정은 "ref 를 추출해 판정에 쓴다" 이지 그 정규식이 여기 **있다**가 아니다.
     * 🛑 옛 정규식은 pooler 형태만 뽑아 direct 형태(`db.<ref>.supabase.co`)에서 ref 가
     *   null 이 되고, 그러면 isDeclaredDevProject 가 항상 false → **개발 프로젝트를
     *   운영으로 오판**했다. 승계할 설계가 아니라 결함이라 core 파서로 교체했다.
     * → 정규식 자리를 정본 import 로 승계한다. 형태별 동작은 아래 G5-c 가 실증한다. */
    expect(SRC).toMatch(/import \{ extractSupabaseProjectRef \} from "\.\.\/db\/target-core"/);
    expect(SRC).not.toMatch(/SUPABASE_PROJECT_REF = \//);
    expect(SRC).toMatch(/function projectRefOf/);
    expect(SRC).toMatch(/isDeclaredDevProject\(u\)/);
  });

  it("G6. fail-closed — 선언이 없으면 개발로 보지 않는다", () => {
    expect(SRC).toMatch(/if \(!declared\) return false/);
  });

  it("G7. boolean 이 아니라 ref 이름을 비교한다 (운영 복사 무효)", () => {
    expect(SRC).toMatch(/ref !== null && ref === declared/);
    // `DEV_DATABASE=true` 같은 boolean 우회가 부활하면 RED
    expect(SRC).not.toMatch(/DEV_DATABASE_PROJECT_REF\s*===\s*["']true["']/);
  });

  it("G5-b. 호스트 판정은 남아 있다 (ref 판정이 대체가 아니라 추가)", () => {
    expect(SRC).toMatch(/PRODUCTION_DB_HOST\.test\(u\)/);
    expect(SRC).toMatch(/!LOCAL_DB_HOST\.test\(u\)/);
  });

  describe("G5-c. **동작 보존** — 두 URL 형태 (호영님 지시 2026-08-31)", () => {
    /* 🔑 소스 grep 만으로는 파서 교체의 동작 보존을 못 말한다. 실제로 판정을 돌린다.
     *   런타임 소비자가 auth.ts · admin/seed 라 이 판정이 바뀌면 그 둘이 바뀐다.
     * 실측(2026-08-31): 로컬 env 8/8 · prod 런타임 모두 pooler 형태 —
     *   direct 형태는 0건이라 이 교체로 판정이 바뀌는 실 URL 은 측정 범위에 없다.
     *   그래도 **형태별로 잠근다**: 없다는 것과 안 통한다는 것은 다르다. */
    const REF = "abcd1234efgh5678";
    const pooler = `postgresql://postgres.${REF}:pw@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres`;
    const direct = `postgresql://postgres:pw@db.${REF}.supabase.co:5432/postgres`;

    async function judge(url: string, declared?: string): Promise<boolean> {
      vi.resetModules();
      vi.stubEnv("DATABASE_URL", url);
      vi.stubEnv("DIRECT_URL", url);
      vi.stubEnv("DEV_DATABASE_PROJECT_REF", declared ?? "");
      const mod = await import("@/lib/security/production-database");
      const out = mod.isProductionDatabase();
      vi.unstubAllEnvs();
      return out;
    }

    it("pooler 형태 — 선언된 개발 ref 면 운영이 아니다 (기존 동작 보존)", async () => {
      expect(await judge(pooler, REF)).toBe(false);
    });

    it("pooler 형태 — 선언이 없으면 운영으로 본다 (fail-closed 보존)", async () => {
      expect(await judge(pooler)).toBe(true);
    });

    it("🔑 direct 형태 — 선언된 개발 ref 면 운영이 아니다 (옛 정규식은 여기서 오판했다)", async () => {
      expect(await judge(direct, REF)).toBe(false);
    });

    it("direct 형태 — 선언이 없으면 운영으로 본다 (fail-closed 는 형태와 무관)", async () => {
      expect(await judge(direct)).toBe(true);
    });

    it("선언이 다른 ref 면 형태와 무관하게 운영이다 (복사 무효)", async () => {
      expect(await judge(pooler, "zzzz9999yyyy8888")).toBe(true);
      expect(await judge(direct, "zzzz9999yyyy8888")).toBe(true);
    });
  });
});

describe("§dev-prod-db-separation G4 — 운영 적용 경로는 남아 있다", () => {
  it("prisma:migrate 는 migrate deploy 이며 가드를 거치지 않는다", () => {
    const cmd = pkg.scripts["prisma:migrate"];
    expect(cmd).toMatch(/migrate\s+deploy/);
    expect(cmd).not.toMatch(/migrate\s+dev/);
  });
});
