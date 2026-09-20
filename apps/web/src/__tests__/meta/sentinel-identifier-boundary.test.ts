/**
 * §sentinel-identifier-boundary (2026-09-20 · 릴레이 판정) · **래칫**
 *
 * 🔒 이 파일은 래칫이다. 항상 GREEN 이어야 하고, RED 면 기준선 원장에 올리는 것이 아니라 **즉시 처리**한다
 *    (CLAUDE.md §래칫류는 기준선 RED 원장에 올리지 않는다).
 *
 * ── 왜 ──
 * `expect(src).toMatch(/foo/)` 처럼 패턴이 식별자 한 덩어리이고 경계가 없으면, 그 식별자를
 * **개명해도 계속 매칭**된다. 검사는 있는데 아무것도 막지 않는다.
 * 2026-09-20 하루에 이 형태로 **무효였던 단언 4건**이 프로브에 잡혔다(전부 이 세션이 쓴 것 포함):
 *   · `/useSupportInquiries/`  전량 개명에도 GREEN
 *   · `/createAuditLog/` ×12   주석에도 걸리고, **동명이인 두 모듈**(→ AuditLog vs DataAuditLog)을 못 가른다
 *   · `/inquiryStatusLabel/` 계열  같은 창의 다른 요소가 대신 매칭
 * 검사가 무효면 그 위에 쌓은 판정이 전부 무효다 — 그래서 **새로 생기는 것부터** 막는다.
 *
 * ── 범위 판정 (릴레이 2026-09-20) ──
 * 전수 실측 1,599건(464파일 · 주석 제거본 기준)은 **지금 전부 고치지 않는다.** 범위가 너무 크다. 대신:
 *   ① 신규는 막는다 — 이 래칫.
 *   ② `createAuditLog` 12건만 즉시 처리(동명이인 함정 · §audit-logger-homonym, 2026-09-20 완료).
 *   ③ 나머지는 **그 파일을 건드릴 때 함께 고친다.** 목록은 줄어드는 방향으로만 움직인다.
 *
 * ── 레거시 목록 ──
 *   `_fixtures/identifier-boundary-legacy.json` — 이 조항 도입 시점에 이미 결함이 있던 파일 집합.
 *   소유자: 운영 트랙(operator). 재검토: 2026-12-20. 정책: 기회가 될 때 줄인다 · 늘리지 않는다.
 *   🛑 새 파일을 여기 추가해서 통과시키지 말 것. 그 순간 이 래칫은 꺼진다
 *      (CLAUDE.md §예외 목록은 커지는 방향으로만 움직인다). ③이 그것을 막는다.
 *
 * ── 이 파일이 안 보는 것 (자기 한계 · 다음 검사의 시작점) ──
 *   1. **부정 단언**(`not.toMatch(/foo/)`). 경계 없음이 반대 방향으로 틀린다(과탐 → 계약을 지키는
 *      구현이 RED). 2026-09-20 실측 229건 / 135파일. 처방이 달라 섞지 않았다.
 *   2. **여러 줄에 걸친 정규식**과 변수로 조립한 패턴. 한 줄 형태만 본다.
 *   3. **창(window) 문제**. 경계가 있어도 창이 넓으면 다른 요소가 대신 매칭한다(4원칙 ④⑤).
 *      같은 날 실측 2건이 그 형태였고 이 래칫은 그것을 못 잡는다.
 *   4. 이미 목록에 있는 파일 **안에서 새로 늘어나는 건수**. 파일 단위라 그건 통과한다.
 *      ③의 건수 상한이 그 방향을 막는다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { scanIdentifierBoundary } from "@/__tests__/_helpers/identifier-boundary-scan";
import LEGACY from "@/__tests__/_fixtures/identifier-boundary-legacy.json";

const SRC = join(__dirname, "..", "..");

/** 이 조항 도입 시점(2026-09-20)의 양성 단언 총계. 상한이며 올리지 않는다. */
const LEGACY_OCCURRENCE_CEILING = 1599;

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (n === "node_modules") continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.test\.tsx?$/.test(n)) out.push(p);
  }
  return out;
}

const rel = (p: string) => relative(SRC, p).split(sep).join("/");

/**
 * 자기 자신은 대상에서 뺀다 — ④의 자기검증이 나쁜 형태를 **문자열 리터럴로** 들고 있어야 하기 때문이다.
 * 🛑 제외는 이 한 파일뿐이고, 아래 ⑤가 "정말 한 파일인지" 를 다시 센다(예외가 조용히 늘지 못하게).
 */
const SELF = "__tests__/meta/sentinel-identifier-boundary.test.ts";

const testFiles = walk(SRC);
const scanned = testFiles.filter((p) => rel(p) !== SELF);

const perFile = scanned
  .map((p) => ({ file: rel(p), hits: scanIdentifierBoundary(readFileSync(p, "utf8")) }))
  .filter((r) => r.hits.length > 0);

describe("§sentinel-identifier-boundary · 새 센티널은 경계를 붙인다 (래칫)", () => {
  it("① 신규 파일에 경계 없는 식별자 단언이 0 이다", () => {
    const legacy = new Set(LEGACY as string[]);
    const offenders = perFile
      .filter((r) => !legacy.has(r.file))
      .map((r) => `${r.file}:${r.hits[0].line}  /${r.hits[0].token}/  (총 ${r.hits.length}건)`)
      .sort();
    // 처방: 사용 지점의 형태로 바꾼다 — /\bfoo\(/ · /<Foo/ · /foo:/ · import 경로와 함께.
    expect(offenders).toEqual([]);
  });

  it("⑤ 스캔 제외는 자기 자신 한 파일뿐이다", () => {
    expect(testFiles.length - scanned.length).toBe(1);
    expect(testFiles.map(rel)).toContain(SELF);
  });

  it("② 레거시 목록에 유령 경로가 없다 (파일이 사라지면 목록에서도 지운다)", () => {
    const present = new Set(scanned.map(rel));
    const ghosts = (LEGACY as string[]).filter((f) => !present.has(f));
    expect(ghosts).toEqual([]);
  });

  it("③ 총계는 늘지 않는다 (예외 목록이 커지는 방향 차단)", () => {
    const total = perFile.reduce((n, r) => n + r.hits.length, 0);
    expect(total).toBeLessThanOrEqual(LEGACY_OCCURRENCE_CEILING);
  });

  it("④ 탐지기 자기검증 · 경계가 있으면 잡지 않고, 없으면 잡는다", () => {
    const bad = 'expect(src).toMatch(/createAuditLog/);';
    const good1 = 'expect(src).toMatch(/\\bcreateAuditLog\\(/);';
    const good2 = 'expect(src).toMatch(/createAuditLog\\(/);';
    const good3 = 'expect(src).not.toMatch(/createAuditLog/);'; // 부정은 대상 밖(자기 한계 1)
    expect(scanIdentifierBoundary(bad).map((h) => h.token)).toEqual(["createAuditLog"]);
    expect(scanIdentifierBoundary(good1)).toEqual([]);
    expect(scanIdentifierBoundary(good2)).toEqual([]);
    expect(scanIdentifierBoundary(good3)).toEqual([]);
    // 부정까지 보라고 하면 그때는 잡는다(다른 축으로 쓸 때를 위해 동작을 고정한다)
    expect(scanIdentifierBoundary(good3, { includeNegated: true }).map((h) => h.token)).toEqual([
      "createAuditLog",
    ]);
  });
});
