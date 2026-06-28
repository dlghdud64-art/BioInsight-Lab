/**
 * §org-role-review — 조직 상세 "권한 검토" 모달 (호영님 2026-06-27)
 *
 * 헤더 "권한 검토" 버튼 → 역할 매트릭스 + 실 멤버 권한 모달(정보성). 가짜 이름 0(teamMembers 실데이터).
 * 핸드오프(상단 액션) §3 정합. §5 활동로그 필터는 이미 완료라 본 배치 무관(회귀 가드는 기존 sentinel).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PAGE = readFileSync(
  join(__dirname, "..", "..", "app/dashboard/organizations/[id]/page.tsx"),
  "utf8",
);
const CODE = PAGE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("§org-role-review — 권한 검토 모달", () => {
  it("roleReviewOpen state + 헤더 버튼이 모달 open(탭 전환 아님)", () => {
    expect(CODE).toMatch(/const \[roleReviewOpen, setRoleReviewOpen\] = useState\(false\)/);
    expect(CODE).toMatch(/onClick=\{\(\) => setRoleReviewOpen\(true\)\}/);
  });
  it("Dialog open={roleReviewOpen} 렌더", () => {
    expect(CODE).toMatch(/<Dialog open=\{roleReviewOpen\} onOpenChange=\{setRoleReviewOpen\}>/);
  });
  it("멤버 권한 = 실 멤버 데이터(teamMembers.map, 가짜 이름 0)", () => {
    expect(CODE).toMatch(/멤버 권한/);
    expect(CODE).toMatch(/teamMembers\.map\(\(m\) =>/);
    expect(CODE).toMatch(/ROLE_LABELS\[m\.rawRole\]/);
  });
  it("역할별 권한 범위 매트릭스 5역할 누적 caps", () => {
    expect(CODE).toMatch(/role: "VIEWER", desc:[\s\S]{0,60}caps: \[1, 0, 0, 0, 0\]/);
    expect(CODE).toMatch(/role: "OWNER", desc:[\s\S]{0,60}caps: \[1, 1, 1, 1, 1\]/);
    expect(CODE).toMatch(/\["조회", "요청", "승인", "관리", "삭제"\]/);
  });
  it("편집 CTA = members 탭 실 네비(dead button 아님)", () => {
    expect(CODE).toMatch(/멤버 역할 편집/);
    expect(CODE).toMatch(/value="members"/);
  });
});

describe("§org-role-review — 회귀 가드(기존 보존)", () => {
  it("활동로그 행위자 필터(§5 기왕 완료) 보존", () => {
    expect(CODE).toMatch(/activityActorFilter/);
  });
  it("역할 정책 카드(설정 탭) 보존", () => {
    expect(PAGE).toMatch(/역할별 권한 범위를 정의합니다/);
  });
});
