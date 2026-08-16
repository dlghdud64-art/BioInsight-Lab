/**
 * §11.244 Phase A #analytics-loading-ux — 호영님 P0 분석 페이지 로딩 UX
 *
 * 호영님 P0 spec (정식 런칭 전 8 항목 중 3 항목):
 *   #2  Skeleton Shimmer 애니메이션 — animate-pulse → linear-gradient shimmer
 *       (좌→우 그라데이션 반복) 으로 "로딩 중" 명확 시각화
 *   #5  KPI 카드 빈 상태 — 라벨 즉시 표시 + "—" 또는 "₩0" 자리표시자 +
 *       "데이터 축적 시 표시됩니다" 안내
 *   #6  AI 리포트 button — 데이터 부족 시 disabled + tooltip
 *       ("리포트 생성에 최소 1건의 완료된 발주 데이터가 필요합니다")
 *
 * Out of scope (Phase B / C 별도 batch):
 *   - #1 프로그레시브 로딩 (KPI/차트 독립 fetch)
 *   - #3 빈 상태 vs 로딩 중 분리
 *   - #4 빈 차트 mockup overlay (§11.243b 패턴 reuse)
 *   - #7 탭별 빈 상태 메시지
 *   - #8 10초 timeout
 *
 * canonical truth lock:
 *   - useQuery / data shape / runAiAnalysis 변경 0
 *   - Skeleton 컴포넌트 caller 변경 0 (className 시각만 swap)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SKELETON_PATH = resolve(__dirname, "../../components/ui/skeleton.tsx");
const GLOBALS_CSS_PATH = resolve(__dirname, "../../app/globals.css");
const DASHBOARD_PATH = resolve(__dirname, "../../components/dashboard/analytics-dashboard.tsx");
const PAGE_PATH = resolve(__dirname, "../../app/dashboard/analytics/page.tsx");

const skeleton = readFileSync(SKELETON_PATH, "utf8");
const globalsCss = readFileSync(GLOBALS_CSS_PATH, "utf8");
const dashboard = readFileSync(DASHBOARD_PATH, "utf8");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.244 #2 — Skeleton Shimmer 애니메이션", () => {
  it("globals.css 에 @keyframes shimmer 추가 (좌→우 그라데이션 반복)", () => {
    expect(globalsCss).toMatch(/@keyframes\s+shimmer/);
  });

  it("skeleton.tsx 에 linear-gradient + background-size 패턴 (shimmer 시각)", () => {
    // linear-gradient (회색 톤) + bg-[length:200%_100%] 또는 동등한 background-size
    expect(skeleton).toMatch(/(bg-\[linear-gradient|bg-gradient-to-r)/);
    expect(skeleton).toMatch(/(bg-\[length:200%|background-size)/);
  });

  it("skeleton.tsx 에 animate-shimmer 또는 동등 animation class", () => {
    expect(skeleton).toMatch(/(animate-shimmer|animation:\s*shimmer)/);
  });
});

describe("§11.244 #5 — KPI 카드 빈 상태 (라벨 즉시 + 자리표시자)", () => {
  it("analytics-dashboard.tsx — KPI 카드 isLoading 분기 안 라벨 항상 표시", () => {
    // CardTitle 안 라벨 ("이번 달 지출" 등) 이 isLoading 분기 외부에 위치
    // 또는 isLoading 분기 안에 자리표시자 "—" / "₩0" + 안내 텍스트.
    expect(dashboard).toMatch(/(데이터 축적 시 표시됩니다|—|placeholder)/);
  });

  it("KPI 카드 라벨 4개 보존 (canonical truth)", () => {
    expect(dashboard).toMatch(/이번 달 지출/);
    expect(dashboard).toMatch(/(자산 가치|자산 총액|총 자산)/);
    expect(dashboard).toMatch(/(재주문|재발주)/);
  });
});

describe("§11.244 #6 — AI 리포트 button disabled + tooltip", () => {
  it("AI 리포트 button — data 부족 시 disabled 분기 확장", () => {
    // 기존 disabled={aiLoading} → disabled={aiLoading || dataInsufficient} 패턴
    // 또는 hasNoData / dataInsufficient / aiButtonDisabled 변수 도입.
    expect(page).toMatch(/(dataInsufficient|hasNoData|aiButtonDisabled|noAnalyticsData)/);
  });

  /* 🔁 앵커 이동 (§analytics-tabs S9 · S16 · 2026-08-16 호영님 승인)
   *
   *   구 단언은 **문안에 핀**돼 있었다 — `/리포트 생성에 최소|최소 1건|…/`.
   *   S9 가 표현을 `완료된 발주 1건 이상 필요` 로 바꾸자 정책은 그대로인데 RED 가 났다.
   *   문안을 새 문자열로 갈아끼우면 **같은 드리프트가 다음에 또 난다** — 원인이
   *   표현이 아니라 앵커 위치이기 때문이다.
   *
   *   S9 는 title 툴팁을 지우고 **가시 텍스트 + aria-describedby** 로 승격시켰다.
   *   툴팁보다 강한 계약이므로 앵커를 그쪽으로 옮긴다:
   *     ① disabled 배선  ② 사유 연결 존재  ③ 사유 문안 **부분**매칭  ④ 툴팁 의존 0
   *   ③으로 문안 진화를 흡수하고 ①②④로 정책·배선을 잠근다. */
  it("AI 리포트 비활성 사유 — 툴팁이 아니라 가시 텍스트 + aria-describedby", () => {
    // ① 정책 배선 — 데이터 부족이 disabled 를 만든다.
    //    🛑 `aria-` 를 제외해야 한다. `aria-disabled=` 가 `disabled=` 를 문자열로 포함해서,
    //       빼면 실 disabled 가 끊겨도 aria 쪽이 대신 매칭돼 GREEN 이 뜬다(프로브로 실측).
    expect(page).toMatch(/(?<!aria-)disabled=\{[^}]*dataInsufficient/);
    expect(page).toMatch(/aria-disabled=\{[^}]*dataInsufficient/); // S16 — 둘 다 요구

    // ② 사유 연결 — 버튼과 사유 노드가 id 로 묶인다(모바일·데스크톱 variant 분기)
    expect(page).toMatch(/aria-describedby=\{[\s\S]{0,80}?ai-report-reason-\$\{variant\}/);
    expect(page).toMatch(/id=\{`ai-report-reason-\$\{variant\}`\}/);

    // ③ 사유 문안 — 부분매칭만. 표현이 진화해도 정책이 남아 있으면 통과한다
    const reason = page.slice(page.indexOf("ai-report-reason-${variant}`}"));
    expect(reason).toMatch(/완료된 발주/);
    expect(reason).toMatch(/1건/);

    // ④ S9 역계약 — AI 리포트 버튼은 title 툴팁에 의존하지 않는다
    //    (1220·1282 의 truncate 보조 title 은 무관 — 버튼 블록만 본다)
    //    🛑 창을 `aria-describedby` 부터 열면 **여는 태그 앞부분이 창 밖**이라
    //       title 이 그 앞에 붙으면 못 잡는다(프로브로 실측). `<button` 부터 연다.
    const anchor = page.indexOf("aria-describedby=");
    expect(anchor).toBeGreaterThan(-1);
    const btnFrom = page.lastIndexOf("<button", anchor);
    const btnTo = page.indexOf("</button>", anchor);
    expect(btnFrom).toBeGreaterThan(-1);
    expect(page.slice(btnFrom, btnTo)).not.toMatch(/title=/);
  });
});

describe("§11.244 invariant 보존 (cluster lineage)", () => {
  it("Skeleton 4 named export 보존", () => {
    expect(skeleton).toMatch(/export\s*\{\s*Skeleton\s*\}/);
  });

  it("analytics-dashboard.tsx — useQuery / DashboardStats 보존", () => {
    expect(dashboard).toMatch(/useQuery<DashboardStats>/);
  });

  it("analytics page.tsx — runAiAnalysis + useQuery 보존", () => {
    expect(page).toMatch(/runAiAnalysis/);
    expect(page).toMatch(/useQuery<AnalyticsDashboardData>/);
  });

  it("§11.244 trace marker comment", () => {
    expect(page + dashboard + skeleton).toMatch(/§11\.244[\s\S]{0,300}(loading|shimmer|KPI|AI|로딩|빈 상태)/i);
  });
});
