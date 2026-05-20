/**
 * §11.269b #comparison-footer-button-parity — "닫기" + "견적 요청 만들기"
 *   버튼 높이 통일 (호영님 spec)
 *
 * 호영님 spec:
 *   "닫기 — 텍스트 링크 스타일, 높이 약 20px / 견적 요청 만들기 — 채움 버튼,
 *   높이 약 48px. 같은 행에 있는데 수직 정렬이 안 맞아서 닫기가 위로 붙어 있음."
 *   → "닫기"를 아웃라인 버튼으로 변경하여 동일 높이 통일.
 *
 * Fix (minimum diff, variant swap):
 *   기존: <Button variant="ghost" size="sm" ...>닫기</Button>
 *         (ghost = bg 0 + border 0 → 시각적 height 작음)
 *   신규: <Button variant="outline" size="sm" ...>닫기</Button>
 *         (outline = border + 동일 size="sm" → 시각 height 정합)
 *
 * canonical truth lock:
 *   - onClick={() => onOpenChange(false)} 보존
 *   - "닫기" 라벨 보존
 *   - max-md:flex-1 (모바일 1/3 너비) 보존
 *   - 견적 요청 만들기 CTA (size="sm" + bg-blue-600 + max-md:flex-[2]) 보존
 *   - Footer flex items-center justify-between gap-3 보존
 *   - §11.269a Sheet block + state 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MODAL_PATH = resolve(__dirname, "../../app/_workbench/_components/comparison-modal.tsx");
const modal = readFileSync(MODAL_PATH, "utf8");

describe("§11.269b #1 — Footer 버튼 높이 통일", () => {
  it("§11.269b trace marker comment 존재", () => {
    expect(modal).toMatch(/§11\.269b/);
  });

  it("\"닫기\" Button variant=\"outline\" 적용 (시각 height 정합)", () => {
    // <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>닫기</Button>
    expect(modal).toMatch(
      /<Button variant="outline" size="sm" onClick=\{\(\) => onOpenChange\(false\)\}[\s\S]{0,200}닫기/,
    );
  });

  it("\"닫기\" Button variant=\"ghost\" 제거 (시각 height 불일치 원인)", () => {
    // 기존 ghost variant 가 닫기 button 위치에 없어야 함
    expect(modal).not.toMatch(
      /<Button variant="ghost" size="sm" onClick=\{\(\) => onOpenChange\(false\)\}[\s\S]{0,200}닫기/,
    );
  });
});

describe("§11.269b #2 — invariant 보존 (canonical truth)", () => {
  it("onClick={() => onOpenChange(false)} 보존", () => {
    expect(modal).toMatch(/onClick=\{\(\) => onOpenChange\(false\)\}/);
  });

  it("\"닫기\" 라벨 + max-md:flex-1 보존", () => {
    expect(modal).toMatch(/max-md:flex-1[\s\S]{0,100}닫기/);
  });

  it("견적 요청 만들기 CTA (bg-blue-600 + max-md:flex-[2]) 보존", () => {
    expect(modal).toMatch(/bg-blue-600 hover:bg-blue-700 text-white[\s\S]{0,200}max-md:flex-\[2\]/);
  });

  it("Footer flex items-center justify-between gap-3 보존", () => {
    expect(modal).toMatch(
      /Footer[\s\S]{0,300}flex items-center justify-between rounded-b-lg gap-3/,
    );
  });

  it("§11.269a Sheet block (data-testid=\"comparison-strategy-sheet\") 보존", () => {
    expect(modal).toMatch(/data-testid="comparison-strategy-sheet"/);
  });

  it("§11.269a showStrategySheet useState 보존", () => {
    expect(modal).toMatch(
      /const\s+\[showStrategySheet,\s+setShowStrategySheet\]\s*=\s*useState\(\s*false\s*\)/,
    );
  });
});
