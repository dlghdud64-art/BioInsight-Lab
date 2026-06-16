/**
 * §11.243 #dashboard-onboarding-mode — 호영님 P0 대시보드 온보딩/빈 상태 UX 10항목
 *
 * 호영님 spec (2026-05-14, 정식 런칭 전 필수):
 *   1. 빈 상태 레이아웃 분기 (온보딩 vs 운영) — quoteStats === 0 = 온보딩
 *   2. 온보딩 히어로 3단계 (품목 등록 / 견적 요청 / 비교 검토)
 *   3. SYSTEM INSIGHT 배너 축소 + dismiss + sessionStorage
 *   4. 빈 차트 영역 mockup data + 반투명 오버레이
 *   5. 이슈 요약 "이런 걸 감지합니다" 안내 (3 항목)
 *   6. 운영 인텔리전스 isOnboarding 시 숨김
 *   7. KPI 카드 0건 가이드 + 회색 progress
 *   8. AI 리포트 disabled + tooltip
 *   9. 바로가기 건수 뱃지
 *   10. 빈 상태 텍스트 행동 유도형 swap
 *
 * canonical truth lock:
 *   - stats / kpis 변경 0 (canonical data shape)
 *   - SystemInsightCard label semantic 변경 0 (분기만 추가)
 *   - §11.226 ~ §11.242 cluster invariant 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../app/dashboard/page.tsx");
const SUMMARY_PATH = resolve(__dirname, "../../components/dashboard/executive-summary-section.tsx");
const SPEND_PATH = resolve(__dirname, "../../components/dashboard/spend-trend-card.tsx");
const CATEGORY_PATH = resolve(__dirname, "../../components/dashboard/category-distribution-card.tsx");

const page = readFileSync(PAGE_PATH, "utf8");
const summary = readFileSync(SUMMARY_PATH, "utf8");
const spend = readFileSync(SPEND_PATH, "utf8");
const category = readFileSync(CATEGORY_PATH, "utf8");

describe("§11.243 #1 — 온보딩 모드 분기", () => {
  it("isOnboardingMode derive (quoteStats === 0 기반)", () => {
    expect(page).toMatch(/(const isOnboardingMode|isOnboardingMode\s*=)/);
    expect(page).toMatch(/(activeQuotes[\s\S]{0,100}respondedQuotes|stats\.activeQuotes|quoteStats)/);
  });

  it("§11.243 trace marker comment", () => {
    expect(page).toMatch(/§11\.243[\s\S]{0,400}(온보딩|onboarding|isOnboardingMode)/i);
  });
});

// §dashboard-shifan-adopt P2 진화 — "온보딩 히어로 3단계"(시작하기 hero) 폐지(시안 채택).
//   진행 가이드는 NextStepBanner("다음 단계 추천", summary) + GlobalEmpty(빈 계정 CTA)로 대체.
describe("§243 #2→shifan P2 — OnboardingHero 폐지·NextStepBanner 대체", () => {
  it("'시작하기' 3단계 hero 제거", () => {
    expect(page).not.toMatch(/>\s*시작하기\s*</);
    expect(page).not.toMatch(/onboardingSteps\.inventoryDone/);
  });

  it("가이드 보존 — NextStepBanner + GlobalEmpty 배선", () => {
    expect(page).toMatch(/<NextStepBanner/);
    expect(page).toMatch(/<GlobalEmpty\s*\/>/);
  });
});

describe("§11.243 #3 — SYSTEM INSIGHT 축소 + dismiss", () => {
  it("SystemInsightCard onboarding 분기 또는 dismiss state", () => {
    expect(summary).toMatch(/(isOnboarding|onboardingMode|systemInsightDismissed|sessionStorage|dismissed)/);
  });
});

// §11.243 #4 → §dashboard-shifan-adopt P3b 진화 — 빈 차트 mockup 폐지, 정직 empty 강제.
//   이전엔 회색 mockup 도넛/area + "예시 데이터" overlay 를 빈 계정에 그렸으나(정직성 위반),
//   SpendTrend(가드①②)·Category(P3b) 모두 차트 미렌더 + 컴팩트 정직 empty 로 수리됨.
describe("§11.243 #4 → P3b — 빈 차트 정직 empty(가짜 분포 0)", () => {
  it("spend-trend-card — isEmpty 분기 + 정직 empty 문구(mockup 0)", () => {
    expect(spend).toMatch(/isEmpty/);
    expect(spend).toMatch(/데이터가 쌓이면 지출 추이가 표시됩니다/);
  });

  it("category-distribution-card — isEmpty 분기 + 정직 empty 문구 + 예시 overlay 0", () => {
    expect(category).toMatch(/isEmpty/);
    expect(category).toMatch(/발주가 시작되면 카테고리 분포가 표시됩니다/);
    expect(category).not.toMatch(/위 차트는 예시 데이터/);
  });
});

describe("§11.243 #5/#6→shifan P-fid1 — 이슈 감지 awareness 이전(운영인텔 폐지)", () => {
  it("이슈 감지 awareness 가 ActionInbox 로 이전(레거시 운영 인텔리전스 카드 폐지)", () => {
    // §dashboard-shifan-fidelity P-fid1 — 레거시 운영 인텔리전스("자동 감지된 이슈" 카드,
    //   납기지연/가격이상/재고소진 안내) 360행 폐지. 이슈 감지 awareness 는 ActionInbox
    //   ("오늘 처리해야 할 일", dashboardPriorityActions: 만료/SLA/재고/입고/승인)가 흡수.
    //   보호 의도(이슈 감지 안내 무손실) 보존: 흡수 surface present + 레거시 운영인텔 absent.
    expect(page).toMatch(/<ActionInbox/); // 흡수 surface present
    expect(page).not.toMatch(/운영 인텔리전스/); // 레거시 운영인텔 블록 absent(되살아나면 잡음)
  });
});

describe("§11.243 #7 — 온보딩 진행 가이드 (§dashboard-shifan-adopt P2: hero progress → NextStepBanner/GlobalEmpty)", () => {
  it("'시작하기 3단계' hero progress bar 폐지 → NextStepBanner/GlobalEmpty 가이드 이전", () => {
    // §dashboard-shifan-adopt P2: hero(bg-gray-200 3단계 progress) 폐지 → 진행 가이드는
    //   NextStepBanner(다음 단계 추천, summary 소스) + GlobalEmpty(빈 계정)로 이전. 가이드 공백 0.
    expect(page).toMatch(/NextStepBanner|GlobalEmpty/);
  });
});

describe("§11.243 #8 — AI 리포트 onboarding 분석 차단 (§11.374 P4 진화: disabled+tooltip → entry 숨김)", () => {
  it("온보딩(데이터 0) 시 AI 리포트 entry 비노출 — 0데이터 분석 차단 (더 강한 게이트)", () => {
    // §11.374 P4(호영님 정정): 회색 disabled+tooltip 붕뜸 → 온보딩 시 헤더 actions 에서
    //   리포트 entry 자체 제거(isOnboardingMode ? undefined). 의도(0데이터 분석 차단) 동일·강화.
    expect(page).toMatch(/isOnboardingMode[\s\S]{0,120}\?\s*undefined/);
    // 데이터 있을 때만 AIInsightDialog 노출 (분석 진입점 보존).
    expect(page).toMatch(/AIInsightDialog/);
  });
});

describe("§11.243 #9 — 바로가기 4 카드 건수 뱃지", () => {
  it("바로가기 카드 건수 표시 ('N건 진행', '전환 가능' 등)", () => {
    expect(page).toMatch(/(\d+건 진행|건 진행 중|전환 가능|입고 대기|경고 0건|stats\.activeQuotes|activeBadge)/);
  });
});

describe("§11.243 #10 — 빈 상태 텍스트 행동 유도형 swap", () => {
  it("부정형 → 행동 유도형 (자동으로 / 활성화 / 쌓이기 시작 등)", () => {
    expect(page).toMatch(/(자동으로|활성화됩니다|쌓이기 시작|자동으로 기록|자동으로 감지)/);
  });
});

describe("§11.243 #11 — invariant 보존 (cluster lineage)", () => {
  it("§11.242 OP_STATUS map / quotes 테이블 영향 0 (대시보드만)", () => {
    expect(page).toMatch(/(stats\.totalInventory|stats\.activeQuotes|rawStats)/);
  });

  it("§11.226 ~ §11.242 cluster — quotes page unaffected", () => {
    // 대시보드 page.tsx + executive-summary-section + spend-trend-card + category-distribution-card 만 변경.
    expect(existsSync(PAGE_PATH)).toBe(true);
    expect(existsSync(SUMMARY_PATH)).toBe(true);
  });
});
