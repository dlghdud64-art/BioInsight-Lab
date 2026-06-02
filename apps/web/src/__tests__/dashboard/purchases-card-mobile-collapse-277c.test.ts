/**
 * §11.277c #purchases-card-mobile-collapse — 구매 운영 카드 모바일 2단계 접힘/펼침
 *   (§11.264g 패턴 reuse, 호영님 P0 spec, §11.277 cluster 마지막 sub-spec).
 *
 * 호영님 spec (대화 메시지, 2026-05-22):
 *   현재 구매 운영 카드 모바일에서 정보 밀도 과다 — 카드 1개 viewport 60%+ 점유.
 *   §11.264g 패턴 (견적 카드 컴팩트화) reuse — 모바일 한정 default collapsed,
 *   "더 보기" tap 시 펼침. 데스크탑 (sm+) 변경 0.
 *
 *   접힌 상태: 배지 row + 제목 + "막힘 확인" + "다음 단계" block
 *   펼친 상태: + itemSummary 본문 + 우측 AI/가격/CTA panel
 *
 * Fix (minimum diff, 1 file UI swap, 5 spot):
 *   1. lucide-react import — ChevronDown / ChevronUp 추가
 *   2. PurchasesPage state — expandedCardIds: Set<string> + toggleCardExpand
 *      useCallback (line ~140)
 *   3. filteredItems.map 분기 — `const isExpanded = expandedCardIds.has(item.id)`
 *      추가 (hasBlocker 다음)
 *   4. itemSummary <p> className — `${isExpanded ? "block" : "hidden sm:block"}`
 *      추가 (모바일 collapse)
 *   5. 우측 AI 정보 panel className — `${isExpanded ? "flex" : "hidden"} sm:flex`
 *      (기존 `hidden sm:flex` swap)
 *   6. 카드 body 마지막 모바일 toggle button (sm:hidden, w-full,
 *      data-testid="purchases-card-mobile-toggle", aria-expanded, Chevron 아이콘)
 *
 * canonical truth lock:
 *   - 배지 row / 제목 / "막힘 확인" / "다음 단계" block 변경 0
 *   - §11.277b "다음 단계" 직접 onClick + role=button + aria-label + tabIndex 보존
 *   - §11.277a 모바일 1줄 요약 바 (sm:hidden) 보존
 *   - rail panel (line ~870) 변경 0
 *   - selectedId state 변경 0
 *   - 데스크탑 (sm+) 카드 layout 변경 0
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(
  resolve(__dirname, "../../app/dashboard/purchases/page.tsx"),
  "utf8",
);

describe("§11.277c — 모바일 카드 2단계 접힘/펼침", () => {
  it("§11.277c trace marker comment 존재", () => {
    expect(PAGE).toMatch(/§11\.277c/);
  });

  it("lucide-react import — ChevronDown / ChevronUp 추가", () => {
    expect(PAGE).toMatch(/from\s+["']lucide-react["']/);
    expect(PAGE).toMatch(/ChevronDown/);
    expect(PAGE).toMatch(/ChevronUp/);
  });

  it("expandedCardIds: Set<string> state 정의", () => {
    expect(PAGE).toMatch(
      /const\s+\[expandedCardIds,\s*setExpandedCardIds\]\s*=\s*useState<Set<string>>\(new Set\(\)\)/,
    );
  });

  it("toggleCardExpand useCallback 정의 (Set immutable update)", () => {
    expect(PAGE).toMatch(/const\s+toggleCardExpand\s*=\s*useCallback/);
    expect(PAGE).toMatch(/setExpandedCardIds\(prev/);
    expect(PAGE).toMatch(/new Set\(prev\)/);
  });

  it("filteredItems.map 안 isExpanded const (per-card 조회)", () => {
    expect(PAGE).toMatch(
      /const\s+isExpanded\s*=\s*expandedCardIds\.has\(item\.id\)/,
    );
  });

  it("§11.284c — itemSummary <p> 모바일 collapse 분기 supersede (UI 본문 제거)", () => {
    // §11.277c 원안: isExpanded ? "block" : "hidden sm:block" 분기.
    // §11.284c 후속 (호영님 P0 본문 텍스트 제거) 으로 itemSummary <p> 자체 제거.
    // isExpanded 토글 button 자체는 보존 (우측 AI panel collapse 분기 유지).
    expect(PAGE).not.toMatch(
      /isExpanded\s*\?\s*["']block["']\s*:\s*["']hidden sm:block["']/,
    );
  });

  it("우측 AI panel className 모바일 collapse 분기", () => {
    // `${isExpanded ? "flex" : "hidden"} sm:flex`
    expect(PAGE).toMatch(
      /isExpanded\s*\?\s*["']flex["']\s*:\s*["']hidden["']\}\s*sm:flex/,
    );
  });

  it("기존 `hidden sm:flex` 직접 사용 부재 (조건부 swap 정합)", () => {
    expect(PAGE).not.toMatch(/className="hidden sm:flex flex-col items-end/);
  });

  it("모바일 toggle button data-testid 존재", () => {
    expect(PAGE).toMatch(/data-testid="purchases-card-mobile-toggle"/);
  });

  it("모바일 toggle button sm:hidden (데스크탑 노출 0)", () => {
    expect(PAGE).toMatch(
      /data-testid="purchases-card-mobile-toggle"[\s\S]{0,400}sm:hidden/,
    );
  });

  it("모바일 toggle button aria-expanded={isExpanded}", () => {
    expect(PAGE).toMatch(
      /data-testid="purchases-card-mobile-toggle"[\s\S]{0,400}aria-expanded=\{isExpanded\}/,
    );
  });

  it("모바일 toggle button onClick → toggleCardExpand(item.id) + e.stopPropagation", () => {
    expect(PAGE).toMatch(
      /data-testid="purchases-card-mobile-toggle"[\s\S]{0,800}e\.stopPropagation\(\)[\s\S]{0,200}toggleCardExpand\(item\.id\)/,
    );
  });

  it("모바일 toggle button Chevron icon 분기 (펼친 ChevronUp / 접힌 ChevronDown)", () => {
    expect(PAGE).toMatch(
      /isExpanded\s*\?\s*<ChevronUp[\s\S]{0,200}<ChevronDown/,
    );
  });

  it("모바일 toggle button 한글 라벨 (펼친 '접기' / 접힌 '더 보기')", () => {
    expect(PAGE).toMatch(/isExpanded\s*\?\s*["']접기["']\s*:\s*["']더 보기["']/);
  });
});

describe("§11.277c — invariant 보존 (canonical truth)", () => {
  it("§11.277b '다음 단계' 직접 onClick CTA 보존", () => {
    expect(PAGE).toMatch(/data-testid="purchases-card-next-step-cta"/);
    expect(PAGE).toMatch(/role="button"[\s\S]{0,400}aria-label/);
  });

  it("§11.277a 모바일 KPI 1줄 요약 바 (sm:hidden) 보존", () => {
    expect(PAGE).toMatch(/data-testid="purchases-kpi-mobile-summary-bar"/);
  });

  it("§11.352 발주 인계 label 보존 (PO 전환 부재, §11.277d 재명명)", () => {
    expect(PAGE).toMatch(/발주 인계/);
    expect(PAGE).not.toMatch(/PO 전환/);
  });

  it("rail panel selectedItem 분기 보존", () => {
    expect(PAGE).toMatch(/selectedItem\s*&&\s*\(\(\)\s*=>/);
  });

  it("setSelectedId / selectedId state 보존 (선택 동작 unchanged)", () => {
    expect(PAGE).toMatch(/const\s+\[selectedId,\s*setSelectedId\]/);
    expect(PAGE).toMatch(/setSelectedId\(item\.id\)/);
  });

  it("filteredItems.map 안 '막힘 확인' / '다음 단계' block 보존", () => {
    expect(PAGE).toMatch(/막힘 확인/);
    expect(PAGE).toMatch(/다음 단계/);
  });

  it("§11.284c — itemSummary UI 본문 제거 + data source 보존 (search filter 잔존)", () => {
    // §11.277c 원안: itemSummary line-clamp-2 패턴 (isExpanded 시 block).
    // §11.284c 후속 (호영님 P0 spec "본문 텍스트 제거") 으로 UI 본문 표시 자체
    // 제거. 단 itemSummary data source 보존 (search filter 안 사용).
    expect(PAGE).not.toMatch(/\{item\.itemSummary\}/); // UI 본문 표시 제거
  });
});
