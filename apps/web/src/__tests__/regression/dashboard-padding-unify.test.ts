/**
 * §dashboard-padding-unify (호영님 2026-07-04) — 이중 패딩 해소.
 * 셸 <main>의 uniform 패딩 제거(pb 유지) → 각 페이지 자체 패딩만(단일). 대시보드 꽉채움.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const R = join(__dirname, "..", "..");
const rd = (p: string) => readFileSync(join(R, p), "utf8");

describe("§dashboard-padding-unify — 셸 중복 패딩 제거", () => {
  it("셸 <main>에 uniform p-8 없음(pb 안전영역만 유지)", () => {
    const shell = rd("app/dashboard/_components/dashboard-shell.tsx");
    const main = shell.match(/flex-1 min-w-0 overflow-y-auto[^"]*/)?.[0] ?? "";
    expect(main).not.toMatch(/\bp-3 sm:p-4 md:p-8\b/);
    expect(main).toMatch(/pb-\[calc\(8rem/); // 모바일 하단 클리어런스 보존
  });
  it("대시보드 페이지 자체 패딩 보유(셸 제거 대응)", () => {
    expect(rd("app/dashboard/page.tsx")).toMatch(/p-3 pt-4 md:p-8 md:pt-7/);
  });
  it("위임형 work-queue 자체 패딩 wrap(엣지 방지)", () => {
    expect(rd("app/dashboard/work-queue/page.tsx")).toMatch(/<div className="p-4 md:p-8">\s*<WorkQueueConsole/);
  });
});

/**
 * §org-management-web P6 (호영님 2026-08-25 · "왼쪽이 여백이 없어") —
 * §dashboard-padding-unify 누락분 봉합.
 *
 * 위 §dashboard-padding-unify(2026-07-04)는 셸 <main>의 uniform 패딩을 걷어내고
 * "각 페이지가 자기 패딩을 갖는다"로 계약을 바꿨다. 그런데 그때 잠근 페이지는
 * dashboard/page.tsx 와 work-queue/page.tsx **둘뿐**이었다. 조직 상세는 그 이관에서
 * 패딩을 못 받았고, 아무 단언도 그 사실을 말하지 않아 7주간 침묵했다(07-04 → 08-25).
 * (§verification-loss-three-paths 3번 — 구조 이관인데 게이트 스코프가 좁았다.)
 *
 * 프로덕션 실측 2026-08-25 (viewport 1285, 사이드바 우측 끝 = 256):
 *   /dashboard/organizations       콘텐츠 left = 288  (pL 32px)  정상
 *   /dashboard/organizations/[id]  콘텐츠 left = 256  (pL 0px)   ← 사이드바에 딱 붙음
 *                                  right = 1285 = 뷰포트 끝     ← 우측도 0
 *
 * ⚠️ 이 단언이 잠그는 범위는 **조직 두 페이지뿐**이다. census(2026-08-25 ·
 *    dashboard 하위 page.tsx 패딩 토큰 grep)에서 0인 페이지가 이 둘 말고도 남아 있다 —
 *    activity-logs · analytics/monthly · collaboration · grants · inventory/history ·
 *    purchase-orders/[poId] · quotes/[quoteId] · settings/enterprise · settings/plans ·
 *    stock-risk · support · vendor/premium · vendor/quotes.
 *    grep 0 은 "패딩 없음"의 증거가 아니다(위임 컴포넌트가 들 수 있다). 실측 전까지
 *    미판정으로 남기며, 여기서 조용히 덮지 않는다. → 별도 카드로 census 실측.
 */
describe("§org-management-web P6 — 조직 두 페이지가 자기 패딩을 갖는다", () => {
  const ORG_LIST = "app/dashboard/organizations/page.tsx";
  const ORG_DETAIL = "app/dashboard/organizations/[id]/page.tsx";
  // 저장소 관례 래퍼. 조직 두 페이지가 **같은 문자열**을 쓴다는 것 자체가 결정이다.
  const WRAPPER = /<div className="mx-auto w-full max-w-7xl p-4 md:p-8 space-y-6">/;

  it("조직 상세 — 루트 div 가 패딩 래퍼를 갖는다 (좌우 여백 0 회귀 금지)", () => {
    const src = rd(ORG_DETAIL);
    expect(src).toMatch(WRAPPER);
    // 부정 단언: 패딩 없는 맨 space-y-6 루트로 되돌아가지 않는다.
    expect(src).not.toMatch(/return \(\n\s*<div className="space-y-6">/);
  });

  it("조직 리스트 — 같은 패딩 래퍼 (두 페이지 여백이 갈라지지 않는다)", () => {
    expect(rd(ORG_LIST)).toMatch(WRAPPER);
  });

  it("두 페이지의 래퍼 문자열이 정확히 일치한다", () => {
    const pick = (p: string) =>
      rd(p).match(/<div className="mx-auto w-full max-w-7xl [^"]*">/)?.[0] ?? null;
    const a = pick(ORG_LIST);
    const b = pick(ORG_DETAIL);
    expect(a).not.toBeNull();
    expect(a).toBe(b);
  });
});
