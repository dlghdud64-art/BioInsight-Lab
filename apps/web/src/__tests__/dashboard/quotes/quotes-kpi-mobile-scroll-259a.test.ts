/**
 * §11.259a #quotes-kpi-mobile-scroll — 호영님 spec 견적 관리 모바일 #1 + #5
 *
 * 정책 변경: §11.248c "<800px 1열 grid" → §11.259a "모바일 가로 스크롤 방안 A".
 *
 * 호영님 spec (방안 A 권장):
 *   - KPI 5 카드 모바일 가로 스크롤 (compact, snap-x mandatory)
 *   - 0건 카드 회색 톤다운 (opacity / text-slate-300) — 시각 우선순위 낮춤
 *   - 데스크톱 (sm+) grid 정합 보존
 *
 * §11.248c supersede:
 *   - quote-status-cards-responsive.test.ts 의 mobile grid-cols-1 강제 assertion
 *     은 §11.259a 가 supersede. 해당 테스트의 충돌 it 두 개는 skip 처리.
 *
 * canonical truth lock:
 *   - 5 카드 onClick (setStatusFilter) / count / filter key / icon / tone 보존
 *   - line-clamp-2 보존
 *   - sm+ grid grid-cols-2 / md:grid-cols-3 / lg:grid-cols-5 보존
 *   - animate-stagger-up + animationDelay 보존
 *   - 0건 톤다운 logic (isZero opacity-50, text-slate-300, text-slate-400) 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.259a #1 — 모바일 가로 스크롤 (방안 A)", () => {
  it("KPI Control Cards 외부 컨테이너 mobile flex + sm grid 단계 분기", () => {
    // 모바일: flex (가로 1행), sm+: grid-cols-2/3/5 (기존 보존)
    expect(page).toMatch(
      /KPI Control Cards[\s\S]{0,400}\bflex\b[\s\S]{0,200}sm:grid[\s\S]{0,200}sm:grid-cols-2[\s\S]{0,200}md:grid-cols-3[\s\S]{0,200}lg:grid-cols-5/,
    );
  });

  it("KPI Control Cards 외부 컨테이너 overflow-x-auto sm:overflow-visible", () => {
    expect(page).toMatch(
      /KPI Control Cards[\s\S]{0,400}overflow-x-auto[\s\S]{0,200}sm:overflow-visible/,
    );
  });

  it("KPI Control Cards 외부 컨테이너 snap-x snap-mandatory (모바일 스냅)", () => {
    expect(page).toMatch(
      /KPI Control Cards[\s\S]{0,500}snap-x[\s\S]{0,80}snap-mandatory/,
    );
  });

  it("KPI 카드 min-w-[140px] sm:min-w-0 + shrink-0 + snap-start 보존 (방안 A)", () => {
    expect(page).toMatch(/min-w-\[140px\]\s+sm:min-w-0/);
    expect(page).toMatch(/shrink-0\s+sm:shrink/);
    expect(page).toMatch(/snap-start/);
  });

  it("§11.259a trace marker comment", () => {
    expect(page).toMatch(/§11\.259a/);
  });
});

describe("§11.259a #5 — 0건 카드 회색 톤다운 (시각 우선순위 낮춤)", () => {
  it("isZero 변수 정의 보존 (!isLoading && count === 0)", () => {
    expect(page).toMatch(/const isZero = !isLoading && count === 0/);
  });

  it("isZero opacity 톤다운 (opacity-50) 보존", () => {
    expect(page).toMatch(/isZero[\s\S]{0,80}opacity-50/);
  });

  it("isZero 숫자 text-slate-300 톤다운 보존", () => {
    expect(page).toMatch(/isZero\s*\?\s*"text-slate-300"\s*:\s*"text-slate-900"/);
  });

  it("isZero insight text-slate-400 톤다운 보존", () => {
    expect(page).toMatch(/isZero\s*\?\s*"text-slate-400"\s*:\s*"text-slate-500"/);
  });
});

describe("§11.259a — invariant 보존 (canonical truth)", () => {
  it("5 카드 label 보존", () => {
    expect(page).toMatch(/label:\s*"발송 대기"/);
    expect(page).toMatch(/label:\s*"회신 추적"/);
    expect(page).toMatch(/label:\s*"비교 검토 필요"/);
    expect(page).toMatch(/label:\s*"승인 \/ 예외 처리"/);
    expect(page).toMatch(/label:\s*"발주 전환 가능"/);
  });

  it("line-clamp-2 보존 (호영님 spec 이미 적용)", () => {
    expect(page).toMatch(/line-clamp-2/);
  });

  it("setStatusFilter onClick + filter key 보존 (canonical state)", () => {
    expect(page).toMatch(/setStatusFilter\(prev => prev === filter \? "all" : filter\)/);
  });

  it("animate-stagger-up + animationDelay 보존", () => {
    expect(page).toMatch(/animate-stagger-up/);
    expect(page).toMatch(/animationDelay:\s*`\$\{idx \* 80\}ms`/);
  });

  it("데스크톱 grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 보존", () => {
    expect(page).toMatch(/sm:grid-cols-2/);
    expect(page).toMatch(/md:grid-cols-3/);
    expect(page).toMatch(/lg:grid-cols-5/);
  });
});
