/**
 * §quotes-surface-canvas-b (호영님 2026-07-04) — 견적관리 개선 B(회색 캔버스) surface 구분.
 * 배경 회색 + 카드 그림자 + 커스텀 체크박스(blue) + 표 헤더/행 + 발송대기 배지. 기능·데이터 무변경.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const PAGE = readFileSync(join(__dirname, "..", "..", "app/dashboard/quotes/page.tsx"), "utf8");

describe("§quotes-surface-canvas-b — 면 구분 토큰", () => {
  it("① 회색 캔버스 배경 #e9edf4", () => {
    expect(PAGE).toMatch(/bg-\[#e9edf4\]/);
  });
  it("② 카드 그림자 강화(스펙 shadow)", () => {
    expect(PAGE).toMatch(/shadow-\[0_1px_2px_rgba\(15,23,42,0\.05\),0_4px_12px_rgba\(15,23,42,0\.06\)\]/);
  });
  it("③ 커스텀 체크박스 blue #2563eb (violet 제거)", () => {
    expect(PAGE).toMatch(/peer-checked:bg-\[#2563eb\]/);
    expect(PAGE).not.toMatch(/peer-checked:bg-violet-600/);
    // thead 전체선택 체크박스(state-ternary, non-peer)까지 포함 — 표 내 violet 잔재 0 잠금.
    expect(PAGE).not.toMatch(/bg-violet-600/);
  });
  it("④ 표 헤더 #f8fafc + 선택행 파란 틴트·좌측 바", () => {
    expect(PAGE).toMatch(/bg-\[#f8fafc\] border-b border-\[#e2e8f0\] sticky/);
    expect(PAGE).toMatch(/bg-blue-600\/5 shadow-\[inset_3px_0_0_#2563eb\]/);
  });
  it("⑥ 발송 대기 배지 #dce8ff/#1d4ed8/#bcd3fb", () => {
    expect(PAGE).toMatch(/발송 대기[\s\S]*?bg-\[#dce8ff\][\s\S]*?text-\[#1d4ed8\][\s\S]*?border-\[#bcd3fb\]/);
  });
  it("⑦ 풀블리드 — 회색 캔버스 full-width 외부 래퍼 + max-w-7xl 중앙 내부(초광폭 흰 여백 0)", () => {
    // 회색은 full-width 외부 래퍼에만(max-w-7xl 과 같은 요소 결합 금지 — 결합이 좌우 흰 여백 원인).
    expect(PAGE).toMatch(/<div className="w-full bg-\[#e9edf4\] min-h-full">/);
    expect(PAGE).not.toMatch(/max-w-7xl[^"]*bg-\[#e9edf4\]/);
    expect(PAGE).not.toMatch(/bg-\[#e9edf4\][^"]*max-w-7xl/);
  });
  it("⑧ #5(a) 견적케이스 톤 — 품목명 굵게 #0b1220 + RFQ 모노 태그", () => {
    expect(PAGE).toMatch(/font-bold text-\[#0b1220\]/);
    expect(PAGE).toMatch(/rounded bg-slate-100 px-1 text-\[10px\] font-mono text-slate-500/);
  });
});
