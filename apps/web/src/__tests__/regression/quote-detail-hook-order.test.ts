/**
 * §quote-detail-hook-order — early return 아래 훅 금지 sentinel (2026-08-18 프로덕션 실측 회귀)
 *
 * 실측: /quotes/[id] 진입 100% 크래시. React #310(Rendered more hooks than during the
 *       previous render). 로딩/에러 early return 4개 **아래**에 useMemo 가 1개 있어
 *       로딩 렌더와 데이터 렌더의 훅 수가 갈렸다.
 *
 * 잠그는 것: 이 파일의 컴포넌트 본문에서 early return 지점 이후 훅 호출 0.
 * 잠그지 못하는 것: 다른 페이지의 같은 형태 · 훅 순서 외의 렌더 오류 · 실브라우저 렌더.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const PAGE = "app/quotes/[id]/page.tsx";
const raw = readFileSync(join(ROOT, PAGE), "utf8");
// 주석·문자열이 단언을 대신 통과/차단시키는 자기함정 차단.
const code = raw
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/.*$/gm, "$1");

const lines = code.split(/\r?\n/);
// early return 경계: 로딩 분기(`if (status === "loading" || isLoading) {`) 등장 줄.
const guardIdx = lines.findIndex((l) => /if \(status === "loading" \|\| isLoading\)/.test(l));
const HOOK = /\b(useMemo|useEffect|useLayoutEffect|useCallback|useState|useReducer|useRef|useContext|useQuery|useMutation|useSession|useRouter|useSearchParams)\s*\(/;

describe("§quote-detail-hook-order — 조건부 훅 0", () => {
  it("경계(로딩 early return)를 찾는다 — 못 찾으면 이 sentinel 은 무효다", () => {
    expect(guardIdx).toBeGreaterThan(0);
  });

  it("🛑 early return 이후 훅 호출 0 (React #310 재발 차단)", () => {
    const offenders = lines
      .map((l, i) => ({ line: i + 1, text: l }))
      .filter(({ line, text }) => line > guardIdx + 1 && HOOK.test(text));
    expect(offenders.map((o) => `${o.line}: ${o.text.trim()}`)).toEqual([]);
  });

  it("cheapestVendor 는 훅이 아니라 즉시 실행 계산으로 남는다", () => {
    expect(code).toMatch(/const cheapestVendor = \(\(\) => \{/);
    expect(code).not.toMatch(/const cheapestVendor = useMemo/);
  });
});
