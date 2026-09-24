/**
 * §raw-fetch-mutation · 변이 요청은 csrfFetch 로만 보낸다 (호영님 승인 2026-09-24)
 *
 * 실측 결함 (prod):
 *   예산 삭제 버튼 · raw fetch DELETE → CSRF 403. 게이트·빌드·원장을 전부 통과했다.
 *   같은 판별기로 저장소를 훑자 알림 읽음 처리(Header.tsx 2곳)도 prod 403 이었다.
 *
 * 이 계약이 무는 것:
 *   ① 판별기가 raw fetch 변이를 잡고, csrfFetch · GET · exempt 경로 · 주석은 놓아 준다.
 *   ② 저장소 전체(서버 라우트 · 테스트 제외)에서 raw fetch 변이 0건. 레거시가 0이라 전량으로 잠근다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { rawFetchMutations } from "../_helpers/raw-fetch-scan";

describe("§raw-fetch-mutation · 판별기 계약", () => {
  it("① raw fetch POST 리터럴 경로를 잡는다", () => {
    const h = rawFetchMutations(`const r = await fetch("/api/budgets", { method: "POST" });`);
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ line: 1, method: "POST", path: "/api/budgets" });
  });

  it("② 템플릿 경로 DELETE · method 가 다음 줄에 있어도 잡는다", () => {
    const src = [
      "async function del(id: string) {",
      "  const res = await fetch(`/api/budgets/${id}`, {",
      '    method: "DELETE",',
      "  });",
      "}",
    ].join("\n");
    const h = rawFetchMutations(src);
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ line: 2, endLine: 4, method: "DELETE", path: "/api/budgets/x" });
  });

  it("③ csrfFetch 는 대상이 아니다", () => {
    expect(rawFetchMutations("await csrfFetch(`/api/budgets/${id}`, { method: \"DELETE\" });")).toEqual([]);
  });

  it("④ 조회(GET · method 생략)는 대상이 아니다", () => {
    expect(rawFetchMutations(`await fetch("/api/budgets"); await fetch("/api/budgets", { method: "GET" });`)).toEqual([]);
  });

  it("⑤ CSRF registry 의 exempt 경로는 대상이 아니다 (공개 토큰 페이지)", () => {
    expect(rawFetchMutations("await fetch(`/api/vendor-requests/${token}/response`, { method: \"POST\" });")).toEqual([]);
    expect(rawFetchMutations(`await fetch("/api/pricing-assistant", { method: "POST" });`)).toEqual([]);
  });

  it("⑥ 주석 안의 fetch 는 대상이 아니다", () => {
    expect(rawFetchMutations(`// await fetch("/api/budgets", { method: "POST" });`)).toEqual([]);
  });

  it("⑦ 외부 URL · 변수 URL 은 대상이 아니다 (미들웨어를 지나지 않거나 판별 불가)", () => {
    expect(rawFetchMutations(`await fetch("https://api.example.com/x", { method: "POST" });`)).toEqual([]);
    expect(rawFetchMutations(`await fetch(URL, { method: "POST" });`)).toEqual([]);
  });

  it("⑧ 문자열 안의 괄호가 호출 범위를 깨지 않는다", () => {
    const src = `await fetch("/api/budgets", { body: JSON.stringify({ q: "(" }), method: "PATCH" });`;
    expect(rawFetchMutations(src)).toHaveLength(1);
  });
});

const SRC = join(__dirname, "..", "..");
const EXCLUDE = /[\\/]app[\\/]api[\\/]|[\\/]__tests__[\\/]|\.(test|spec)\.tsx?$/;

function walk(dir: string, out: string[]): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) {
      if (n === "node_modules" || n === "generated") continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(n) && !EXCLUDE.test(p)) {
      out.push(p);
    }
  }
  return out;
}

describe("§raw-fetch-mutation · 저장소 전량", () => {
  it("⑨ 브라우저 코드의 raw fetch 변이 0건 · 알림 읽음 처리 포함", () => {
    const found: string[] = [];
    for (const f of walk(SRC, [])) {
      const src = readFileSync(f, "utf8");
      if (!src.includes("fetch")) continue;
      for (const h of rawFetchMutations(src)) {
        found.push(`${relative(SRC, f)}:${h.line} ${h.method} ${h.path}`);
      }
    }
    expect(found).toEqual([]);
  }, 60_000);

  it("⑩ Header.tsx 알림 읽음은 csrfFetch 로 보내고 실패를 알린다", () => {
    const src = readFileSync(join(SRC, "components", "dashboard", "Header.tsx"), "utf8");
    expect(src).toMatch(/csrfFetch\(`\/api\/notifications\/\$\{id\}\/read`/);
    expect(src).toMatch(/csrfFetch\(`\/api\/notifications\/\$\{n\.id\}\/read`/);
    expect(src).toMatch(/onError:\s*\(\)\s*=>\s*\{\s*toast\.error\(/);
    expect(src).toMatch(/results\.filter\(\(r\)\s*=>\s*!r\.ok\)/);
  });
});
