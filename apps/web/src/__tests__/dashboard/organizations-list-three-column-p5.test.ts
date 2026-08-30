/**
 * §org-management-web P5 — 리스트 3열 sentinel
 * 계획서: docs/plans/PLAN_org-management-web.md
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}
const ORG_LIST = "src/app/dashboard/organizations/page.tsx";

describe("리스트 레이아웃 — 3열 · 고아 사이드바 제거", () => {
  it("조직 카드가 3열까지 간다", () => {
    expect(stripComments(read(ORG_LIST))).toMatch(/xl:grid-cols-3/);
  });

  it("🛑 우측 고정 컬럼이 없다 — 폭을 가리지 않는다", () => {
    /* 카드 1장 + 우측 고아 박스 + 나머지 빈 화면이 좌측 쏠림의 원인이었다.
     *
     * 승계 (§org-management-web P6 2026-08-25 · 호영님 실측 QA · 경계 확대):
     * 옛 단언은 `1fr_280px` 만 부정했다. 그런데 LoadingSkeleton 은 `1fr_300px` 였고,
     * 20px 차이로 이 단언을 통과했다. 로딩 중 우측에 300px 패널이 그려졌다가
     * 사라지는 것을 sentinel 이 침묵으로 넘겼다.
     * 🔑 부정 단언에 폭을 박은 것이 원인이다 — 결정은 "우측 고정 컬럼 없음" 이지
     *   "280px 아님" 이 아니다. 폭을 \d+ 로 열어 형제 슬롯까지 덮는다. */
    expect(stripComments(read(ORG_LIST))).not.toMatch(/lg:grid-cols-\[1fr_\d+px\]/);
  });

  it("로딩 스켈레톤이 본 레이아웃과 같은 그리드다", () => {
    /* §org-management-web P6 — 스켈레톤은 오지 않을 레이아웃을 약속하면 안 된다.
     * 두 곳이 **같은 문자열**을 쓴다는 것 자체가 결정이라, 출현 수로 잠근다.
     * 하나만 바뀌면 2 가 깨져 RED. */
    const src = stripComments(read(ORG_LIST));
    const GRID = /grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-stretch/g;
    expect(src.match(GRID)?.length).toBe(2);   // 로드 후(:535) + 스켈레톤
    // 스켈레톤 본문 안에 실제로 있는지 — 창을 함수로 한정한다.
    const body = src.slice(src.indexOf("function LoadingSkeleton"));
    expect(body).toMatch(/md:grid-cols-2 xl:grid-cols-3 gap-3 items-stretch/);
  });

  it("🛑 '바로 처리할 항목' 은 0건이면 렌더되지 않는다", () => {
    const code = stripComments(read(ORG_LIST));
    expect(code).toMatch(/orgsWithWarnings\.length > 0 &&[\s\S]{0,300}?바로 처리할 항목/);
    expect(code).not.toMatch(/orgsWithWarnings\.length === 0/);
  });

  it("'새 조직 만들기' placeholder 카드가 생성 다이얼로그를 연다", () => {
    const code = stripComments(read(ORG_LIST));
    expect(code).toMatch(/border-dashed[\s\S]{0,300}?새 조직 만들기/);
    expect(code).toMatch(/onClick=\{\(\) => setIsOpen\(true\)\}[\s\S]{0,400}?새 조직 만들기/);
  });
});

describe("요약 — 검색 행 1줄로 흡수", () => {
  it("검색 행 우측에 총 조직 · 멤버 · 초대 대기 1줄", () => {
    expect(stripComments(read(ORG_LIST))).toMatch(/총 <b[\s\S]{0,200}?초대 대기 <b/);
  });

  it("🛑 별도 요약 바가 없다", () => {
    expect(stripComments(read(ORG_LIST))).not.toMatch(/시안 요약 바/);
  });
});

describe("조직 카드", () => {
  it("통계 1줄 = 멤버 · 초대 대기", () => {
    expect(stripComments(read(ORG_LIST))).toMatch(/멤버 <b[\s\S]{0,300}?초대 대기 <b/);
  });

  it("✅ 승인자 수를 표기한다 — 3축 복원 (핸드오프 §1)", () => {
    /* 🔑 **결정 교체** (§approver-axis (나)-2 · 호영님 판정 2026-08-30).
     * 옛 결정: "승인자 수를 표기하지 않는다 — 없는 사실을 만들지 않는다."
     *   그 근거는 `adminCount 는 ADMIN||OWNER 축이라 APPROVER 와 다르다` 였다.
     * 교체 이유: **그 전제가 사라졌다.** 목록·상세·CTA·승인 라우트가 모두 A축 정본을
     *   쓰므로 이제 같은 것을 센다. 되살린 게 아니라 축이 서서 표기가 정직해진 것이다.
     * 🛑 옛 결정의 취지(다른 축의 수를 승인자로 위장하지 않는다)는 아래 역방향으로 승계. */
    const src = stripComments(read(ORG_LIST));
    expect(src).toMatch(/승인자 <b/);
    expect(src).toMatch(/\{org\.approverCount\}/);
    /* 역방향 — 다른 축(adminCount)을 승인자 자리에 다시 쓰면 RED */
    expect(src).not.toMatch(/adminCount/);
  });

  it("'관리 페이지 열기' 가 풀폭 버튼이다", () => {
    expect(stripComments(read(ORG_LIST))).toMatch(/flex flex-1 items-center justify-center[\s\S]{0,200}?관리 페이지 열기/);
  });
});
