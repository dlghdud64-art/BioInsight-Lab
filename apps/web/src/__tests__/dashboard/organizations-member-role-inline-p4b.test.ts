/**
 * §org-management-web P4b — 멤버 탭 인라인 액션 sentinel
 *
 * 착수 전 실측이 범위를 줄였다 — 역할 인라인 드롭다운(shadcn Select)은 **이미 있었다**.
 * 남아 있던 것만 채웠다: 역할 색 점 · 저장됨 표시 · 본인 캡션 · 초대 행 인라인 · 딥링크 강조.
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

describe("역할 인라인 드롭다운", () => {
  it("shadcn Select 가 역할 변경 mutation 에 직결된다 (native select 0)", () => {
    const code = stripComments(read(ORG_DETAIL));
    expect(code).toMatch(/onValueChange=\{\(v\) => updateRoleMutation\.mutate\(\{ memberId: rawMember\.id, role: v \}\)\}/);
    expect(code).not.toMatch(/<select[\s>]/);
  });

  it("역할 색 점 — 트리거와 옵션이 같은 map 을 쓴다", () => {
    const code = stripComments(read(ORG_DETAIL));
    expect(code).toMatch(/const ROLE_DOT: Record<string, string>/);
    expect(code).toMatch(/ROLE_DOT\[rawMember\.role\]/);
    expect(code).toMatch(/ROLE_DOT\[r\]/);
  });

  it("변경 후 그 행에 '✓ 저장됨' 이 뜬다 (1.5초)", () => {
    /* toast 만으로는 어느 행이 저장됐는지 안 보인다. */
    const code = stripComments(read(ORG_DETAIL));
    expect(code).toMatch(/setSavedMemberId\(variables\.memberId\)/);
    expect(code).toMatch(/setTimeout\([\s\S]{0,140}?1500\)/);
    expect(code).toMatch(/savedMemberId === rawMember\.id &&[\s\S]{0,200}?저장됨/);
  });

  it("🛑 본인 관리자 행은 편집 불가 + 캡션을 단다", () => {
    const code = stripComments(read(ORG_DETAIL));
    expect(code).toMatch(/canEditRole = isAdmin && !isSelfAdmin/);
    expect(code).toMatch(/isSelfAdmin &&[\s\S]{0,200}?본인 역할 변경 불가/);
  });
});

describe("초대 대기 행 — ⋮ 안에 숨기지 않는다", () => {
  it("재발송 · 취소가 인라인 버튼이다", () => {
    const code = stripComments(read(ORG_DETAIL));
    expect(code).toMatch(/isPending \?[\s\S]{0,900}?onClick=\{\(\) => resendInviteMutation\.mutate\(rawMember\.id\)\}[\s\S]{0,300}?초대 재발송/);
    expect(code).toMatch(/초대를 취소하시겠습니까[\s\S]{0,300}?초대 취소/);
  });

  it("🛑 ActionMenu 에 초대 항목이 남아 있지 않다 (멤버 제거 전용)", () => {
    const code = stripComments(read(ORG_DETAIL));
    expect(code).not.toMatch(/items=\{isPending \?/);
    expect(code).toMatch(/items=\{\[[\s\S]{0,200}?멤버 제거/);
  });
});

describe("승인자 지정 딥링크", () => {
  it("멤버 탭으로 가면서 역할 열을 강조한다", () => {
    /* 🛑 핸드오프 §5 는 "역할 드롭다운 오픈 상태" 였으나 열 수 없다 —
     * 승인자 0명 상황에서 누구를 승인자로 만들지는 사용자가 정하므로 열 드롭다운이
     * 하나로 정해지지 않는다. 강조로 어디를 볼지만 말한다 (실측이 문서를 정정 3건째). */
    const code = stripComments(read(ORG_DETAIL));
    expect(code).toMatch(/setActiveTab\("members"\); setRoleColumnHint\(true\);/);
    expect(code).toMatch(/roleColumnHint \? "bg-yellow-50\/60" : ""/);
  });
});
