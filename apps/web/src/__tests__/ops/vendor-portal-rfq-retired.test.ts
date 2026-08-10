/**
 * §route-duplication — 벤더 포털 RFQ 경로 폐기, 토큰 경로가 canonical
 *
 * 배경 (2026-08-10, 호영님 결정):
 *   같은 도메인 행위(벤더 견적 회신)에 경로가 둘이었다.
 *     · 토큰 경로 `/api/vendor-requests/[token]/response` — **정상 구현**
 *       (quoteVendorResponseItem.upsert + quoteVendorRequest.update, 트랜잭션)
 *     · 로그인 포털 경로 `/api/vendor/requests/*` — **하드코딩 mock**.
 *       인증도 DB 조회도 없이 실재하지 않는 견적 요청과 조직명("서울대학교
 *       생명과학연구소" 등)을 아무 방문자에게나 렌더했다. 제품이 거래 상대를
 *       지어내고 있는 상태였다.
 *
 *   결정: 포털 RFQ 경로 폐기. 501 로 남기지 않는다 — 라우트가 남으면 다음 사람이
 *   "구현하면 되겠네" 로 읽는다. 미생성이 원칙이다.
 *
 * 계약:
 *   R1. 폐기된 라우트/화면이 재생성되지 않는다.
 *   R2. 조작 데이터 리터럴이 소스에 없다 (실측한 문자열로 고정).
 *   R3. 진입 경로(내비·링크)가 남아 있지 않다.
 *   R4. canonical 인 토큰 경로는 무손상.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const abs = (rel: string) => join(WEB_ROOT, rel);
const read = (rel: string) => readFileSync(abs(rel), "utf8");

/** 주석 제거 — 폐기 사유를 적은 주석이 부정 단언에 걸리지 않도록 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** src 전체(주석 제거본)를 훑어 문자열 포함 파일을 찾는다 (테스트 자신은 제외) */
function filesContaining(needle: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === "node_modules" || entry === ".next") continue;
        walk(full);
      } else if (/\.(ts|tsx)$/.test(entry)) {
        if (full.endsWith(`ops${sep}vendor-portal-rfq-retired.test.ts`)) continue;
        if (stripComments(readFileSync(full, "utf8")).includes(needle)) out.push(full);
      }
    }
  };
  walk(join(WEB_ROOT, "src"));
  return out;
}

const RETIRED_PATHS = [
  "src/app/api/vendor/requests/route.ts",
  "src/app/api/vendor/requests/[id]/route.ts",
  "src/app/api/vendor/requests/[id]/respond/route.ts",
  "src/app/api/vendor/stats/route.ts",
  "src/app/vendor/requests/[id]/page.tsx",
  "src/components/vendor/quote-form.tsx",
];

/** 실측한 조작 데이터 리터럴 — 폐기 전 mock 라우트에 실재하던 문자열 */
const FABRICATED_LITERALS = [
  "Cell Culture 시약 견적",
  "서울대학교 생명과학연구소",
  "KAIST 바이오연구소",
  "연세대학교 의생명연구소",
];

describe("§route-duplication R1 — 폐기된 포털 RFQ 경로가 재생성되지 않는다", () => {
  it.each(RETIRED_PATHS)("%s 이 존재하지 않는다", (rel) => {
    expect(existsSync(abs(rel))).toBe(false);
  });
});

describe("§route-duplication R2 — 조작 데이터 리터럴이 소스에 없다", () => {
  it.each(FABRICATED_LITERALS)("%s 문자열을 쓰는 파일이 없다", (lit) => {
    expect(filesContaining(lit)).toEqual([]);
  });
});

describe("§route-duplication R3 — 진입 경로가 남아 있지 않다", () => {
  it("사이드바에 Quote Requests 항목이 없다", () => {
    const src = read("src/app/vendor/_components/vendor-sidebar.tsx");
    expect(src).not.toMatch(/\/vendor\/requests/);
  });

  it("포털 RFQ API 를 호출하는 코드가 없다", () => {
    expect(filesContaining("/api/vendor/requests")).toEqual([]);
    expect(filesContaining("/api/vendor/stats")).toEqual([]);
  });

  it("벤더 진입 화면은 목록을 만들지 않고 토큰 경로를 안내한다", () => {
    const src = read("src/app/vendor/page.tsx");
    expect(src).not.toMatch(/useQuery|<Table/);
    expect(src).toMatch(/요청 메일/);
  });
});

describe("§route-duplication R4 — canonical 토큰 경로 무손상", () => {
  it("토큰 회신 라우트는 실제 쓰기를 유지한다", () => {
    const src = read("src/app/api/vendor-requests/[token]/response/route.ts");
    expect(src).toMatch(/quoteVendorResponseItem\.upsert/);
    expect(src).toMatch(/quoteVendorRequest\.update/);
  });

  it("토큰 회신 화면이 살아 있다", () => {
    expect(existsSync(abs("src/app/vendor/[token]/page.tsx"))).toBe(true);
  });
});
