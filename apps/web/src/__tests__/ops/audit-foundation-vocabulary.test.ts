/**
 * §audit-foundation ① — 어휘 계약의 기계 검증 가능한 부분
 *
 * 설계 확정(문서 승인) 이전이라도 **되돌아가면 안 되는 것**만 먼저 잠근다.
 *
 * 계약:
 *   A1. `targetEntityType`/`targetEntityId` 에 타입 캐스트(as never/any/unknown) 금지.
 *       enum 에 값이 없다고 캐스트로 우회하면, 나중에 enum 을 고쳐도
 *       **그 지점은 자동으로 따라오지 않는다**(컴파일러가 검사를 포기했으므로).
 *       실측 1건(user/profile) 발견 → 교정 후 재발 차단.
 *   A2. 쓰기가 없는 핸들러가 `complete()` 로 닫지 않는다.
 *       `complete()` 는 인자가 없어도 audit envelope 을 append 한다
 *       (beforeState/afterState 가 status: pending→completed 기본값으로 채워짐).
 *       영속화(② §audit-persistence-gap) 직후부터 **거짓 감사 기록**이 된다.
 *       실측 1건(analytics/ai-insight) 발견 → 교정 후 재발 차단.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const API_ROOT = join(WEB_ROOT, "src", "app", "api");

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function routeFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) routeFiles(full, acc);
    else if (entry === "route.ts") acc.push(full);
  }
  return acc;
}

const FILES = routeFiles(API_ROOT).map((f) => ({
  path: f.slice(WEB_ROOT.length + 1).split("\\").join("/"),
  code: stripComments(readFileSync(f, "utf8")),
}));

describe("§audit-foundation ① A1 — enum 을 캐스트로 우회하지 않는다", () => {
  it("수집이 실제로 동작한다 (공허 GREEN 방지)", () => {
    expect(FILES.length).toBeGreaterThan(100);
    expect(FILES.filter((f) => f.code.includes("enforceAction(")).length).toBeGreaterThan(50);
  });

  it("targetEntityType/targetEntityId 에 as never/any/unknown 캐스트가 없다", () => {
    const offenders = FILES.filter((f) =>
      /(?:targetEntityType|targetEntityId)\s*:\s*[^,\n]*\bas\s+(?:never|any|unknown)\b/.test(f.code),
    ).map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  /**
   * `action` 축에도 같은 회피가 있다. 다만 `IrreversibleActionType` 확장은
   * **action 축 트랙**(별도 승인 범위)이라 지금 값을 추가하지 않는다.
   * 대신 **알려진 예외 1건만 허용**하고 그 외 신규 발생은 막는다 —
   * 사실을 숨기지 않으면서 확산은 차단한다. action 축 트랙이 끝나면 목록이 빈다.
   */
  it("action 캐스트는 알려진 1건 외에 늘어나지 않는다", () => {
    const KNOWN_ACTION_CAST = ["src/app/api/user/profile/route.ts"];
    const offenders = FILES.filter((f) =>
      /\baction\s*:\s*[^,\n]*\bas\s+(?:never|any|unknown)\b/.test(f.code),
    ).map((f) => f.path);
    expect(offenders).toEqual(KNOWN_ACTION_CAST);
  });
});

/**
 * A2 — 열거형 잠금.
 *
 * "쓰기 유무" 는 헬퍼 경유 쓰기까지 따라가야 정확해서 정적으로 완전 판정이 어렵다
 * (실측 시 직접 `db.*.create` 만 세면 31건이 오탐이었고, 헬퍼 해석 후 실제는 1건).
 * 그래서 **전수 규칙이 아니라 실측으로 확정된 읽기 전용 라우트 목록**을 잠근다.
 * 목록에 추가하려면 그 라우트가 읽기 전용임을 실측해야 한다.
 */
const READ_ONLY_MUST_FAIL = [
  "src/app/api/analytics/ai-insight/route.ts",
];

describe("§audit-foundation ① A2 — 읽기 전용 라우트는 complete() 로 닫지 않는다", () => {
  it.each(READ_ONLY_MUST_FAIL)("%s — complete() 부재", (rel) => {
    const f = FILES.find((x) => x.path === rel);
    expect(f, `${rel} 을 찾지 못함`).toBeDefined();
    expect(f!.code).not.toMatch(/enforcement\.complete\s*\(/);
    expect(f!.code).toMatch(/enforcement\.fail\s*\(/);
  });
});
