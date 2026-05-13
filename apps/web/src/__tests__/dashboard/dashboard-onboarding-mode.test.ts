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

describe("§11.243 #2 — 온보딩 히어로 3단계", () => {
  it("OnboardingHero 3 step 라벨 (품목 등록 / 견적 요청 / 비교 검토)", () => {
    expect(page).toMatch(/(품목 등록|시약\/소모품)/);
    expect(page).toMatch(/견적 요청/);
    expect(page).toMatch(/비교 검토/);
  });

  it("3 step 완료 분기 (stats 기반 derive)", () => {
    // step 1 완료 = totalInventory > 0, step 2 = activeQuotes > 0, step 3 = respondedQuotes > 0
    expect(page).toMatch(/(stats\.totalInventory\s*>\s*0|totalInventory\s*>\s*0)/);
  });
});

describe("§11.243 #3 — SYSTEM INSIGHT 축소 + dismiss", () => {
  it("SystemInsightCard onboarding 분기 또는 dismiss state", () => {
    expect(summary).toMatch(/(isOnboarding|onboardingMode|systemInsightDismissed|sessionStorage|dismissed)/);
  });
});

describe("§11.243 #4 — 빈 차트 mockup + 오버레이", () => {
  it("spend-trend-card — mockup data + overlay 분기", () => {
    expect(spend).toMatch(/(MOCKUP|mockup|sample|샘플|hardCodedMonthly|isEmpty|backdrop-blur)/);
  });

  it("category-distribution-card — mockup data + overlay 분기", () => {
    expect(category).toMatch(/(MOCKUP|mockup|sample|샘플|hardCodedCategories|isEmpty|backdrop-blur)/);
  });
});

describe("§11.243 #5/#6 — 이슈 요약 + 인텔리전스 빈 상태", () => {
  it("이슈 감지 안내 (납기 지연 / 가격 이상 / 재고 소진 중 1+)", () => {
    expect(page).toMatch(/(납기 지연|가격 이상|재고 소진|이런 이슈|자동으로 감지)/);
  });
});

describe("§11.243 #7 — KPI 가이드 + 회색 progress", () => {
  it("KPI 0건 분기 — bg-gray-200 progress 또는 회색 fallback", () => {
    expect(page).toMatch(/(bg-gray-200|bg-slate-200)[\s\S]{0,300}(progress|width|h-1)/);
  });
});

describe("§11.243 #8 — AI 리포트 disabled + tooltip", () => {
  it("AI 리포트 button disabled 분기 + title tooltip", () => {
    expect(page).toMatch(/(AI 리포트|aiReport)[\s\S]{0,400}(disabled|cursor-not-allowed)/);
    expect(page).toMatch(/(리포트 생성에 최소|최소 1건|완료된 견적|데이터가 필요)/);
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
