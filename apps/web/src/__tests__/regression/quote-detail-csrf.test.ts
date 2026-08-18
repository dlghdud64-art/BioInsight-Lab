/**
 * §quote-detail-csrf-raw-fetch — 견적 상세의 mutation 은 csrfFetch (2026-08-18 프로덕션 실측 회귀)
 *
 * 실측: 구매 진행 처리 클릭 → PATCH /api/quotes/[id] 403
 *       "보안 검증이 완료되지 않아 작업을 진행할 수 없습니다"(CSRF missing_token).
 *       raw fetch 라 토큰이 안 붙었고, 견적을 COMPLETED 로 못 넘겨 발주 전환 전체가 정지.
 *       같은 파일에 csrfFetch 를 쓰는 mutation 이 이미 3곳 있었다 — 혼재가 원인.
 *
 * 잠그는 것: 이 파일의 raw fetch 호출에 method(=mutation)가 하나도 없다.
 * 잠그지 못하는 것: 다른 페이지의 같은 혼재 · 서버 CSRF 계약 자체 · 실브라우저 왕복.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const PAGE = "app/quotes/[id]/page.tsx";
const code = readFileSync(join(ROOT, PAGE), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/.*$/gm, "$1");

// raw fetch 호출 1건 = 여는 괄호부터 다음 `await ` 또는 파일 끝까지의 창(§sentinel 4원칙 — 여는 태그 기준 창).
const rawFetchWindows = [...code.matchAll(/(?<![a-zA-Z])fetch\(/g)].map((m) => {
  const start = m.index ?? 0;
  const next = code.indexOf("await ", start + 6);
  return code.slice(start, next === -1 ? Math.min(start + 400, code.length) : next);
});

describe("§quote-detail-csrf-raw-fetch — mutation 은 csrfFetch", () => {
  it("raw fetch 호출이 검출된다 — 0건이면 이 sentinel 은 무효다", () => {
    expect(rawFetchWindows.length).toBeGreaterThan(0);
  });

  it("🛑 raw fetch 에 method(POST/PATCH/PUT/DELETE) 0 — 조회만 남는다", () => {
    const offenders = rawFetchWindows.filter((w) =>
      /method:\s*"(POST|PATCH|PUT|DELETE)"/.test(w),
    );
    expect(offenders).toEqual([]);
  });

  it("상태 전이·품목 메모·벤더 회신 저장은 csrfFetch 로 나간다", () => {
    expect(code).toMatch(/csrfFetch\(`\/api\/quotes\/\$\{quoteId\}`, \{\s*method: "PATCH"/);
    expect(code).toMatch(/csrfFetch\(`\/api\/quote-items\/\$\{itemId\}`/);
    expect(code).toMatch(/csrfFetch\(`\/api\/quotes\/\$\{quoteId\}\/vendor-replies`/);
  });
});
