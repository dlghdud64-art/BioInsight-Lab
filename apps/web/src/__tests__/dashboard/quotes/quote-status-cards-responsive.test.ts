/**
 * §11.248c #quote-status-cards-responsive — 호영님 P0 견적 관리 #3 상태 요약 5 카드 반응형
 *
 * 호영님 spec:
 *   - 설명 텍스트 line-clamp 2 (✅ 이미 적용)
 *   - 5 → 3 → 2 → 1 단계적 반응형 (현재: mobile 가로 스크롤 → sm 2 → md 3 → lg 5)
 *   - 숫자(8, 4, 0, 0)와 라벨 우선순위 — 잘리지 않도록
 *   - 카드 min-width 확보 (✅ 이미 min-w-[140px] 적용)
 *
 * 진정한 gap (Phase 0 audit):
 *   (1) 모바일 가로 스크롤 (flex + overflow-x-auto + snap-x) → grid grid-cols-1
 *       (호영님 spec "<800px 1열" 정합)
 *   (2) label `truncate` 제거 → wrap 허용 (좁은 너비에서 잘림 0)
 *
 * canonical truth lock:
 *   - 5 카드 onClick (setStatusFilter) / count / filter key / icon / tone 모두 보존
 *   - line-clamp-2 보존 (호영님 spec 이미 적용)
 *   - min-w-[140px] sm:min-w-0 보존
 *   - animate-stagger-up + animationDelay 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.248c #1 — 모바일 1열 grid (호영님 spec <800px 1열 정합)", () => {
  it("KPI Control Cards 외부 컨테이너 grid-cols-1 적용 (모바일)", () => {
    // 호영님 spec: 5 → 3 → 2 → 1 단계적 반응형
    // grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5
    expect(page).toMatch(
      /KPI Control Cards[\s\S]{0,300}grid-cols-1[\s\S]{0,300}sm:grid-cols-2[\s\S]{0,300}md:grid-cols-3[\s\S]{0,300}lg:grid-cols-5/,
    );
  });

  it("기존 모바일 가로 스크롤 (flex + overflow-x-auto + snap-x) 제거", () => {
    // KPI Control Cards 영역에서 가로 스크롤 패턴 제거
    expect(page).not.toMatch(
      /KPI Control Cards[\s\S]{0,400}flex gap-2\.5 overflow-x-auto snap-x/,
    );
  });
});

describe("§11.248c #2 — label 잘림 방지 (truncate 제거)", () => {
  it("KPI card label className 에 truncate 제거 (호영님 spec '우선순위 배치')", () => {
    // 발송 대기 / 회신 추적 등 5 label 의 wrapping span 에 truncate 없음
    expect(page).not.toMatch(
      /text-\[11px\] font-semibold text-slate-500 uppercase tracking-wider truncate/,
    );
  });
});

describe("§11.248c #3 — invariant 보존", () => {
  it("5 카드 label 보존 (발송 대기 / 회신 추적 / 비교 검토 필요 / 승인 / 예외 처리 / 발주 전환 가능)", () => {
    expect(page).toMatch(/label:\s*"발송 대기"/);
    expect(page).toMatch(/label:\s*"회신 추적"/);
    expect(page).toMatch(/label:\s*"비교 검토 필요"/);
    expect(page).toMatch(/label:\s*"승인 \/ 예외 처리"/);
    expect(page).toMatch(/label:\s*"발주 전환 가능"/);
  });

  it("line-clamp-2 보존 (호영님 spec — 이미 적용)", () => {
    expect(page).toMatch(/line-clamp-2/);
  });

  it("min-w-[140px] sm:min-w-0 보존 (카드 min-width — 이미 적용)", () => {
    expect(page).toMatch(/min-w-\[140px\]\s+sm:min-w-0/);
  });

  it("setStatusFilter onClick + filter key 보존 (canonical state)", () => {
    expect(page).toMatch(/setStatusFilter\(prev => prev === filter \? "all" : filter\)/);
  });

  it("animate-stagger-up + animationDelay 보존", () => {
    expect(page).toMatch(/animate-stagger-up/);
    expect(page).toMatch(/animationDelay:\s*`\$\{idx \* 80\}ms`/);
  });

  it("§11.248c trace marker comment", () => {
    expect(page).toMatch(/§11\.248c[\s\S]{0,300}(상태 카드|status card|반응형|grid|단계적)/i);
  });
});
