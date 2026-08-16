/**
 * §mobile-budgets P1 — 모바일 예산 관리(7a) · 등록 시트(7b) · 지출 분석(8a) (호영님 핸드오프 2026-07-21)
 *
 * 정본: docs/plans/PLAN_mobile-budgets.md (P0 확정: 임계 = 표시 전용 규약 안내(70/90/100,
 *   CategoryBudget 동일 수치) · 차단 토글 v1 제외(저장처 부재, 호영님 판정) · 마이그레이션 0).
 *
 * 원칙(§4): 웹 기능 삭제 0(표현만 접힘/요약) · 초록 대형 CTA 금지(초록=완료 표시만)
 *   · 활성화 단계 = 기존 canonical derive 소비(재구현 0) · 진입점 3곳 = 시트 하나.
 * 적용 경계: <768px(`md:`) — 데스크톱 회귀 0.
 *
 * ⚠️ Phase 1 RED sentinel — 구현 전 실패가 정상.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const p = (rel: string) => join(REPO_ROOT, rel);
const read = (rel: string) => readFileSync(p(rel), "utf8");

const SHEET = "src/components/budget/budget-register-sheet.tsx";
const BUDGET = "src/app/dashboard/budget/page.tsx";
const ANALYTICS = "src/app/dashboard/analytics/page.tsx";

describe("§mobile-budgets P1 — 7b 등록 시트", () => {
  it("시트 존재 + 기존 POST /api/budgets 계약 재사용(모델/API 무접촉)", () => {
    expect(existsSync(p(SHEET))).toBe(true);
    const src = read(SHEET);
    expect(src).toMatch(/\/api\/budgets/);
    expect(src).toMatch(/예산 풀 등록/);
  });

  it("분기 세그먼트 + 실제 날짜 확인 표기", () => {
    const src = read(SHEET);
    expect(src).toMatch(/분기/);
    expect(src).toMatch(/grid-cols-3/);
    expect(src).toMatch(/rangeText/);
  });

  it("임계 구간 = 표시 전용(70/90 규약 시각화) · 차단 토글 0(v1 제외)", () => {
    const src = read(SHEET);
    expect(src).toMatch(/#dcfce7/);
    expect(src).toMatch(/#fef9c3/);
    expect(src).toMatch(/#fee2e2/);
    expect(src).toMatch(/정상 ~70%/);
    expect(src).not.toMatch(/토글|Switch|blockOverspend|hardStop/); // 저장처 없는 토글 금지
  });

  it("초록 대형 CTA 0 · 터치 44px · 에러 정직 표기", () => {
    const src = read(SHEET);
    expect(src).not.toMatch(/bg-emerald-6|bg-green-6/);
    expect(src).toMatch(/min-h-\[44px\]/);
    expect(src).toMatch(/setError/);
  });
});

describe("§mobile-budgets P1 — 7a 예산 관리 모바일", () => {
  it("헤더 한 줄 압축(모바일) + 데스크톱 원문 보존", () => {
    const src = read(BUDGET);
    expect(src).toMatch(/등록 · 집행 · 승인 대기 · 초과 위험을 한곳에서/);
    expect(src).toMatch(/예산 등록, 집행 현황, 승인 대기와 초과 위험을 관리합니다/);
  });

  it("0건 = 초록 한 줄 요약 · 1건+ = 카드 승격(배경 채색 금지 — 숫자·라벨만 레드)", () => {
    const src = read(BUDGET);
    expect(src).toMatch(/예산 상태 정상 · 0\/0\/0/);
    expect(src).toMatch(/상세 ›/);
    expect(src).toMatch(/#b91c1c/); // KPI 경고 = 텍스트만 레드
  });

  it("온보딩 배너(중형) — 라벨·CTA·나중에 + 잘림 금지(break-keep)", () => {
    const src = read(BUDGET);
    expect(src).toMatch(/예산 통제 시작하기 · 2분/);
    expect(src).toMatch(/첫 분기 예산 설정/);
    expect(src).toMatch(/나중에/);
    expect(src).toMatch(/break-keep/);
    expect(src).toMatch(/#16233f,#1d3157/); // §5 배너 그라디언트
  });

  it("접힌 행 2(카테고리별 지출·예산 풀별 소진율) — 데이터 시 제자리 확장", () => {
    const src = read(BUDGET);
    expect(src).toMatch(/집계된 지출이 생기면 표시돼요/);
    expect(src).toMatch(/예산 풀이 등록되면 소진율이 표시돼요/);
  });

  it("7b 배선 — 시트 마운트 + 등록 즉시 양 화면 동기화(analytics invalidate)", () => {
    const src = read(BUDGET);
    expect(src).toMatch(/BudgetRegisterSheet/);
    expect(src).toMatch(/analytics-dashboard/);
    expect(src).toMatch(/fetchBudgets\(\)/);
  });
});

describe("§mobile-budgets P1 — 8a 지출 분석 모바일", () => {
  it("히어로+체크리스트 통합 단일 카드 — 진행 표기 + 완료 취소선 + 현재 단계 CTA", () => {
    const src = read(ANALYTICS);
    expect(src).toMatch(/분석 활성화 · /);
    expect(src).toMatch(/line-through/);
    expect(src).toMatch(/setBudgetSheetOpen\(true\)/); // 진입점 ③ = 시트(페이지 이동 대체)
  });

  it("기존 히어로·체크리스트 = 데스크톱 보존(hidden md:block) — 기능 삭제 0", () => {
    const src = read(ANALYTICS);
    expect(src).toMatch(/hidden md:block rounded-2xl bg-slate-900/);
    expect(src).toMatch(/hidden md:block rounded-xl border border-bd/);
    expect(src).toMatch(/소싱에서 시작/); // 데스크톱 CTA 보존
  });

  /* 🔁 은퇴→승계 (§analytics-tabs S10 · 2026-08-16 호영님 승인)
   *
   *   구 계약: 탭 행이 가로 스크롤되므로 **페이드 span 으로 잘림을 힌트**한다
   *            (`bg-gradient-to-l from-canvas` + `overflow-x-auto scrollbar-hide`).
   *   신 계약: 탭 행이 **애초에 안 잘린다**. 스크롤이 없으니 힌트할 대상도 없다.
   *
   *   정책("모바일 탭 행이 잘리지 않는다")은 **불변**이다. 수단만 뒤집혔다 —
   *   스크롤+힌트 → 비스크롤 레이아웃. 그래서 삭제가 아니라 **역계약 승계**다.
   *   그냥 지웠으면 회귀 방어가 0 이 된다(302c·302d-1 은퇴→승계 선례).
   *
   *   전제 실측(fixture 1b `_여유_실측`, 추정치 아님):
   *     탭 행 실폭 262px(`누적 시` 배지 포함) · 375px 뷰포트 가용 343px(p-4 좌우 32 제외)
   *     여유 81px → overflow 0. 기준은 md QA 의 390px 이 아니라
   *     CLAUDE.md Mobile Patterns §2 "375px 기준" — 더 엄격한 쪽으로 재도 통과.
   *   같은 산술이 `팀별 보기` 데스크톱 전용을 뒷받침한다:
   *     4번째 탭 필요폭 ≈ 68 + gap 22 = 90px > 여유 81px → 모바일 4탭은 실제로 넘친다. */
  it("탭 행 비스크롤 레이아웃 — 페이드 힌트 은퇴(§analytics-tabs S10 승계)", () => {
    const src = read(ANALYTICS);

    // 탭 행만 잘라낸다 — 1012·1022·1317·1455 의 타 섹션 overflow 는 무손상이어야 한다
    const from = src.indexOf('role="tablist"');
    const to = src.indexOf("액션 행", from);
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    const tabRow = src.slice(from, to);

    // ① 페이드 span 0 (구 계약 역전)
    expect(src).not.toMatch(/bg-gradient-to-l from-canvas/);
    // ② 탭 행에 스크롤 0 — 잘리지 않으므로 스크롤 컨테이너가 필요 없다
    expect(tabRow).not.toMatch(/overflow-x-auto|scrollbar-hide|snap-x/);
    // ③ 탭 행 자식은 tabs.map() 산출물만 — 액션 버튼이 도로 들어오면 폭이 넘친다
    expect((tabRow.match(/<button/g) ?? []).length).toBe(1);
    expect(tabRow).toMatch(/tabs\.map\(/);
  });

  it("타 섹션 가로 스크롤은 무손상(S10 범위 밖)", () => {
    const src = read(ANALYTICS);
    expect((src.match(/overflow-x-auto/g) ?? []).length).toBe(4);
  });

  it("분석 미리보기 접힌 행 3(소진율·의존도·이상 감지)", () => {
    const src = read(ANALYTICS);
    expect(src).toMatch(/예산 등록 시 채워집니다/);
    expect(src).toMatch(/발주 공급사 비중을 분석해요/);
    expect(src).toMatch(/3개월 이상 데이터 축적 시 활성화/);
  });

  it("활성화 단계 canonical derive 보존(재구현 0)", () => {
    const src = read(ANALYTICS);
    expect(src).toMatch(/canonical derive — 하드코딩 금지/);
    expect(src).toMatch(/onboardingSteps/);
  });
});

describe("§mobile-budgets P1 — 회귀 0 (데스크톱·패리티)", () => {
  it("예산 관리 — 보고서 내보내기·BudgetForm Dialog·KPI 5종 보존", () => {
    const src = read(BUDGET);
    expect(src).toMatch(/보고서 내보내기/);
    expect(src).toMatch(/BudgetForm/);
    expect(src).toMatch(/즉시 확인/);
    expect(src).toMatch(/차단 위험/);
    expect(src).toMatch(/승인 대기/);
    expect(src).toMatch(/절감 가능/);
    expect(src).toMatch(/주간 소진/);
  });

  it("지출 분석 — AI 리포트 버튼·탭 3종 보존", () => {
    const src = read(ANALYTICS);
    expect(src).toMatch(/AI 리포트 생성/);
    expect(src).toMatch(/공급사 의존도/);
    expect(src).toMatch(/이상 지출 감지/);
  });
});
