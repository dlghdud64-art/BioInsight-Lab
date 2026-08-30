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
    /* 🛑 은퇴 — **결정 교체** (§approver-axis (다) · 호영님 판정 2026-08-26).
     * 조직 범위에 승인자 지정 수단이 없다 — 승인 라우트는 TeamRole.ADMIN 을 보고
     * prod 실측 Team 0 · TeamMember 0 이라 그 게이트를 통과할 주체가 없다.
     * "지정하라" 는 실행 불가능한 지시였다. 범위는 좁게 — 지시형만 내리고 표시형은 남긴다. */
    /* roleColumnHint 의 유일한 setter 가 그 CTA 였다 — (다)가 CTA 를 지우자 항상 false 인
     * 분기가 됐다. **이 슬라이스가 만든 잔해**라 같은 슬라이스에서 정리했다. */
    expect(code).not.toMatch(/roleColumnHint/);
    expect(code).not.toMatch(/setRoleColumnHint/);
    /* 🔑 강조만 사라지고 **역할 열 자체는 남아 있다** — 열까지 사라진 것과 갈린다 */
    expect(code).toMatch(/onValueChange=\{\(v\) => updateRoleMutation\.mutate/);
    expect(code).toMatch(/ROLE_DOT\[rawMember\.role\]/);
  });
});

describe("§org-management-web P6 — 캡션이 없는 것을 가리키지 않는다", () => {
  /* 호영님 실측 QA 2026-08-25. 멤버가 본인뿐인 조직에서 관리 컬럼은 "-" 인데
   * 캡션은 "관리 컬럼의 메뉴에서 초대 재발송, 멤버 제거 등 운영 액션을 처리하세요"
   * 라고 안내했다. 없는 메뉴를 가리키는 문장은 dead button 과 같은 종류의 거짓이다.
   * 화면을 보지 않으면 안 나온다 — 소스만 읽으면 문장은 멀쩡해 보인다. */
  it("관리 컬럼 안내는 자기 외 행이 있을 때만 렌더된다", () => {
    const code = stripComments(read(ORG_DETAIL));
    expect(code).toMatch(/\{totalMembers > 1 && " 관리 컬럼의 메뉴에서/);
  });

  it("🛑 무조건 렌더로 되돌아가지 않는다", () => {
    /* 역방향 잠금 — 조건을 떼면 RED.
     * 앞 문장(역할 즉시 저장)은 항상 참이라 조건 밖에 남는다. 그 문장까지 조건에
     * 넣으면 캡션 전체가 사라지므로, 두 문장이 갈라져 있다는 것 자체를 핀한다. */
    const code = stripComments(read(ORG_DETAIL));
    expect(code).toMatch(/멤버별 역할을 선택하면 즉시 저장됩니다\.\s*\n\s*\{totalMembers > 1 &&/);
    expect(code).not.toMatch(/즉시 저장됩니다\. 관리 컬럼의 메뉴에서/);
  });
});
