/**
 * §11.381 Phase A — compare 스펙표·하이라이트 → 소싱 비교 검토 흡수 sentinel
 *
 * 호영님 b2 결정 (2026-06-10):
 *   AI 비교 분석 = 소싱 "비교 검토" 단계가 canonical. compare 3라우트는 stale 잔재.
 *   Phase A: 스펙표 + 하이라이트를 sourcing-result-review-workbench 에 same-canvas 흡수.
 *   Phase B(별도 batch): compare 3라우트 retire + 재배선.
 *
 * A0 truth lock 확정 사항:
 *   - pre-quote 충전 가능 컬럼 5개 (제품명·브랜드·카테고리·규격/용량·Grade — 전부 catalog-borne)
 *   - 견적 충전 대상: 최저가·납기·공급사 수 (pre-quote 시 "견적 대기" 상태 — fake data 금지)
 *   - 하이라이트: 최저가(emerald) / 최단납기(blue) 배지 — _workbench/compare/page.tsx 로직 이식
 *   - 데이터 경로: /api/products/compare (compare 와 동일 — canonical truth 보존)
 *
 * 구현 계약 (A2 GREEN 기준):
 *   - 신규: app/_workbench/_components/sourcing-spec-compare-section.tsx
 *     export SourcingSpecCompareSection — 신규 페이지/라우트 금지, 섹션 컴포넌트만
 *   - wiring: sourcing-result-review-workbench.tsx 내부 (same-canvas)
 *   - compare 후보 2개 이상일 때 노출 (Delta-First Compare 와 동일 게이트)
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const SECTION_PATH = "src/app/_workbench/_components/sourcing-spec-compare-section.tsx";
const WORKBENCH_PATH = "src/app/_workbench/_components/sourcing-result-review-workbench.tsx";
const COMPARE_PAGE_PATH = "src/app/_workbench/compare/page.tsx";

describe("§11.381a — 스펙표 흡수: SourcingSpecCompareSection 신규 섹션", () => {
  it("섹션 컴포넌트 파일 존재 (신규 페이지/라우트 아닌 _components 섹션)", () => {
    expect(existsSync(join(REPO_ROOT, SECTION_PATH))).toBe(true);
  });

  it("SourcingSpecCompareSection export + 라우트 회귀 금지", () => {
    const src = read(SECTION_PATH);
    expect(src).toMatch(/export function SourcingSpecCompareSection/);
    // page-per-feature 회귀 금지: 섹션 파일이 page 컴포넌트가 아님
    expect(src).not.toMatch(/export default/);
  });

  it("pre-quote 5컬럼 (제품명·브랜드·카테고리·규격\\/용량·Grade) 전부 노출", () => {
    const src = read(SECTION_PATH);
    expect(src).toMatch(/제품명/);
    expect(src).toMatch(/브랜드/);
    expect(src).toMatch(/카테고리/);
    expect(src).toMatch(/규격\/용량/);
    expect(src).toMatch(/Grade/);
  });

  it("데이터 경로: /api/products/compare (compare 동일 경로 — canonical truth 보존)", () => {
    const src = read(SECTION_PATH);
    expect(src).toMatch(/\/api\/products\/compare/);
    expect(src).toMatch(/csrfFetch/);
  });

  it("견적 충전 컬럼 pre-quote 상태: '견적 대기' 명시 — fake data/placeholder success 금지", () => {
    const src = read(SECTION_PATH);
    expect(src).toMatch(/최저가/);
    expect(src).toMatch(/납기/);
    expect(src).toMatch(/견적 대기/);
    // canonical truth 보호: 가격을 UI 에서 임의 생성 금지
    expect(src).not.toMatch(/Math\.random/);
  });

  it("하이라이트 배지: 최저가(emerald) / 최단납기(blue) — compare 로직 이식", () => {
    const src = read(SECTION_PATH);
    expect(src).toMatch(/최저가[\s\S]{0,200}emerald|emerald[\s\S]{0,200}최저가/);
    expect(src).toMatch(/최단납기[\s\S]{0,200}blue|blue[\s\S]{0,200}최단납기/);
  });

  it("§11.302 색상 체계: amber/orange 금지", () => {
    const src = read(SECTION_PATH);
    expect(src).not.toMatch(/amber-|orange-/);
  });

  it("dead button 0: onClick 빈 핸들러/console.log 금지", () => {
    const src = read(SECTION_PATH);
    expect(src).not.toMatch(/onClick=\{\(\)\s*=>\s*\{\s*\}\}/);
    expect(src).not.toMatch(/console\.log/);
    expect(src).not.toMatch(/TODO|FIXME|placeholder/i);
  });
});

describe("§11.381a — same-canvas wiring: sourcing-result-review-workbench", () => {
  it("SourcingSpecCompareSection import + 렌더 (신규 라우트 0)", () => {
    const src = read(WORKBENCH_PATH);
    expect(src).toMatch(/import \{ SourcingSpecCompareSection \} from ["']\.\/sourcing-spec-compare-section["']/);
    expect(src).toMatch(/<SourcingSpecCompareSection/);
  });

  it("compare 후보 2개 이상 게이트 (Delta-First Compare 와 동일 조건)", () => {
    const src = read(WORKBENCH_PATH);
    // 스펙 비교 섹션은 compare_candidate 필터 결과를 props 로 받음
    expect(src).toMatch(/<SourcingSpecCompareSection[\s\S]{0,400}compareCandidates|compareCandidates[\s\S]{0,400}<SourcingSpecCompareSection/);
  });
});

describe("§11.381a — 회귀 0: sourcing-result-review-workbench 기존 보존", () => {
  it("DECISION_CONFIG 5종 라벨 보존 (비교 후보·요청 직행·제외·보류·차단)", () => {
    const src = read(WORKBENCH_PATH);
    expect(src).toMatch(/비교 후보/);
    expect(src).toMatch(/요청 직행/);
    expect(src).toMatch(/제외/);
    expect(src).toMatch(/보류/);
    expect(src).toMatch(/차단/);
  });

  it("recordReview handler + validation 게이트 보존", () => {
    const src = read(WORKBENCH_PATH);
    expect(src).toMatch(/const recordReview = useCallback/);
    expect(src).toMatch(/canRecordSourcingResultReview/);
    expect(src).toMatch(/disabled=\{!validation\?\.canRecordSourcingResultReview\}/);
  });

  it("handoff props 3종 보존 (CompareReopen·RequestReopen·ReturnToSearchReopen)", () => {
    const src = read(WORKBENCH_PATH);
    expect(src).toMatch(/onCompareReopenHandoff/);
    expect(src).toMatch(/onRequestReopenHandoff/);
    expect(src).toMatch(/onReturnToSearchReopen/);
  });

  it("기존 섹션 보존: Triage 요약·후보 그룹·Delta-First Compare·후보 검토", () => {
    const src = read(WORKBENCH_PATH);
    expect(src).toMatch(/선별\(Triage\) 요약/);
    expect(src).toMatch(/후보 그룹\(Candidate Group\)/);
    expect(src).toMatch(/변동 우선 비교\(Delta-First Compare\)/);
    expect(src).toMatch(/후보 검토/);
  });

  it("Sticky Dock CTA 보존: 결과 검토 저장·비교 재개·요청 재개", () => {
    const src = read(WORKBENCH_PATH);
    expect(src).toMatch(/결과 검토 저장/);
    expect(src).toMatch(/비교 재개\(Compare Reopen\)/);
    expect(src).toMatch(/요청 재개\(Request Reopen\)/);
  });

  it("engine 함수 import 보존 (canonical truth — engine 이 진실 소유)", () => {
    const src = read(WORKBENCH_PATH);
    expect(src).toMatch(/buildSourcingResultTriage/);
    expect(src).toMatch(/buildSourcingCandidateAssemblyPlan/);
    expect(src).toMatch(/validateSourcingResultReviewBeforeRecord/);
    expect(src).toMatch(/buildSourcingResultGroupPlan/);
    expect(src).toMatch(/buildSourcingCompareDeltaSummary/);
  });
});

describe("§11.381a — Phase B 완료: compare 라우트 retire (§11.381c 의도 반영 갱신)", () => {
  // Phase A 시점에는 "무손상 보존" 블록이었으나 §11.381c (호영님 b2/(가) 결정,
  // 2026-06-10) 로 compare 4라우트 retire — 부재 검증으로 전환.
  // 하이라이트·데이터 경로의 canonical 은 본 파일 상단 블록(소싱 섹션)이 검증.

  it("_workbench/compare/page.tsx retire (하이라이트는 소싱 섹션이 canonical)", () => {
    expect(existsSync(join(REPO_ROOT, COMPARE_PAGE_PATH))).toBe(false);
  });

  it("/app/compare re-export retire", () => {
    expect(existsSync(join(REPO_ROOT, "src/app/app/compare/page.tsx"))).toBe(false);
  });

  it("/compare 구형 페이지 retire", () => {
    expect(existsSync(join(REPO_ROOT, "src/app/compare/page.tsx"))).toBe(false);
  });
});
