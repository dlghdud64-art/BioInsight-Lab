/**
 * §org-activity-actor-filter + §org-role-matrix — 조직 관리 활동로그 필터 정직화 + 역할 매트릭스
 *   (호영님 2026-06-27 패치 "상단 액션 + 활동로그 필터" 중 scope A:
 *    상단 액션 4종은 이미 wired(모달 중복 회피) → 실효 part만 채택.)
 *
 * 1. 활동로그: 카테고리 칩(멤버·권한·설정 = 항상 빈 결과 = 가짜 필터) 제거 → 실제 행위자 드롭다운
 *    (가짜 이름 0, 로그 0건이면 미노출). 로그 행 카테고리 태그는 라벨로 유지.
 * 2. 역할 정책 리스트 → capability 매트릭스(조회/요청/승인/관리/삭제 누적). 기존 카드 강화(신규 surface 0).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(
  resolve(__dirname, "../../app/dashboard/organizations/[id]/page.tsx"),
  "utf8",
);

describe("§org-activity-actor-filter — 은퇴 (활동 탭 자체가 v2-3 에서 내려갔다)", () => {
  /* 🛑 재조준 — 결정 교체 (§org-management-web v2-3 · 호영님 리뷰 2026-08-30).
   * 이 describe 가 잠그던 행위자 필터는 "활동 및 감사" 탭 안에 살았다. 그 탭은
   * 사이드바 전역 통합 로그(/dashboard/audit)와 중복인 빈 껍데기(organizationLogs
   * 항상 [])로 판정되어 탭째 은퇴했다 — 필터도 잠글 대상이 사라졌다.
   * 대체 경로: 개요 최근 활동 요약 + 전체 활동 로그 딥링크(?org= 조직 필터). */
  it("🛑 활동 탭·행위자 필터 잔재 0 — 되살아나면 RED", () => {
    expect(PAGE).not.toMatch(/TabsTrigger value="activity"/);
    expect(PAGE).not.toMatch(/<TabsContent value="activity">/);
    expect(PAGE).not.toMatch(/setActivityActorFilter/);
    expect(PAGE).not.toMatch(/ACTIVITY_CATEGORY_STYLES/);
    expect(PAGE).not.toMatch(/getActivityImportance/);
  });
  it("대체 경로 실재 — 개요 → 전역 통합 로그 딥링크(조직 필터)", () => {
    expect(PAGE).toMatch(/\/dashboard\/audit\?org=\$\{params\.id\}/);
    /* 수신측: 통합 로그가 ?org= 를 실제로 읽어 두 fetch 를 좁힌다 (숨은 딥링크 금지) */
    const AUDIT = readFileSync(
      resolve(__dirname, "../../app/dashboard/audit/page.tsx"),
      "utf8",
    );
    expect(AUDIT).toMatch(/const orgParam = searchParams\.get\("org"\)/);
    expect(AUDIT).toMatch(/if \(orgParam\) params\.set\("organizationId", orgParam\)/);
    expect(AUDIT).toMatch(/if \(orgParam\) params\.append\("organizationId", orgParam\)/);
    /* 화면에 보이는 필터 칩 — 숨은 필터는 헤더 계수 불일치를 만든다 */
    expect(AUDIT).toMatch(/조직 필터 적용됨/);
  });
});

describe("§org-role-matrix — 역할 정책 → capability 매트릭스", () => {
  it("5 capability 컬럼(조회/요청/승인/관리/삭제) + 누적 안내", () => {
    expect(PAGE).toMatch(/\["조회", "요청", "승인", "관리", "삭제"\]/);
    expect(PAGE).toMatch(/아래로 갈수록 권한이 누적됩니다/);
  });
  it("5역할 caps 누적 배열(VIEWER~OWNER)", () => {
    expect(PAGE).toMatch(/role: "VIEWER", desc: "[^"]+", caps: \[1, 0, 0, 0, 0\]/);
    expect(PAGE).toMatch(/role: "APPROVER", desc: "[^"]+", caps: \[1, 1, 1, 0, 0\]/);
    expect(PAGE).toMatch(/role: "OWNER", desc: "[^"]+", caps: \[1, 1, 1, 1, 1\]/);
  });
  it("허용 dot = emerald, 미허용 = slate(색 인코딩)", () => {
    expect(PAGE).toMatch(/on \? "bg-emerald-500" : "bg-slate-100"/);
  });
});

describe("§org — 회귀 0(honesty 보존)", () => {
  it("활동 honest empty 보존(§org-management-redesign P3 → v2-3 개요 승계)", () => {
    expect(PAGE).toMatch(/아직 기록된 활동이 없습니다/);
    expect(PAGE).toMatch(/const organizationLogs: Array<\{ id: string; actor: string; action: string; time: string; target\?: string \}> = \[\]/);
  });
  it("역할 정책 카드 컨텍스트 보존(역할별 권한 범위)", () => {
    expect(PAGE).toMatch(/역할별 권한 범위를 정의합니다/);
  });
});
