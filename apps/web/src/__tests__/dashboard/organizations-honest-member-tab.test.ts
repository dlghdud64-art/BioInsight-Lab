/**
 * §org-management-web P2 — 거짓 제거 sentinel
 *
 * 계획서: docs/plans/PLAN_org-management-web.md
 * 잠그는 것: **화면이 없는 사실을 말하지 않는다.**
 *   ① 가짜 실시간 신호 — lastActive 하드코딩("오늘") · "활동 중" 배지
 *   ② dead filter — "장기 미접속" 이 항상 0건 (추적 배선 부재)
 *   ③ DOM 해킹 탭 전환 — querySelector().click()
 *
 * P0 피의존 실측(2026-08-24) — 위 셋의 파일 밖 소비 0 · 테스트 핀 0.
 * ⚠️ 오탐 2건을 걸렀다. 다음 세션이 같은 grep 을 돌리면 또 나오니 여기 남긴다:
 *   1) lib/review-queue/ops-hub-adapters.ts:78·85 의 `lastActiveAt`
 *      — 이름만 비슷한 별개 어댑터(members 인자 · 7일 기준). 조직 상세와 무관.
 *   2) __tests__ 의 `querySelector` 10건 — quotes 키보드 내비 · admin 모달 · safety 등
 *      전부 무관 표면. organizations 관련 0건.
 *   → 이 둘은 조사 완료다. 다시 조사하지 않는다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const ORG_DETAIL = "src/app/dashboard/organizations/[id]/page.tsx";

describe("① 가짜 실시간 신호 0 — 없는 사실을 말하지 않는다", () => {
  it("🛑 lastActive 가 남아 있지 않다 (추적 배선 0 · 값은 '오늘' 하드코딩이었다)", () => {
    expect(stripComments(read(ORG_DETAIL))).not.toMatch(/lastActive/);
  });

  it("🛑 '마지막 활동' 열이 없다", () => {
    expect(stripComments(read(ORG_DETAIL))).not.toMatch(/마지막 활동/);
  });

  it("🛑 '활동 중' 배지가 없다 — 상태는 계정 파생만", () => {
    expect(stripComments(read(ORG_DETAIL))).not.toMatch(/활동 중/);
  });

  it("상태 배지는 활성 / 초대 대기 두 축뿐이다", () => {
    const code = stripComments(read(ORG_DETAIL));
    expect(code).toMatch(/border-emerald-200 text-emerald-700">활성</);
    expect(code).toMatch(/bg-yellow-50 text-yellow-700">초대 대기</);
  });
});

describe("② dead filter 0 — 항상 0건인 칩을 세지 않는다", () => {
  it("🛑 '장기 미접속' 이 없다", () => {
    expect(stripComments(read(ORG_DETAIL))).not.toMatch(/장기 미접속/);
  });

  it("🛑 inactive 분기가 없다 (옛 축: return false 하드코딩)", () => {
    expect(stripComments(read(ORG_DETAIL))).not.toMatch(/"inactive"/);
  });

  it("필터 칩은 전체 · 활성 · 초대 대기 3개다", () => {
    const code = stripComments(read(ORG_DETAIL));
    expect(code).toMatch(/\["all", "active", "pending"\] as const/);
  });
});

describe("③ 탭 전환은 controlled state — DOM 해킹 0", () => {
  it("🛑 querySelector 로 탭을 때리지 않는다", () => {
    /* 옛 축: document.querySelector('[data-state][value="invites"]').click()
     * DOM 을 때리면 React 가 모르는 전이가 생기고 딥링크·뒤로가기가 안 선다. */
    expect(stripComments(read(ORG_DETAIL))).not.toMatch(/querySelector/);
  });

  it("메인 탭 그룹이 value / onValueChange 를 받는다", () => {
    /* ⚠️ 경계 한정 — 부정 단언을 `<Tabs defaultValue=` 전역으로 걸면 이 파일의 무관한
     * 탭 그룹(:1647 초대 방식 email/link)을 같이 잡는다. 259c·4a 에서 두 번 겪은
     * 형태라 여기서는 **옛 값 그 자체**(defaultValue="overview")만 금지한다.
     * ⚠️ :1647 탭 그룹은 이 파일에서 아무 단언도 닿지 않는 지점이라 **프로브의 경계 밖
     *    대조군으로 쓸 수 있다.** 반대로 P3 의 '이름 겹침 표면 생존' 단언이 걸린 표면은
     *    경계 안이라 대조군이 될 수 없다 (로컬 세션 지적 2026-08-24). */
    const code = stripComments(read(ORG_DETAIL));
    expect(code).toMatch(/<Tabs value=\{activeTab\} onValueChange=\{setActiveTab\}/);
    expect(code).not.toMatch(/<Tabs defaultValue="overview"/);
  });

  it("탭 전환 진입점 2곳이 setActiveTab 을 쓴다 (초대 · 멤버)", () => {
    const code = stripComments(read(ORG_DETAIL));
    expect(code).toMatch(/setActiveTab\("invites"\)/);
    expect(code).toMatch(/setActiveTab\("members"\)/);
  });
});
