/**
 * §11.230c (b)-1 #tooltip-component-enhance — 호영님 v2 spec dedicated Tooltip
 *
 * 호영님 P1 spec (정식 런칭 전 a11y 강화):
 *   현재 caller 들은 native `title=` attribute 사용 — browser default tooltip
 *   (delay ~1s + 키보드 focus 시 미노출 + ESC 닫기 미지원).
 *   shadcn 패턴 tooltip.tsx 가 이미 존재하나 hover delay/focus/ESC/ARIA 부재.
 *
 *   Phase 1 (이 batch): tooltip.tsx 자체 enhance — delay 200ms + focus 노출 +
 *     ESC 닫기 + role="tooltip" + aria-describedby chain.
 *   Phase 2 (별도 batch): caller 7 swap — quotes/page.tsx 3 + batch-action-bar 3 +
 *     AIInsightDialog 1.
 *
 * canonical truth lock:
 *   - Tooltip / TooltipTrigger / TooltipContent / TooltipProvider 4 named exports 보존
 *   - asChild 패턴 보존
 *   - z-50 + bg/border 시각 보존
 *
 * Minimal-Diff:
 *   - useState(isOpen) → useState + useRef(timer) + delay 200ms
 *   - onMouseEnter/Leave → enter (setTimeout) / leave (clear + setOpen false)
 *   - onFocus/onBlur 핸들러 추가 (keyboard nav 정합)
 *   - document.keydown Escape → close
 *   - role="tooltip" + tooltipId (useId) + aria-describedby trigger forward
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const TOOLTIP_PATH = resolve(__dirname, "../../../components/ui/tooltip.tsx");
const tooltip = readFileSync(TOOLTIP_PATH, "utf8");

describe("§11.230c (b)-1 #1 — hover delay (200ms)", () => {
  it("setTimeout 으로 delay 도입 (200ms 또는 TOOLTIP_DELAY_MS sentinel)", () => {
    // hover 시 즉시 open 이 아닌 setTimeout 으로 지연
    expect(tooltip).toMatch(/setTimeout/);
    expect(tooltip).toMatch(/(200|TOOLTIP_DELAY_MS|DELAY_MS)/);
  });

  it("mouseLeave 시 clearTimeout (pending timer cancel)", () => {
    expect(tooltip).toMatch(/clearTimeout/);
  });

  it("useRef 으로 timer reference 보관 (re-render survive)", () => {
    expect(tooltip).toMatch(/useRef/);
  });
});

describe("§11.230c (b)-1 #2 — focus 시 노출 (keyboard nav)", () => {
  it("onFocus 핸들러 — setIsOpen(true) 즉시", () => {
    // delay 없이 focus 시 즉시 노출 (키보드 사용자 마찰 ↓)
    expect(tooltip).toMatch(/onFocus/);
  });

  it("onBlur 핸들러 — setIsOpen(false)", () => {
    expect(tooltip).toMatch(/onBlur/);
  });
});

describe("§11.230c (b)-1 #3 — ESC 닫기", () => {
  it("document.keydown Escape → setIsOpen(false)", () => {
    expect(tooltip).toMatch(/(Escape|"Escape")/);
    expect(tooltip).toMatch(/setIsOpen\(\s*false\s*\)/);
  });

  it("useEffect cleanup — removeEventListener (memory leak 차단)", () => {
    expect(tooltip).toMatch(/removeEventListener/);
  });
});

describe("§11.230c (b)-1 #4 — ARIA role + aria-describedby chain", () => {
  it("TooltipContent role=\"tooltip\" 명시", () => {
    expect(tooltip).toMatch(/role="tooltip"/);
  });

  it("useId 으로 tooltipId 생성 (TooltipContent 의 id + trigger 의 aria-describedby)", () => {
    expect(tooltip).toMatch(/useId/);
  });

  it("aria-describedby trigger 에 forward (asChild + native button 둘 다)", () => {
    expect(tooltip).toMatch(/aria-describedby/);
  });
});

describe("§11.230c (b)-1 #5 — invariant 보존 (canonical API)", () => {
  it("4 named exports 보존 (TooltipProvider/Tooltip/TooltipTrigger/TooltipContent)", () => {
    expect(tooltip).toMatch(/export\s*\{\s*TooltipProvider\s*,\s*Tooltip\s*,\s*TooltipTrigger\s*,\s*TooltipContent\s*\}/);
  });

  it("asChild 패턴 보존 (TooltipTrigger forwardRef + cloneElement)", () => {
    expect(tooltip).toMatch(/asChild/);
    expect(tooltip).toMatch(/cloneElement/);
  });

  it("z-50 + bg/border 시각 보존 (caller drift 0)", () => {
    expect(tooltip).toMatch(/z-50/);
    expect(tooltip).toMatch(/(rounded-md|border-bd|shadow-md)/);
  });

  it("§tooltip-contrast-fix — 흰 글자(text-slate-50)는 다크 배경과 페어 (white-on-white 회귀 0)", () => {
    // bg-pn(=#FFFFFF) + text-slate-50(흰색) = 흰 글자 안 보임 버그 재발 차단.
    expect(tooltip).toMatch(/bg-\[#1a1a1e\]/); // 다크 배경 복원
    expect(tooltip).not.toMatch(/bg-pn[^a-z-]/); // 흰색 패널 토큰 배경 금지
  });

  it("§11.230c (b)-1 trace marker comment", () => {
    expect(tooltip).toMatch(/§11\.230c[\s\S]{0,200}(tooltip|delay|focus|ARIA|aria)/i);
  });
});
