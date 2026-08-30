/**
 * §org-management-web P3 — 헤더 · KPI · 밑줄 탭 · 좌석 실한도 sentinel
 *
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

const ORG_DETAIL = "src/app/dashboard/organizations/[id]/page.tsx";
const PLANS = "src/lib/plans.ts";

/** 메인 TabsList 블록만 잘라낸다 — 파일 전역 단언 금지(무관 표면 오염 차단). */
function tabsListBlock(code: string): string {
  const m = code.match(/<TabsList[\s\S]*?<\/TabsList>/);
  return m?.[0] ?? "";
}

describe("좌석 게이지 — PLAN_LIMITS 가 canonical", () => {
  it("🛑 추정 공식이 남아 있지 않다 (옛 축: Math.max(totalMembers + 2, 10))", () => {
    /* 멤버가 늘면 분모도 같이 늘어 사용률이 영원히 100% 에 안 닿던 가짜 게이지였다. */
    expect(stripComments(read(ORG_DETAIL))).not.toMatch(/totalMembers \+ 2/);
  });

  it("분모는 PLAN_LIMITS[plan].maxMembers 다", () => {
    const code = stripComments(read(ORG_DETAIL));
    expect(code).toMatch(/PLAN_LIMITS\[[^\]]*plan[^\]]*\]\?\.maxMembers/);
    expect(code).toMatch(/from "@\/lib\/plans"/);
  });

  it("🛑 dead column 을 읽지 않는다 — Organization.maxMembers 는 생산자 0 · 소비자 0", () => {
    /* 살리면 PLAN_LIMITS 와 진실이 둘이 된다 (P0 C1 판정). */
    expect(stripComments(read(ORG_DETAIL))).not.toMatch(/organization[^\n]{0,30}\.maxMembers/);
  });

  it("PLAN_LIMITS 쪽에 maxMembers 가 실재한다 (핀 대상이 사라지면 RED)", () => {
    expect(stripComments(read(PLANS))).toMatch(/maxMembers:\s*(number \| null|\d+)/);
  });
});

describe("헤더 CTA — 주 1 + 보조 1", () => {
  it("🛑 '초대 관리' 버튼이 없다 (KPI 초대 대기 카드가 탭 직행으로 대체)", () => {
    /* ⚠️ 경계 한정 — /초대 관리/ 를 통짜로 금지하면 승인·초대 탭의 제목
     * "승인 및 초대 관리"(:1198)를 같이 잡는다. 지운 것은 **버튼 라벨**이므로
     * JSX 텍스트 노드로 홀로 선 형태만 금지한다. */
    expect(stripComments(read(ORG_DETAIL))).not.toMatch(/>\s*초대 관리\s*</);
  });

  it("🛑 '플랜/좌석 보기' 버튼이 없다 (KPI 4번째 카드가 흡수)", () => {
    expect(stripComments(read(ORG_DETAIL))).not.toMatch(/플랜\/좌석 보기/);
  });

  it("멤버 초대는 주 버튼(채움), 권한 검토는 보조(아웃라인)", () => {
    const code = stripComments(read(ORG_DETAIL));
    expect(code).toMatch(/className="bg-blue-600 hover:bg-blue-700 text-white font-medium"[\s\S]{0,200}?멤버 초대/);
    expect(code).toMatch(/variant="outline"[\s\S]{0,300}?onClick=\{\(\) => setRoleReviewOpen\(true\)\}[\s\S]{0,200}?권한 검토/);
  });

  it("🛑 이름 겹침 표면 생존 — 승인·초대 탭 제목은 그대로 살아 있다", () => {
    /* 지운 것("초대 관리" 버튼)과 이름이 겹치는 **살아 있는** 표면을 긍정으로 잠근다.
     * ⚠️ 이것은 프로브의 **경계 밖 대조군이 아니다**. 여기에 단언을 걸었으므로 이 표면은
     *    경계 **안**이다 — 검출력 프로브의 대조군은 아무 단언도 닿지 않는 지점이어야 한다.
     *    (로컬 세션 지적 2026-08-24 · 명명 정정) */
    expect(stripComments(read(ORG_DETAIL))).toMatch(/승인 및 초대 관리/);
  });

  it("헤더 메타에 생성일이 있다 — 주소는 스키마에 필드가 없어 넣지 않는다", () => {
    const code = stripComments(read(ORG_DETAIL));
    expect(code).toMatch(/생성일 \{new Date/);
  });
});

describe("KPI 4카드", () => {
  it("네 축이 모두 있다 — 멤버 · 초대 대기 · 승인 권한 · 플랜", () => {
    const code = stripComments(read(ORG_DETAIL));
    expect(code).toMatch(/">멤버<\/p>/);
    expect(code).toMatch(/">초대 대기<\/p>/);
    expect(code).toMatch(/">승인 권한<\/p>/);
    expect(code).toMatch(/\{planLabel\} 플랜/);
  });

  it("승인자 0 앰버 보더는 유지 · '지정 필요' pill 은 은퇴", () => {
    /* 🛑 은퇴 — **결정 교체** (§approver-axis (다) · 호영님 판정 2026-08-26).
     * 조직 범위에 승인자 지정 수단이 없다 — 승인 라우트는 TeamRole.ADMIN 을 보고
     * prod 실측 Team 0 · TeamMember 0 이라 그 게이트를 통과할 주체가 없다.
     * "지정하라" 는 실행 불가능한 지시였다. 범위는 좁게 — 지시형만 내리고 표시형은 남긴다. */
    const code = stripComments(read(ORG_DETAIL));
    /* 표시형 — 주의 톤은 사실 표기라 남긴다.
     * v2-1 (호영님 리뷰 2026-08-30): 조건은 approverCount===0 단독이 아니라
     * approverGap(= approvalPolicy !== "none" && approverCount === 0) — 처리 항목
     * 큐와 **같은 상태에서 파생**된다. approvalPolicy="none"(FREE·Basic)이면 승인
     * 단계 자체가 없어 앰버도 끈다. 단일 소스 정의는 approver-alarm 테스트가 소유. */
    expect(code).toMatch(/approverGap \? "border-yellow-300" : "border-slate-200"/);
    expect(code).not.toMatch(/approverCount === 0 \? "border-yellow-300"/);
    /* 역방향 잠금 — 지시형 pill 이 되살아나면 RED */
    expect(code).not.toMatch(/지정 필요/);
  });

  it("초대 대기 카드가 승인·초대 탭으로 간다 (삭제한 CTA 의 대체 경로)", () => {
    const code = stripComments(read(ORG_DETAIL));
    expect(code).toMatch(/onClick=\{\(\) => setActiveTab\("invites"\)\}[\s\S]{0,400}?초대 대기/);
  });

  it("플랜 카드에 게이지와 변경 링크가 있다", () => {
    const code = stripComments(read(ORG_DETAIL));
    expect(code).toMatch(/\/dashboard\/settings\/plans[\s\S]{0,120}?변경/);
    expect(code).toMatch(/width: `\$\{seatUsagePercent\}%`/);
  });
});

describe("탭 — 밑줄형 (C2 정본 2.5px #2563eb)", () => {
  it("메인 TabsList 안에서 밑줄 토큰을 쓴다", () => {
    /* ⚠️ 창 한정 — 파일 전역으로 border-b-[2.5px] 를 요구하면 무관한 표면을 잡는다.
     * 259c·4a 에서 두 번 겪은 형태다. TabsList 블록으로만 좁힌다. */
    const block = tabsListBlock(stripComments(read(ORG_DETAIL)));
    expect(block.length).toBeGreaterThan(0);
    expect(block).toMatch(/border-b-\[2\.5px\]/);
    expect(block).toMatch(/data-\[state=active\]:border-\[#2563eb\]/);
  });

  it("🛑 칩형 잔재가 TabsList 안에 없다", () => {
    const block = tabsListBlock(stripComments(read(ORG_DETAIL)));
    expect(block).not.toMatch(/bg-slate-100 p-1 rounded-lg/);
    expect(block).not.toMatch(/data-\[state=active\]:bg-white/);
  });

  it("🛑 이름 겹침 표면 생존 — 무관한 탭 그룹(초대 방식)은 그대로 살아 있다", () => {
    /* 창을 좁혔다는 것만으로는 '무관 표면을 안 잡는다' 가 증명되지 않아 생존을 긍정으로 잠근다.
     * ⚠️ 프로브의 경계 밖 대조군과 혼동 금지 — 단언이 닿는 순간 경계 안이다. */
    expect(stripComments(read(ORG_DETAIL))).toMatch(/<Tabs defaultValue="email"/);
  });
});
