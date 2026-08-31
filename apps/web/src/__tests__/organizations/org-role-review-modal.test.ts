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
    /* 승계 (2026-08-24 · 표현 완화 · 결정 무손상):
     * 실물이 `ROLE_LABELS[m.rawRole || ""] ?? m.rawRole ?? "—"` 로 바뀌었다 —
     * undefined 키 방어 fallback 이 **더해진** 것이고 축(m.rawRole)도 결정도 그대로다.
     * fallback 유무를 허용하되 축은 그대로 핀한다. */
    expect(CODE).toMatch(/ROLE_LABELS\[m\.rawRole(\s*\|\|[^\]]*)?\]/);
    /* 역방향 잠금 — 실 멤버 축을 버리고 상수/가짜로 갈아타면 RED */
    expect(CODE).not.toMatch(/ROLE_LABELS\[\s*"(VIEWER|REQUESTER|APPROVER|ADMIN|OWNER)"\s*\]\s*\}\s*<\/(p|span)>/);
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
  it("🛑 활동로그 행위자 필터는 은퇴했다 (v2-3 · 활동 탭 자체가 내려갔다)", () => {
    /* 승계 교체 (§org-management-web v2-3 · 호영님 리뷰 2026-08-30): 이 가드가
     * 보존하던 행위자 필터는 "활동 및 감사" 탭 안에 살았고, 그 탭이 전역 통합
     * 로그(/dashboard/audit)와 중복인 빈 껍데기로 판정되어 탭째 은퇴했다.
     * 대체 경로(딥링크 ?org=)와 잔재 0 잠금은 org-activity-actor-role-matrix.test.ts
     * 가 소유한다 — 여기는 역방향 1줄만 둔다. */
    expect(CODE).not.toMatch(/activityActorFilter/);
  });
  it("역할 정책 카드(설정 탭) 보존", () => {
    expect(PAGE).toMatch(/역할별 권한 범위를 정의합니다/);
  });
});
