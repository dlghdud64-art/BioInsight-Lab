/**
 * §mobile-reports P1 — 모바일 구매 리포트 개선 (호영님 핸드오프 2026-07-21)
 *
 * 정본: docs/plans/PLAN_mobile-purchase-reports.md (P0 확정: API 확장 0 ·
 *   KPI 4장 = 기존 deriveInsights 파생 재사용 · 60% 배너 = 모바일만 yellow).
 *
 * 원칙(핸드오프 §0): ❌ 모바일 가져오기/업로드 UI ❌ 탭 분리 ❌ recharts(모바일 미니차트)
 *   ❌ 파생 규칙 중복(deriveInsights 단일점) ❌ amber(yellow 토큰 강제).
 * 적용 경계: viewport <768px(`md:`) — 데스크톱 기존 동작 회귀 0.
 *
 * ⚠️ Phase 1 RED sentinel — 구현 전 실패가 정상.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const p = (rel: string) => join(REPO_ROOT, rel);
const read = (rel: string) => readFileSync(p(rel), "utf8");

const PAGE = "src/app/dashboard/reports/page.tsx";
const MOBILE = "src/app/dashboard/reports/mobile-report-view.tsx";

describe("§mobile-reports P1 — 모바일 뷰 계약", () => {
  it("mobile-report-view 존재 + page 에 md 경계 마운트", () => {
    expect(existsSync(p(MOBILE))).toBe(true);
    const page = read(PAGE);
    expect(page).toMatch(/MobileReportView/);
    expect(page).toMatch(/md:hidden/); // 모바일 전용 마운트
    expect(page).toMatch(/hidden md:/); // 데스크톱 콘텐츠 경계
  });

  it("원칙 §0 — 모바일 가져오기/업로드 UI 0 · 탭 0 · recharts 0", () => {
    const src = read(MOBILE);
    expect(src).not.toMatch(/CloudUpload|가져오기|업로드|import-file/);
    expect(src).not.toMatch(/from "recharts"|Tabs|role="tab"/);
  });

  it("파생 단일점 — deriveInsights 산출(insights) 소비, 규칙 재구현 0", () => {
    const src = read(MOBILE);
    expect(src).toMatch(/insights/);
    // 이상치·의존도 임계 재정의 금지(단일점 파생만 소비)
    expect(src).not.toMatch(/avgUnitPrice \* 2|\* 2 &&.*unitPrice/);
  });

  it("헤더·기간·필터 — 날짜 한국어 본문 폰트 + 단일 카드 + 필터 배지", () => {
    const src = read(MOBILE);
    expect(src).toMatch(/formatKoreanDateRange/); // 한국어 날짜(올해 연도 생략)
    expect(src).not.toMatch(/font-mono/); // §5 Pretendard 단일 — mono 전면 금지
    // 🔄 진화(2026-07-21, 호영님 승인) — 프리셋 라벨 단일소스는 page.tsx `REPORT_PRESETS`.
    //   MobileReportView 는 리터럴을 중복 보유하지 않고 `presets` prop 을 받아 렌더(단일소스 설계).
    //   따라서 라벨 리터럴은 부모(page)에서, 자식(mobile)은 prop 배선을 검증한다.
    const page = read(PAGE);
    expect(page).toMatch(/최근 7일/);
    expect(page).toMatch(/최근 30일/);
    expect(src).toMatch(/presets/); // prop 수신
    expect(src).toMatch(/p\.label\.replace\(/); // "최근 " 접두 제거 렌더(배지)
  });

  it("KPI — 2열 컴팩트 4장 · 값 없음 '–'(0과 구분)", () => {
    const src = read(MOBILE);
    expect(src).toMatch(/grid-cols-2/);
    expect(src).toMatch(/["'`]–["'`]/);
  });

  it("빈 기간 — 점선 카드 + 자동 집계 안내 + 30일 CTA(실동작)", () => {
    const src = read(MOBILE);
    expect(src).toMatch(/border-dashed/);
    expect(src).toMatch(/발주가 완료되면 지출이 자동으로 집계됩니다/);
    expect(src).toMatch(/기간을 30일로 넓히기/);
  });

  it("상세 분석 — 같은 슬롯 2상태(접힌 행 3종 카피) · 딥링크 실경로", () => {
    const src = read(MOBILE);
    expect(src).toMatch(/집계된 지출이 생기면 표시돼요/);
    expect(src).toMatch(/발주 공급사 비중을 분석해요/);
    expect(src).toMatch(/2개월 이상 쌓이면 추이가 그려져요/);
    expect(src).toMatch(/\/dashboard\/purchases/);
  });

  it("의존도 60% 배너 — yellow 토큰(amber 금지) + 권장 카피", () => {
    const src = read(MOBILE);
    expect(src).toMatch(/대체 공급사 검토를 권장해요/);
    expect(src).toMatch(/bg-yellow-50/);
    expect(src).toMatch(/text-yellow-7/);
    expect(src).not.toMatch(/amber-/);
  });

  it("터치 타겟 44px", () => {
    const src = read(MOBILE);
    expect(src).toMatch(/min-h-\[44px\]|h-11/);
  });
});

describe("§mobile-reports P1 — 회귀 0 (데스크톱 보존)", () => {
  it("데스크톱 가져오기 Dialog·내보내기·프리셋 보존", () => {
    const page = read(PAGE);
    expect(page).toMatch(/CloudUpload/);
    expect(page).toMatch(/가져오기/);
    expect(page).toMatch(/REPORT_PRESETS/);
    expect(page).toMatch(/FileDown/);
  });

  it("데이터 계약 보존 — queryKey·deriveInsights·API 경로", () => {
    const page = read(PAGE);
    expect(page).toMatch(/\["reports", "purchase"/);
    expect(page).toMatch(/deriveInsights/);
    expect(page).toMatch(/\/api\/reports\/purchase/);
  });

  it("§reports-filter-redesign 보존 — 필터 팝오버·활성 칩", () => {
    const page = read(PAGE);
    expect(page).toMatch(/activeFilterCount/);
    expect(page).toMatch(/SlidersHorizontal/);
  });
});
