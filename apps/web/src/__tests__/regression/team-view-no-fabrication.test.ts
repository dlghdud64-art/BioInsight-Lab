/**
 * §team-view-no-fabrication (2026-09-22 · 호영님 판정) · **「팀별 보기」 는 없는 팀 지출을 그리지 않는다.**
 *
 * ── 왜 ──
 * 탭 전체가 `TEAM_DATA`(주석 「더미 데이터」) — 팀 7개의 예산·지출·전월 대비 변동(+30.8% · -15.8% …)·
 * 주요 공급사(Sigma-Aldrich · Abcam …)·상태 — 를 **표기 없이** 렌더했다. 탭 이름이 실데이터를 약속하므로
 * 예시 표기로 존치하는 선택지는 없다(analytics 예시 리포트 모달과 다르다 · 호영님).
 * 1차 mock 전수(이름 축)가 이걸 놓쳐 전수 자체가 무효 처리됐다(2026-09-21).
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① 가짜 팀 데이터가 돌아오지 않는다(역계약 · 주석 제거본) — 팀명 7 · 공급사명 · 변동 수치 · TEAM_DATA
 *   ② 작동하지 않는 경로를 안내하지 않는다 — 「조직 관리에서 팀 등록」·「예산을 팀에 배정」 류 문구 0.
 *      팀을 등록·배정해도 견적→결재 발주는 teamId 가 비어 이 탭이 영원히 0 이다(2026-09-21 측정).
 *   ③ 비어 있는 이유는 참인 것만 말한다 — 「팀 귀속이 없어」 가 있다.
 *   ④ 탭은 유지된다 — 분석 화면이 여전히 이 컴포넌트를 렌더한다(삭제가 아니라 내용 교체).
 *
 * ── 자기 한계 ──
 *   1. 팀 귀속이 실제로 생겼을 때(견적→결재 teamId 누락 수정 · 별건 P1) 이 파일은 방해가 된다 —
 *      그때는 ③·②를 실데이터 계약으로 바꾼다(①은 유지).
 *   2. 공급사명·수치는 이 파일(팀 탭) 안에서만 금지한다 — 다른 화면에서는 정당하게 쓰인다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");
const code = (rel: string) => stripComments(readFileSync(join(SRC, rel), "utf8"));

const VIEW = "app/dashboard/analytics/_components/team-analytics-view.tsx";
const PAGE = "app/dashboard/analytics/page.tsx";

const FAKE_TEAMS = ["분자생물학팀", "세포배양팀", "분석화학팀", "면역학팀", "유전체학팀", "단백질공학팀", "생물정보학팀"];

describe("§team-view-no-fabrication · 팀별 보기는 없는 팀 지출을 그리지 않는다", () => {
  it("① 가짜 팀 데이터가 돌아오지 않는다 (역계약)", () => {
    const view = code(VIEW);
    for (const t of FAKE_TEAMS) expect(view, `팀명 재등장: ${t}`).not.toContain(t);
    // 팀명은 분석 화면 본문에도 새지 않는다
    const page = code(PAGE);
    for (const t of FAKE_TEAMS) expect(page, `분석 화면에 팀명: ${t}`).not.toContain(t);
    expect(view).not.toMatch(/Sigma-Aldrich|Abcam|Thermo Fisher|Illumina|Agilent|Bio-Rad/);
    expect(view).not.toMatch(/\b30\.8\b|-15\.8\b|\b28\.6\b/);
    expect(view).not.toMatch(/\bTEAM_DATA\b/);
  });

  it("② 작동하지 않는 경로를 안내하지 않는다", () => {
    const view = code(VIEW);
    expect(view).not.toMatch(/조직 관리에서/);
    expect(view).not.toMatch(/팀을 등록/);
    expect(view).not.toMatch(/예산을 (팀에 )?배정/);
  });

  it("③ 비어 있는 이유는 참인 것만 · 팀 귀속 부재", () => {
    const view = code(VIEW);
    expect(view).toMatch(/팀별 지출 데이터 없음/);
    expect(view).toMatch(/팀 귀속이 없어/);
    expect(view).toMatch(/구매 요청 경로로 발주된 건만 팀에 귀속됩니다/);
  });

  it("④ 탭은 유지 · 분석 화면이 이 컴포넌트를 렌더한다", () => {
    const page = code(PAGE);
    expect(page).toMatch(/activeTab === "team" && <TeamAnalyticsView \/>/);
    expect(code(VIEW)).toMatch(/export default function TeamAnalyticsView\(/);
  });
});
