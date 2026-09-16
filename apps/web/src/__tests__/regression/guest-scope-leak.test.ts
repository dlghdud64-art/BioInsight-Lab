/**
 * §guest-scope-leak (2026-09-16 · 릴레이 지시 5) · **로그인 사용자의 지출·재고 조회 범위는 세션에서만 나온다.**
 *
 * ── 왜 ──
 * `lib/guest-key.ts` 의 `getGuestKey()` 가 환경 무관 고정값 `"guest-demo"` 를 돌려주고(사용자별 키
 * 생성 코드는 주석 처리된 채였다), 대시보드가 그 값을 `x-guest-key` 헤더로 보냈다. 서버는 그것을
 * scopeKey OR 조건에 그대로 넣었다 → **데모 시드 지출이 실사용자 집계에 합산**.
 *   prod 실측 2026-09-16(로컬 operator-shell → Supabase xhid… · SELECT only):
 *     6개월 창 12행 ₩44,634,000 중 **11행 ₩43,784,000 이 scopeKey='guest-demo'**, 본인 것은 1행 ₩850,000.
 *   `/api/reports/purchase` 는 더 나빴다 — 세션 없이도 응답했고 범위가 헤더 값(없으면 "guest-demo")이라
 *   헤더만 바꾸면 남의 scopeKey 를 읽을 수 있었다.
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① 지출·재고 집계 라우트는 요청 헤더로 조회 범위를 넓히지 않는다(`x-guest-key` 읽기 0).
 *   ② 그 라우트에 고정 데모 키 리터럴이 없다.
 *   ③ `/api/reports/purchase` 는 세션 없으면 401.
 *   ④ 로그인 화면·공용 훅은 고정 게스트 키를 만들지 않는다(`getGuestKey` 호출처를 집합으로 고정).
 * 🔑 경로(`/dashboard-guest`)를 막은 뒤에도 이 검사는 남긴다 — 되살아나는 것을 막는 게 목적이다.
 *
 * ── 이 파일이 안 보는 것 (자기 한계 · 다음 검사의 시작점) ──
 *   1. 런타임 값. 소스 형태만 본다 — 실제 응답 범위는 prod 질의로 따로 재야 한다.
 *   2. 목록 밖 라우트. 새 집계 라우트가 생기면 ROUTES 에 **추가해야** 걸린다(자동 확장 아님).
 *   3. 쓰기 축. `/api/purchases/import*` 는 여전히 헤더 값을 scopeKey 로 쓴다 —
 *      경로 차단(진입 화면 제거)이 그 축의 처방이고, 이 검사는 읽기 축만 닫는다.
 *   4. 서버 쿠키 기반 게스트 키(`lib/api/guest-key.ts` `getOrCreateGuestKey`)는 브라우저별 난수라
 *      공유 범위가 아니다 — 대상 아님(QuoteList 축).
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");
const code = (rel: string) => stripComments(read(rel));

/** src 하위 디렉터리들을 훑어 .ts/.tsx 상대 경로(슬래시 정규화)를 모은다 */
function walk(dirs: string[]): string[] {
  const out: string[] = [];
  const visit = (abs: string) => {
    for (const name of readdirSync(abs)) {
      if (name === "__tests__" || name === "node_modules") continue;
      const p = join(abs, name);
      if (statSync(p).isDirectory()) visit(p);
      else if (/\.(ts|tsx)$/.test(name)) out.push(relative(SRC, p).split("\\").join("/"));
    }
  };
  for (const d of dirs) visit(join(SRC, d));
  return out;
}

/** 로그인 사용자의 지출·재고 집계를 내려주는 라우트 = 이 검사의 표면 */
const ROUTES = [
  "app/api/dashboard/stats/route.ts",
  "app/api/dashboard/summary/route.ts",
  "app/api/purchases/route.ts",
  "app/api/purchases/summary/route.ts",
  "app/api/reports/purchase/route.ts",
];

describe("§guest-scope-leak · 조회 범위는 세션에서만 나온다", () => {
  it("① 집계 라우트가 x-guest-key 를 읽지 않는다", () => {
    const offenders = ROUTES.filter((r) => /x-guest-key/i.test(code(r)));
    expect(offenders).toEqual([]);
  });

  it("② 집계 라우트에 고정 데모 키 리터럴이 없다", () => {
    const offenders = ROUTES.filter((r) => /guest-demo/.test(code(r)));
    expect(offenders).toEqual([]);
  });

  it("③ 집계 라우트의 scopeKey 목록은 세션·멤버십에서만 만들어진다", () => {
    for (const r of ROUTES) {
      const src = code(r);
      // scopeKey 후보 배열에 headers.get(...) 이 섞이면 범위가 요청자에게 넘어간다
      expect(
        /scopeKey[\s\S]{0,200}?headers\s*\.\s*get/.test(src),
        `${r} · scopeKey 구성에 요청 헤더가 섞였다`,
      ).toBe(false);
    }
  });

  it("④ /api/reports/purchase 는 세션 없으면 401", () => {
    const src = code("app/api/reports/purchase/route.ts");
    expect(src).toMatch(/const session = await auth\(\)/);
    expect(src).toMatch(/if \(!session\?\.user\?\.id\)[\s\S]{0,160}?status: 401/);
  });

  it("⑤ 고정 게스트 키를 쓰는 파일 집합이 고정돼 있다 (로그인 화면·공용 훅 0)", () => {
    // 개수가 아니라 **구성**을 핀한다 — 하나 빠지고 하나 늘어도 통과하지 않는다.
    const ALLOWED = [
      // 게스트 데모 화면 2종 — 진입 경로 차단 판정 대기(2026-09-16 릴레이 지시 2).
      //   차단·삭제하는 커밋에서 이 두 줄도 함께 지운다.
      "app/dashboard-guest/page.tsx",
      "app/dashboard-guest/purchases/page.tsx",
      // 워크벤치 견적 요청 패널 — 대상은 /api/quote-lists 이고, 그 라우트는 서버 쿠키
      //   게스트 키(브라우저별 난수)로 판정한다. 지출·재고 축이 아니다.
      "app/_workbench/_components/quote-panel.tsx",
      // CSV 업로드 탭 — importer 0(렌더되는 화면 없음). 지출 축이라 살아나면 위험하다.
      "components/purchases/csv-upload-tab.tsx",
    ].sort();
    const callers = walk(["app", "components", "hooks", "lib"])
      .filter((rel) => rel !== "lib/guest-key.ts" && /getGuestKey\s*\(/.test(code(rel)))
      .sort();
    expect(callers).toEqual(ALLOWED);
  });

  it("⑥ 대시보드 클라이언트가 x-guest-key 헤더를 보내지 않는다", () => {
    for (const rel of ["app/dashboard/page.tsx", "hooks/use-dashboard-section.ts"]) {
      expect(/x-guest-key/i.test(code(rel)), `${rel}`).toBe(false);
    }
  });
});
