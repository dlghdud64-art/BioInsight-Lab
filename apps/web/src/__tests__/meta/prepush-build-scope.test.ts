/**
 * §prepush-build-scope · pre-push 빌드 건너뛰기 허용 목록 (호영님 판정 2026-09-26)
 *
 * 왜 이 검사가 있나
 *   pre-push 는 전체 프로덕션 빌드를 돈다(API 라우트 311 + 페이지 109 · dist 1.7GB ·
 *   같은 커밋의 Vercel 빌드 302초). push 지연의 전부가 그것이었고, 빌드가 필요 없는 push 에서는
 *   돌리지 않기로 판정됐다.
 *
 * 🛑 이것은 **예외 목록**이다 — CLAUDE.md 가 경고하는 형태다: 목록은 커지는 방향으로만 움직인다.
 *   「이것도 빌드 안 해도 되지 않나」 가 하나 들어가는 순간 다음 사람이 하나 더 넣는 비용이 0이 된다.
 *   그래서 목록을 **리터럴 집합으로 고정**한다(§개수는 명제가 아니다 — 총계가 아니라 구성을 본다).
 *   늘리려면 이 단언을 고쳐야 하고, 그 diff 가 판정 요청이 된다.
 *
 * 🛑 방향도 잠근다 — **기본값은 빌드**다. 「앱 소스 목록을 만들어 그것만 빌드」 로 뒤집으면
 *   목록에서 빠지기 쉬운 파일(`package.json` · `next.config` · `tsconfig` · `prisma/schema` ·
 *   `middleware` · `public/`)이 빌드 없이 나간다 — 그것이 이 방식의 실패 경로다(호영님).
 *
 * 프로브 실측 (sh -e · husky 방식 · 2026-09-26)
 *   테스트 전용 push → skip · package.json 포함 → build · 두 커밋 동시 → build ·
 *   범위 없음 → build · 변경 0 → skip
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO = join(__dirname, "..", "..", "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO, rel), "utf8");

const SCRIPT_REL = "scripts/prepush-needs-build.sh";
const HOOK_REL = ".husky/pre-push";
const SCRIPT = read(SCRIPT_REL);
const HOOK = read(HOOK_REL);

describe("§prepush-build-scope · 허용 목록", () => {
  it("건너뛰는 경로가 정확히 네 줄이다", () => {
    /* case 문의 패턴만 뽑는다 — 주석에 적힌 목록이 아니라 **집행되는 목록**을 본다. */
    const body = SCRIPT.slice(SCRIPT.indexOf("case \"$f\" in"), SCRIPT.indexOf("esac"));
    const patterns = [...body.matchAll(/^\s{4}([^)\s][^)]*)\)/gm)].map((m) => m[1].trim());
    expect(patterns).toEqual([
      "apps/web/src/__tests__/*",
      "*.test.ts|*.test.tsx",
      "apps/web/docs/*",
      "*.md",
      "*", // 그 밖은 전부 빌드 — 이 줄이 기본값이다
    ]);
  });

  it("🛑 기본값이 빌드다 (방향이 뒤집히지 않았다)", () => {
    /* 허용 목록 밖이 하나라도 있으면 build(exit 0). 목록 안이 전부면 skip(exit 1). */
    expect(SCRIPT).toMatch(/outside=\$\(\(outside \+ 1\)\)/);
    expect(SCRIPT).toMatch(/if \[ "\$outside" -eq 0 \]; then[\s\S]{0,200}exit 1/);
    expect(SCRIPT).toMatch(/build required:[\s\S]{0,80}exit 0/);
    /* 범위를 못 구하면 빌드한다 — 판별 불가를 통과로 세지 않는다. */
    expect(SCRIPT).toMatch(/범위를 받지 못했습니다 → 빌드합니다[\s\S]{0,40}exit 0/);
  });

  it("건너뛸 때 한 줄을 출력한다 (조용히 넘어가지 않는다)", () => {
    expect(SCRIPT).toMatch(/build skipped: \$total files, all tests\/docs/);
    expect(SCRIPT).toMatch(/build required: \$total files, \$outside outside tests\/docs/);
  });
});

describe("§prepush-build-scope · 훅 배선", () => {
  it("범위는 @{push}..HEAD 전체다 (마지막 커밋 하나만 보지 않는다)", () => {
    expect(HOOK).toMatch(/range="@\{push\}\.\.HEAD"/);
    /* @{push} 가 없을 때의 대체도 범위여야 한다. */
    expect(HOOK).toMatch(/range="@\{u\}\.\.HEAD"/);
    expect(HOOK).not.toMatch(/HEAD~1\.\.HEAD/);
  });

  it("훅이 판별 스크립트를 부르고, build 는 그 뒤에만 돈다", () => {
    expect(HOOK).toMatch(/if sh scripts\/prepush-needs-build\.sh "\$range"; then/);
    const i = HOOK.indexOf("if sh scripts/prepush-needs-build.sh");
    expect(i).toBeGreaterThan(0);
    /* npm run build 가 조건 **안**에 있다 — 조건 밖에 남아 있으면 판별이 무의미하다. */
    expect(HOOK.slice(i)).toMatch(/cd apps\/web && npm run build \|\| exit 1/);
    expect(HOOK.slice(0, i)).not.toMatch(/npm run build/);
  });

  it("husky 방식 정합 · 개행이 LF 다 (sh 가 워킹카피를 읽는다)", () => {
    /* §파일을 프로그램으로 쓸 때는 개행을 명시한다 — CRLF 면 `sh` 가 `\r` 를 토큰에 넣어 죽는다. */
    for (const src of [SCRIPT, HOOK]) expect(src).not.toMatch(/\r/);
  });
});
