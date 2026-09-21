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
 *   2. 분석·보고서 화면 밖의 추세 뱃지. 2026-09-21 전역 sweep 에서 비시간축 뱃지는 analytics 2건뿐이었다.
 *      (reports/page.tsx trendDelta 의 0 뭉개기는 아래 ⑥ 으로 **닫았다** — 2026-09-21 별도 커밋.)
 *   3. 「팀별 보기」 탭(team-analytics-view.tsx) 은 TEAM_DATA **더미 데이터셋** 전체를 표기 없이 렌더한다 —
 *      이 파일의 범위 밖이고 더 큰 건이다. 큐·보고 참조.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");
const PAGE = stripComments(readFileSync(join(SRC, "app/dashboard/analytics/page.tsx"), "utf8"));
const REPORTS = stripComments(readFileSync(join(SRC, "app/dashboard/reports/page.tsx"), "utf8"));
const REPORTS_MOBILE = stripComments(readFileSync(join(SRC, "app/dashboard/reports/mobile-report-view.tsx"), "utf8"));

/** reports 의 trendDelta 정의 — 선언부터 첫 `;` 까지. */
function trendDeltaDef(): string {
  const at = REPORTS.indexOf("const trendDelta");
  if (at < 0) return "";
  return REPORTS.slice(at, REPORTS.indexOf(";", at) + 1);
}

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

/* ⑥ reports trendDelta (2026-09-21 · 호영님 · 별도 커밋)
 *   데이터 2개월 미만(또는 전월 0)에서 0 으로 뭉개 초록 「↓ 0%」 를 그리던 것 = 없음을 추세로 렌더.
 *   → 비교 불가면 null · 방향 뱃지·「전월 대비」·퍼센트 미표시 · 「비교할 전월 데이터 없음」. */
describe("§analytics-fake-trend ⑥ · reports trendDelta 는 비교 불가를 0 으로 뭉개지 않는다", () => {
  it("정의 · 비교 불가면 null (0 폴백 없음)", () => {
    const def = trendDeltaDef();
    expect(def.length).toBeGreaterThan(0);
    expect(def).toMatch(/:\s*null;$/);
    expect(def).not.toMatch(/:\s*0;$/);
  });

  it("렌더 · 두 자리 모두 null 가드 뒤에서만 방향·퍼센트를 그린다", () => {
    // 가드는 2곳(인사이트 카드 · 추세 설명 줄) — 개수가 아니라 각 자리를 직접 본다
    const card = REPORTS.slice(REPORTS.indexOf("insights.trendDelta !== null ?"), REPORTS.indexOf("지출 변화 추이"));
    // 사용 지점 형태로 문다(경계 래칫 §sentinel-identifier-boundary 가 맨 이름 /ArrowUpRight/ 를 잡았다)
    expect(card).toMatch(/<ArrowUpRight\b/);
    expect(card).toMatch(/비교할 전월 데이터 없음/);
    const trendLine = REPORTS.slice(REPORTS.indexOf("insights.trendDelta !== null &&"), REPORTS.indexOf("변동", REPORTS.indexOf("insights.trendDelta !== null &&")));
    expect(trendLine).toMatch(/최근 월 대비/);
    // 옛 형태 — 길이 조건만으로 추세 줄을 그리던 가드가 돌아오면 RED
    expect(REPORTS).not.toMatch(/\{monthlyData\.length >= 2 && \(\s*<div className="mt-3 border-t/);
  });

  // 🛑 형제 슬롯 — 같은 insights 가 모바일 보고서로도 넘어간다. 데스크톱만 고치면 모바일이 「0%」 를 계속 그린다
  //    (2026-09-21 실측: 처음엔 놓쳤고 tsc 가 MobileInsights 타입 불일치로 잡았다).
  it("모바일 · 타입이 null 을 허용하고 두 자리 모두 null 가드", () => {
    expect(REPORTS_MOBILE).toMatch(/trendDelta:\s*number\s*\|\s*null;/);
    expect(REPORTS_MOBILE).toMatch(/insights\.trendDelta !== null \?\s*\(\s*<KpiCard/);
    expect(REPORTS_MOBILE).toMatch(/aside="비교할 전월 데이터 없음"/);
    expect(REPORTS_MOBILE).toMatch(/\{insights\.trendDelta !== null && \(/);
    // 옛 형태 — 길이 조건으로만 가르던 값 계산이 돌아오면 RED
    expect(REPORTS_MOBILE).not.toMatch(/value=\{monthlyData\.length >= 2 \? `\$\{insights\.trendDelta/);
  });
});
