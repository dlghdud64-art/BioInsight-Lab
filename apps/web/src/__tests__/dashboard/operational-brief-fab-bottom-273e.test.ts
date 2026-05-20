/**
 * §11.273e #operational-brief-fab-bottom — 운영 브리핑 FAB bottom 72px → 144px
 *   (호영님 P0 spec, 재고 sticky bar / 카드 겹침 회피)
 *
 * 호영님 spec:
 *   - 구매 운영, 재고 관리 모두에서 "✦ 운영 브리핑" 버튼이 하단에 고정
 *   - 하단 탭 바 + 재고 빠른 액션 bar + Trypsin-EDTA 카드의 "위험" 배지 + 화살표(>)
 *     와 시각 겹침
 *   - "FAB 을 우측으로 이동하되 하단 탭 바와 최소 72px 간격"
 *
 * Root cause:
 *   - §11.252c 가 BottomNav h-14 (56px) + 16px margin = bottom-[72px] 설정
 *   - inventory-content.tsx 가 추가 sticky bar (fixed bottom-0, ~80px) → 운영 브리핑
 *     FAB (bottom-72px) 가 sticky bar 바로 위 → 시각 겹침
 *   - 재고 카드의 ChevronRight (우측 끝) 와 FAB (right-4) 가 동일 viewport x 좌표 stack
 *
 * Fix (minimum diff, 1 file 1 라인 swap):
 *   - OperationalBriefFloatingEntry className `bottom-[72px]` → `bottom-[144px]`
 *     (BottomNav 56 + sticky bar 80 + 8px safe = 144px 안전 간격)
 *   - 데스크탑 `lg:bottom-6` 그대로 (lg 에서는 sticky bar 없음)
 *   - right-4 / z-40 / h-12 px-5 등 모든 다른 속성 보존
 *
 * canonical truth lock:
 *   - OperationalBriefFloatingEntry handleClick / popup.open / disabled / aria-label
 *     / Sparkles icon 보존
 *   - 데스크탑 lg:bottom-6 lg:right-6 보존
 *   - z-40 / right-4 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FLOATING = readFileSync(
  resolve(__dirname, "../../components/operational-brief/floating-entry.tsx"),
  "utf8",
);

describe("§11.273e #1 — FAB bottom 좌표 144px swap", () => {
  it("§11.273e trace marker comment 존재", () => {
    expect(FLOATING).toMatch(/§11\.273e/);
  });

  it("FAB className 에 bottom-[144px] 적용", () => {
    expect(FLOATING).toMatch(/bottom-\[144px\]/);
  });

  it("기존 bottom-[72px] 모바일 분기 제거", () => {
    // 모바일 default (lg: 분기 없는 곳) 에 bottom-[72px] 가 있으면 fail
    expect(FLOATING).not.toMatch(/"fixed bottom-\[72px\]/);
  });
});

describe("§11.273e #2 — invariant 보존 (canonical truth)", () => {
  it("데스크탑 lg:bottom-6 lg:right-6 보존", () => {
    expect(FLOATING).toMatch(/lg:bottom-6 lg:right-6/);
  });

  it("모바일 right-4 보존", () => {
    expect(FLOATING).toMatch(/right-4/);
  });

  it("z-40 보존 (mobile bottom sheet z-50 보다 아래)", () => {
    expect(FLOATING).toMatch(/z-40/);
  });

  it("h-12 px-5 (touch target 48px) 보존", () => {
    expect(FLOATING).toMatch(/h-12 px-5/);
  });

  it("Sparkles icon + \"운영 브리핑\" 라벨 보존", () => {
    expect(FLOATING).toMatch(/Sparkles/);
    expect(FLOATING).toMatch(/운영 브리핑/);
  });

  it("popup.open / handleClick / disabled / aria-label 보존", () => {
    expect(FLOATING).toMatch(/popup\.open\(\)/);
    expect(FLOATING).toMatch(/handleClick/);
    expect(FLOATING).toMatch(/aria-label=/);
  });
});
