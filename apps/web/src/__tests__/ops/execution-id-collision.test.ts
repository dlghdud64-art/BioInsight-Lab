/**
 * §execution-id-collision — execution id 는 시간만으로 만들지 않는다
 *
 * 배경 (2026-08-12, §test-baseline-debt 분류 중 발견):
 *   `executionId: \`exec_${Date.now().toString(36)}\`` — **같은 밀리초 안에 생성되면 충돌**한다.
 *   실측(`dispatch-execution-handoff` H5): 서로 다른 `idempotencyKey` 로 만든 두 execution 이
 *   같은 id 를 받았다. 두 실행이 같은 id 를 가지면 **발송·입고 이력이 뒤섞인다** —
 *   구매 운영에서 회수 불가능한 오류다.
 *
 *   시간 의존이라 간헐 실패했고, 그래서 오래 **"flaky 테스트" 로 위장**돼 있었다.
 *   전체 스위트 ratchet 게이트가 4회 중 1회 흔들린 것을 조사하다 드러났다.
 *
 * 계약:
 *   X1. execution 계열 id 생성에 `Date.now()` 단독이 쓰이지 않는다.
 *   X2. 교정된 지점은 `crypto.randomUUID()` 를 쓴다 (전역 Web Crypto —
 *       `node:crypto` 가 아니다. 이 엔진들을 **클라이언트 컴포넌트가 import** 한다).
 *   X3. 수집이 실제로 동작한다 (공허 GREEN 방지 — 대상 0건은 성공이 아니라 실패다).
 *
 * ⚠️ 범위: **execution 계열 접두사만** 본다. `Date.now().toString(36)` 자체는 이 repo 에
 *   267곳 있고 대부분 execution 과 무관하다. 전수는 별건이며 여기서 열지 않는다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const AI_ROOT = join(WEB_ROOT, "src", "lib", "ai");

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function tsFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__") continue;
      tsFiles(full, acc);
    } else if (entry.endsWith(".ts")) acc.push(full);
  }
  return acc;
}

const FILES = tsFiles(AI_ROOT).map((f) => ({
  path: f.slice(WEB_ROOT.length + 1).split("\\").join("/"),
  code: stripComments(readFileSync(f, "utf8")),
}));

/** execution 계열 id 접두사 — 실측으로 확정된 10곳의 접두사 */
const EXEC_PREFIX = "(?:exec|rcvexec|rcvexecre|rcvexsn|rexecgov|execgate|execsn|execws)[a-z]*";

describe("§execution-id-collision X3 — 수집이 실제로 동작한다", () => {
  it("lib/ai 소스가 수집된다", () => {
    expect(FILES.length).toBeGreaterThan(30);
    // 교정 대상이 실제로 존재하는지 — 접두사가 하나도 안 잡히면 이 sentinel 은 공허하다
    const withPrefix = FILES.filter((f) =>
      new RegExp("`" + EXEC_PREFIX + "_\\$\\{", "").test(f.code),
    );
    expect(withPrefix.length).toBeGreaterThanOrEqual(8);
  });
});

describe("§execution-id-collision X1 — 시간만으로 id 를 만들지 않는다", () => {
  it("execution 계열 id 생성에 Date.now() 단독이 없다", () => {
    const re = new RegExp("`" + EXEC_PREFIX + "_\\$\\{\\s*Date\\.now\\(\\)", "g");
    const offenders = FILES.filter((f) => re.test(f.code)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });
});

describe("§execution-id-collision X2 — randomUUID 를 쓴다", () => {
  it("교정 지점이 crypto.randomUUID() 를 쓴다", () => {
    const re = new RegExp("`" + EXEC_PREFIX + "_\\$\\{\\s*crypto\\.randomUUID\\(\\)", "");
    const ok = FILES.filter((f) => re.test(f.code)).map((f) => f.path);
    expect(ok.length).toBeGreaterThanOrEqual(8);
  });

  it("node:crypto 를 import 하지 않는다 (클라이언트 번들 보호)", () => {
    const offenders = FILES.filter(
      (f) => /from\s+["']node:crypto["']/.test(f.code) && /randomUUID/.test(f.code),
    ).map((f) => f.path);
    expect(offenders).toEqual([]);
  });
});
