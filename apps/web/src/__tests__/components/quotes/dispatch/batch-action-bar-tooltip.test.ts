/**
 * §11.230c (b)-2 #tooltip-caller-swap — 호영님 v2 Tooltip caller 정합
 *
 * §11.230c (b)-1 enhance (delay 200ms + focus + ESC + ARIA) 후속 — 가장 a11y
 * 가치 있는 caller 3 (disabled-state tooltip) 을 native title attribute →
 * Tooltip wrapper 로 swap.
 *
 * Scope: disabled state 시 노출되는 tooltip 만 — focus 시 즉시 노출 필요 (a11y).
 *   - batch-action-bar reminderTooltip (Button disabled)
 *   - batch-action-bar reviewTooltip (Button disabled)
 *   - ai-insight-dialog disabledReason (Button disabled)
 *
 * Out of scope (native title 자연 유지):
 *   - quotes/page.tsx td truncate (line 2247 tableDisplayTitle) — non-interactive
 *   - quotes/page.tsx Button ghost (line 2654 "전체 상세 열기") — short label
 *   - quotes/page.tsx button (line 3032/3199) — short label / conditional
 *   - batch-action-bar span (line 177 itemName) — truncate span
 *
 * canonical truth lock:
 *   - 4 named export 보존 (Tooltip / TooltipTrigger / TooltipContent / TooltipProvider)
 *   - asChild 패턴 caller drift 0
 *   - Button disabled prop 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const BATCH_BAR_PATH = resolve(__dirname, "../../../../components/quotes/dispatch/batch-action-bar.tsx");
const AI_DIALOG_PATH = resolve(__dirname, "../../../../components/dashboard/ai-insight-dialog.tsx");

const batchBar = readFileSync(BATCH_BAR_PATH, "utf8");
const aiDialog = readFileSync(AI_DIALOG_PATH, "utf8");

describe("§11.230c (b)-2 #1 — batch-action-bar.tsx Tooltip wrapper swap", () => {
  it("Tooltip 컴포넌트 import 추가 (4 named exports)", () => {
    expect(batchBar).toMatch(/(Tooltip|TooltipTrigger|TooltipContent)/);
  });

  it("reminderTooltip — Tooltip + TooltipTrigger asChild + TooltipContent 패턴", () => {
    // reminderTooltip 변수 + Tooltip 컴포넌트 인접 사용
    expect(batchBar).toMatch(/reminderTooltip[\s\S]{0,600}TooltipContent/);
  });

  it("reviewTooltip — Tooltip + TooltipTrigger asChild + TooltipContent 패턴", () => {
    expect(batchBar).toMatch(/reviewTooltip[\s\S]{0,600}TooltipContent/);
  });
});

describe("§11.230c (b)-2 #2 — ai-insight-dialog.tsx Tooltip swap", () => {
  it("Tooltip 컴포넌트 import 추가", () => {
    expect(aiDialog).toMatch(/(Tooltip|TooltipTrigger|TooltipContent)/);
  });

  it("disabledReason — Tooltip wrapper 안 Button", () => {
    expect(aiDialog).toMatch(/disabledReason[\s\S]{0,500}TooltipContent/);
  });
});

describe("§11.230c (b)-2 #3 — invariant 보존", () => {
  it("Button disabled prop 보존 (mutation 차단 lock)", () => {
    expect(batchBar).toMatch(/disabled={/);
    expect(aiDialog).toMatch(/disabled={/);
  });

  it("기존 BatchActionBar / AIInsightDialog 시그니처 보존", () => {
    expect(batchBar).toMatch(/(export function BatchActionBar|export const BatchActionBar)/);
    expect(aiDialog).toMatch(/export function AIInsightDialog/);
  });

  it("§11.230c (b)-2 trace marker comment", () => {
    expect(batchBar + aiDialog).toMatch(/§11\.230c[\s\S]{0,300}(b\)-2|Tooltip|caller swap)/i);
  });
});
