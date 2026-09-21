/**
 * §analytics-fake-trend (2026-09-21 · 호영님 판정) · **추세 표시는 시간축에서만 나온다.**
 *
 * ── 왜 ──
 * 지출 분석 본문이 재고·예산에서 걷어낸 것과 같은 유형이었다 — 상수를 뺀 값에 추세 아이콘을 붙였다.
 *   KPI1 「Q 예산 소진율」 뱃지  = usageRate - 50           (상수 50과의 차이 · ▼-44%)
 *   KPI4 「공급사 의존도」 뱃지  = vendorConcentration - 40 (상수 40과의 차이 · ▲+80%)
 *   카테고리 표 MOM 열          = cat.pct - (100/카테고리수) (월 비교가 아니라 평균 비중과의 차이)
 *                                자기 주석이 "전월 데이터 없으므로 변동률로 대체" 라고 자백하고 있었다
 *   카테고리 표 상태 열          = cat.pct > 30 ? "danger"   (카테고리 1개면 무조건 「예산 초과 위험」)
 *   KPI2 「전월 동기 대비」 문구 = monthChange 가 null 이어도 항상 렌더
 * 라이브 결과: 소진율 6% 에 「정상 범위」 라고 쓴 같은 화면 아래 카테고리엔 「예산 초과 위험」.
 * 전월 데이터 0건인데 화살표 두 개가 추세를 말했다. **축이 상수면 뱃지가 아니다.**
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① 상수 차이 산식 0 — usageRate - 50 · vendorConcentration - 40 · 평균 비중 차이(avgPct) (역계약)
 *   ② 비중으로 예산 위험 판정 0 — cat.pct > 30 · 카테고리 표에 「예산 초과 위험」 0 (역계약)
 *   ③ TrendBadge 에 들어가는 값의 **집합** = [monthChange] — 시간축 값 하나뿐이다(개수가 아니라 집합)
 *   ④ 비교값이 없으면 비교 문구도 없다 — monthChange 가 null 이면 「전월 데이터 없음」
 *   ⑤ 카테고리 표 열 **집합** = [카테고리 · 이번 달 지출 · 비중] (MOM·상태 은퇴)
 *
 * ── 은퇴한 것 · 되살릴 조건 ──
 *   MOM 열 — 카테고리별 **전월** 데이터가 실제로 쌓이면 그때 추가한다(그때는 ⑤의 집합을 근거 커밋과 함께 늘린다).
 *   상태 열 — 카테고리별 **예산**이 생기면 그때(비중이 아니라 예산 대비 소진으로).
 *
 * ── 이 파일이 안 보는 것 (자기 한계) ──
 *   1. monthChange 자체의 정합성. 지금 정의는 **0이 아닌 마지막 두 달**을 비교한다(analytics/page.tsx
 *      validMonths) — 연속한 달이 아닐 수 있고 「이번 달」 이 아닐 수 있다. 큐 등재(2026-09-21), 이 파일은 안 잡는다.
 *   2. 분석 화면 밖의 추세 뱃지. 전역 sweep 결과는 큐 참조 — reports/page.tsx 의 trendDelta 는 데이터가
 *      2개월 미만이면 0 으로 뭉개져 「↓ 0%」 를 그린다(시간축은 맞으나 부재를 추세로 말함). 미수정.
 *   3. 「팀별 보기」 탭(team-analytics-view.tsx) 은 TEAM_DATA **더미 데이터셋** 전체를 표기 없이 렌더한다 —
 *      이 파일의 범위 밖이고 더 큰 건이다. 큐·보고 참조.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");
const PAGE = stripComments(readFileSync(join(SRC, "app/dashboard/analytics/page.tsx"), "utf8"));

/** 카테고리 표 블록 — 표 제목 뒤 첫 <table 부터 </table> 까지(주석 제거본). */
function categoryTable(): string {
  const at = PAGE.indexOf("카테고리별 지출 통계");
  if (at < 0) return "";
  const start = PAGE.indexOf("<table", at);
  const end = PAGE.indexOf("</table>", start);
  return start < 0 || end < 0 ? "" : PAGE.slice(start, end);
}

describe("§analytics-fake-trend · 추세 표시는 시간축에서만 나온다", () => {
  it("① 상수 차이 산식 0 (역계약)", () => {
    expect(PAGE).not.toMatch(/usageRate\s*-\s*50\b/);
    expect(PAGE).not.toMatch(/vendorConcentration\s*-\s*40\b/);
    expect(PAGE).not.toMatch(/\bavgPct\b/);
    expect(PAGE).not.toMatch(/100\s*\/\s*Math\.max\(\s*categoryItems\.length/);
  });

  it("② 비중으로 예산 위험 판정 0 (역계약)", () => {
    expect(PAGE).not.toMatch(/cat\.pct\s*>\s*30/);
    const table = categoryTable();
    expect(table.length).toBeGreaterThan(0);
    expect(table).not.toMatch(/예산 초과 위험/);
    expect(table).not.toMatch(/\brow\.status\b/);
    expect(table).not.toMatch(/\brow\.mom\b/);
  });

  it("③ TrendBadge 에 들어가는 값의 집합 = [monthChange]", () => {
    const values = [...PAGE.matchAll(/<TrendBadge\s+value=\{([^}]*)\}/g)].map((m) => m[1].trim()).sort();
    // 추가할 때는 그 값이 **시간축 비교**인지 확인하고, 근거 커밋과 함께 이 집합을 늘린다.
    expect(values).toEqual(["monthChange"]);
  });

  it("④ 비교값이 없으면 비교 문구도 없다 (전월 데이터 없음)", () => {
    expect(PAGE).toMatch(/monthChange === null \? "전월 데이터 없음" : "전월 동기 대비"/);
    // 조건 없이 항상 렌더하던 옛 형태가 돌아오면 RED
    expect(PAGE).not.toMatch(/<p className="[^"]*">전월 동기 대비<\/p>/);
  });

  it("⑤ 카테고리 표 열 집합 = [카테고리 · 이번 달 지출 · 비중]", () => {
    const table = categoryTable();
    const from = table.indexOf("<thead");
    const to = table.indexOf("</thead>", from);
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    const thead = table.slice(from, to);
    const headers = [...thead.matchAll(/<th[^>]*>([^<]+)<\/th>/g)].map((m) => m[1].trim());
    expect(headers).toEqual(["카테고리", "이번 달 지출", "비중"]);
    // 비중 셀은 실제 값(row.pct)을 그린다
    expect(table).toMatch(/\{row\.pct\}%/);
  });
});
