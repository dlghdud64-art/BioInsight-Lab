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

  it("🛑 우측 280px 고정 컬럼이 없다", () => {
    /* 카드 1장 + 우측 고아 박스 + 나머지 빈 화면이 좌측 쏠림의 원인이었다. */
    expect(stripComments(read(ORG_LIST))).not.toMatch(/lg:grid-cols-\[1fr_280px\]/);
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

  it("🛑 승인자 수를 표기하지 않는다 — OrgRow 에 approverCount 가 없다", () => {
    /* 핸드오프 §1 은 3축(멤버·초대 대기·승인자)을 요구하지만 목록 응답에 승인자가 없다.
     * adminCount 는 ADMIN||OWNER 축이라 APPROVER 와 다르다. 없는 사실을 만들지 않는다.
     * 🔑 이 단언은 "아직 못 넣었다" 를 기록한다 — API 확장 슬라이스가 이걸 바꾼다. */
    expect(stripComments(read(ORG_LIST))).not.toMatch(/approverCount/);
  });

  it("'관리 페이지 열기' 가 풀폭 버튼이다", () => {
    expect(stripComments(read(ORG_LIST))).toMatch(/flex flex-1 items-center justify-center[\s\S]{0,200}?관리 페이지 열기/);
  });
});
