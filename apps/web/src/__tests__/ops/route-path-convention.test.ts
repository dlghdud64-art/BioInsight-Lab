/**
 * §audit-foundation ① — `routePath` 표기 규약: `/api` 접두 필수
 *
 * 배경 (2026-08-10 실측): `routePath` 표기가 **88(`/api...`) : 81(`/...`)** 로 갈려 있었다.
 *
 * 왜 어휘보다 먼저 닫는가:
 *   `routePath` 는 `deriveConcurrencyKey` 의 구성요소다
 *   (`${action}:${routePath}:${scope}`). 어휘(`targetEntityType`)는 틀려도 오늘
 *   아무 일이 없지만(capabilities 무영향 + envelope 비영속), lock 키 네임스페이스가
 *   갈리는 것은 **같은 라우트에 핸들러가 하나 더 추가되는 순간 실해**가 된다.
 *
 * 규약을 `/api` 접두로 정한 근거 (다수파가 아니라 의미론):
 *   88:81 은 다수결을 쓰기엔 너무 반반이다. `routePath` 는 그 API 라우트의 경로이고
 *   실제 경로는 `/api/...` 다. 접두를 떼면 페이지 경로와 구분되지 않는다.
 *
 * 전환 무해성:
 *   lock 은 in-memory Map + TTL 5분이다. 배포 시점에 인스턴스와 함께 소멸하므로
 *   키 네임스페이스가 바뀌어도 **in-flight 상태가 이월되지 않는다.**
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const API_ROOT = join(WEB_ROOT, "src", "app", "api");

function routeFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) routeFiles(full, acc);
    else if (entry === "route.ts") acc.push(full);
  }
  return acc;
}

const SITES = routeFiles(API_ROOT).flatMap((f) => {
  const rel = f.slice(WEB_ROOT.length + 1).split("\\").join("/");
  const src = readFileSync(f, "utf8");
  return [...src.matchAll(/routePath:\s*(['"])([^'"]*)\1/g)].map((m) => ({
    file: rel,
    value: m[2],
  }));
});

describe("§audit-foundation ① — routePath 는 /api 접두로 통일한다", () => {
  it("수집이 실제로 동작한다 (공허 GREEN 방지)", () => {
    expect(SITES.length).toBeGreaterThan(150);
  });

  it("모든 routePath 가 /api 로 시작한다", () => {
    const offenders = SITES.filter((s) => !s.value.startsWith("/api/")).map(
      (s) => `${s.file} → ${s.value}`,
    );
    expect(offenders).toEqual([]);
  });

  it("접두가 중복되지 않는다 (/api/api 방지)", () => {
    const dup = SITES.filter((s) => s.value.startsWith("/api/api")).map(
      (s) => `${s.file} → ${s.value}`,
    );
    expect(dup).toEqual([]);
  });
});
