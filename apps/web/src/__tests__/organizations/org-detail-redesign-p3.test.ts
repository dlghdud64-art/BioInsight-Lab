/**
 * §org-management-redesign P3 — 상세 요약 바 + 활동 mock honesty(§11.318)
 *   (PLAN: docs/plans/PLAN_org-management-redesign.md Phase 3)
 *
 * ★ 핵심 게이트: 가짜 활동 데이터 제거(canonical 부재 → 정직 빈 상태, fake 0).
 * KPI 6박스 → 요약 한 줄 바(실 5지표). 5탭 라벨 시안 정합 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(
  resolve(__dirname, "../../app/dashboard/organizations/[id]/page.tsx"),
  "utf8",
);

describe("§org-management-redesign P3 — 활동 mock honesty(§11.318)", () => {
  it("가짜 활동 데이터(하드코딩 actor/action) 제거", () => {
    expect(PAGE).not.toMatch(/actor: "이매니저"/);
    expect(PAGE).not.toMatch(/DMEM 시약을 5병 입고/);
    expect(PAGE).not.toMatch(/박신입님이 조직 초대를 수락/);
  });
  it("organizationLogs = 빈 배열(정직)", () => {
    expect(PAGE).toMatch(/const organizationLogs:[\s\S]{0,120}=\s*\[\]/);
  });
  it("활동 없음 정직 표기(empty state) — 개요 최근 활동이 승계", () => {
    /* 승계 (v2-3 · 2026-08-30): 활동 탭 은퇴로 탭의 empty 문구("활동 내역이 아직
     * 없습니다")는 잠글 대상이 사라졌다. honesty 표기는 개요 최근 활동이 잇는다. */
    expect(PAGE).toMatch(/아직 기록된 활동이 없습니다/);
  });
});

describe("§org-management-redesign P3 — KPI 6박스 → 요약 한 줄 바 (P6 에서 은퇴)", () => {
  it("🛑 요약 바는 은퇴했다 — 되돌아오면 RED", () => {
    /* 은퇴 (§org-management-web P6 · 호영님 판정 2026-08-25 · 실측 QA):
     * 이 describe 가 잠그던 "요약 한 줄 바(실 5지표)" 를 제거했다.
     * 바로 아래 KPI 4카드가 같은 4축을 다 말하면서 행동까지 갖는데, 요약 바는
     * 그 부분집합을 행동 없이 12px 위에서 반복했다. 프로덕션 화면에서 같은 숫자
     * 네 개가 위아래로 두 번 찍혔다.
     *
     * 축 손실 0: "활성" 만 KPI 에 없는데 activeCount === totalMembers - pendingCount
     * 로 완전 파생이고(page.tsx:332-335) 멤버 탭 필터 칩에도 그대로 있다.
     *
     * 🔑 은퇴만 하면 새 결정이 무잠금이 된다(§verification-loss-three-paths 2번).
     *   후계 표면(KPI 4카드)의 4축 단언은 organizations-header-kpi-tabs-p3.test.ts
     *   :83-86 이 소유한다 — 여기서 다시 핀하면 같은 사실을 두 곳이 말하게 된다.
     *   이 자리에는 **역방향 잠금만** 둔다. */
    expect(PAGE).not.toMatch(/활성 <b/);
    expect(PAGE).not.toMatch(/좌석 \{seatUsagePercent\}%/);
    expect(PAGE).not.toMatch(/승인 권한 <b/);
    // 후계 표면이 실재하는지만 한 번 — 컨테이너 1개(앵커 계수 1).
    expect(PAGE).toMatch(/grid gap-4 grid-cols-2 lg:grid-cols-4/);
  });
  it("가짜 '최근 7일 활동' KPI(organizationLogs.length 카운트 박스) 제거 — 렌더 형태(주석 제외)", () => {
    expect(PAGE).not.toMatch(/최근 7일 활동<\/span>/);
    expect(PAGE).not.toMatch(/\{organizationLogs\.length\}<span/);
  });
});

describe("§org-management-redesign P3 — 회귀 0(4탭·멤버 wiring)", () => {
  it("4탭 라벨 정합 보존 — 활동 및 감사 은퇴(v2-3 · 2026-08-30)", () => {
    for (const label of ["멤버 및 접근", "승인 및 초대", "정책 및 설정"]) {
      expect(PAGE).toMatch(new RegExp(label));
    }
    /* 역방향 잠금 — 활동 탭이 되살아나면 RED. 대체 경로(감사 딥링크)는
     * org-activity-actor-role-matrix.test.ts 가 소유한다. */
    expect(PAGE).not.toMatch(/TabsTrigger value="activity"/);
  });
  it("멤버 목록 canonical fetch 보존", () => {
    expect(PAGE).toMatch(/\/api\/organizations\/\$\{params\.id\}\/members/);
  });
});
