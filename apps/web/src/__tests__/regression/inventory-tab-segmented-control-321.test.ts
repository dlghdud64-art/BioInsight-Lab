/**
 * §11.321 #inventory-tab-segmented-control — Regression sentinel
 *
 * 호영님 P1 (구 §11.316, 번호 충돌로 §11.321 매핑, 2026-05-29):
 *   재고 관리 탭 4개 (품목 관리 / 운영 현황 / 보관 위치 / 입출고 흐름)가 회색 텍스트 +
 *   파란 하단 인디케이터 1개로만 표시되어 시각 비중 매우 약함. 사용자가 다른 뷰 존재
 *   인지 못 함 → 기능 발견성 저하.
 *
 *   Fix: iOS/SaaS 세그먼트 컨트롤 스타일 — 회색 배경 컨테이너 + 활성 탭 흰 배경 (shadow-sm).
 *
 * 변경:
 *   - 컨테이너 bg-gray-100 rounded-lg p-1 (기존 border-b 제거)
 *   - 활성 탭: bg-white shadow-sm font-semibold + 아이콘 파란
 *   - 비활성 탭: bg-transparent text-gray-600 hover:bg-gray-200 + 아이콘 회색
 *   - 아이콘 크기 w-3.5 → w-5 (16px → 20px 변별력)
 *   - 하단 인디케이터 bar 제거 (활성 흰 배경이 대체)
 *   - "현재 화면" 배지 제거 (활성 시각 충분 redundant)
 *   - 모바일 flex-1 균등 분할
 *
 * canonical 보존 (회귀 가드):
 *   - 탭 4 key 보존 (manage / overview / storage-location / flow)
 *   - aria-current / aria-disabled / disabled / title 보존
 *   - min-h-[44px] WCAG SC 2.5.5 touch target 보존
 *   - testid 보존 (labaxis-inventory-manage-tab / overview-tab)
 *   - badge ("S" suffix / N건 rose-500) 보존
 *   - showLotIssueDecisionStrip 분기 logic 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PATH = "src/app/dashboard/inventory/inventory-content.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.321 — 재고 탭 세그먼트 컨트롤 스타일", () => {
  it("탭 컨테이너 = bg-gray-100 rounded-lg p-1 (세그먼트 박스)", () => {
    const src = read(PATH);
    // 탭 영역 컨테이너 클래스 (기존 border-b border-slate-200 → bg-gray-100 rounded-lg p-1)
    expect(src).toMatch(/data-testid="dashboard-inventory-tab-segmented"/);
    expect(src).toMatch(/bg-gray-100 rounded-lg p-1/);
  });

  it("활성 탭 = bg-white + shadow-sm + font-semibold + 아이콘 파란", () => {
    const src = read(PATH);
    expect(src).toMatch(/bg-white text-slate-900 shadow-sm font-semibold/);
    expect(src).toMatch(/text-blue-600/); // 활성 아이콘 색
  });

  it("비활성 탭 = bg-transparent text-gray-600 hover:bg-gray-200", () => {
    const src = read(PATH);
    expect(src).toMatch(/text-gray-600 hover:bg-gray-200/);
  });

  it("아이콘 크기 16px(w-3.5) → 20px(w-5) 변별력 증가", () => {
    const src = read(PATH);
    // 4 탭 아이콘 모두 w-5 h-5 적용 (기존 w-3.5 h-3.5)
    const tabIconMatches = src.match(/(ListFilter|LayoutGrid|MapPin|Truck) className="w-5 h-5"/g);
    expect(tabIconMatches?.length ?? 0).toBeGreaterThanOrEqual(4);
  });

  it("하단 인디케이터 bar 제거 (활성 흰 배경이 대체)", () => {
    const src = read(PATH);
    // 옛 인디케이터: <span absolute bottom-0 ... bg-blue-600 /> — 0
    expect(src).not.toMatch(/absolute bottom-0 left-2 right-2 h-0\.5 rounded-full bg-blue-600/);
  });

  it("'현재 화면' 배지 제거 (활성 시각 충분 — redundant)", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/data-testid="labaxis-inventory-manage-current-reason"/);
    expect(src).not.toMatch(/>현재 화면</);
  });

  it("canonical 보존 — 4 탭 key + aria + testid + WCAG touch", () => {
    const src = read(PATH);
    // 4 탭 key
    expect(src).toMatch(/key:\s*"manage"/);
    expect(src).toMatch(/key:\s*"overview"/);
    expect(src).toMatch(/key:\s*"storage-location"/);
    expect(src).toMatch(/key:\s*"flow"/);
    // aria
    // §11.358-1-4 — isActive 변수 추출 리팩토링(isActive = activeInventoryTab === tab.key) 반영.
    expect(src).toMatch(/aria-current=\{isActive \? "page" : undefined\}/);
    expect(src).toMatch(/aria-disabled=/);
    // testid 보존
    expect(src).toMatch(/data-testid=\{tab\.key === "overview" \? "labaxis-inventory-overview-tab"/);
    // WCAG touch target
    expect(src).toMatch(/min-h-\[44px\]/);
    // showLotIssueDecisionStrip 분기 보존
    expect(src).toMatch(/showLotIssueDecisionStrip\s*\?\s*"폐기 검토"\s*:\s*"운영 현황"/);
  });

  it("모바일 flex-1 균등 분할 (4 탭 폭 1/4 씩)", () => {
    const src = read(PATH);
    // 각 탭 button 에 flex-1 적용 (모바일 균등)
    expect(src).toMatch(/flex-1/);
  });

  it("badge(N건 rose-500) 보존 — §11.358-1 #4: 무의미 'S' suffix 제거", () => {
    const src = read(PATH);
    expect(src).toMatch(/bg-rose-500/);
    // §11.358-1 #4 — "운영 현황" 탭 뒤 raw "S" suffix 제거 (화면 "운영 현황s" stray token).
    //   §11.321 의 'S' suffix 보존은 본 정정으로 폐기 — raw label 금지 원칙 우선.
    expect(src).not.toMatch(/tab\.suffix/);
    expect(src).not.toMatch(/suffix:\s*showLotIssueDecisionStrip/);
  });
});
