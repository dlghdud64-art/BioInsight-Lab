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

describe("§org-activity-actor-filter — 카테고리 칩 제거 → 행위자 필터", () => {
  it("항상-빈 카테고리 칩 줄 제거(유형별 필터 + 멤버/권한/설정 칩)", () => {
    expect(PAGE).not.toMatch(/\{\s*key: "team", label: "멤버"\s*\}/);
    expect(PAGE).not.toMatch(/\{\s*key: "permission", label: "권한"\s*\}/);
    expect(PAGE).not.toMatch(/setActivityTypeFilter/);
  });
  it("실제 행위자 자동 도출(가짜 이름 0) + 행위자 있을 때만 드롭다운", () => {
    expect(PAGE).toMatch(/const activityActors = \["전체", \.\.\.Array\.from\(new Set\(organizationLogs\.map\(\(l\) => l\.actor\)\)\)\]/);
    expect(PAGE).toMatch(/activityActors\.length > 1 &&/);
    expect(PAGE).toMatch(/value=\{activityActorFilter\} onValueChange=\{setActivityActorFilter\}/);
  });
  it("행위자 기준 필터링 + empty 메시지", () => {
    expect(PAGE).toMatch(/activityActorFilter === "전체"\s*\n?\s*\? organizationLogs\s*\n?\s*: organizationLogs\.filter\(\(log\) => log\.actor === activityActorFilter\)/);
    expect(PAGE).toMatch(/\$\{activityActorFilter\} 님의 활동 기록이 없습니다/);
  });
  it("로그 행 카테고리 태그(라벨)는 유지(getActivityCategory + style.label)", () => {
    expect(PAGE).toMatch(/const category = getActivityCategory\(log\.action\)/);
    expect(PAGE).toMatch(/\{style\.label\}/);
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
  it("활동 honest empty 보존(§org-management-redesign P3)", () => {
    expect(PAGE).toMatch(/활동 내역이 아직 없습니다/);
    expect(PAGE).toMatch(/const organizationLogs: Array<\{ id: string; actor: string; action: string; time: string; target\?: string \}> = \[\]/);
  });
  it("역할 정책 카드 컨텍스트 보존(역할별 권한 범위)", () => {
    expect(PAGE).toMatch(/역할별 권한 범위를 정의합니다/);
  });
});
