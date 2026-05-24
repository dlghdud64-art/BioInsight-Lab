/**
 * §11.291 #safety-confirm-now-scroll-highlight — 호영님 P0 dead button fix.
 *
 * 호영님 P0 spec 옵션 A:
 *   - /dashboard/safety 긴급 안전 경고 배너의 "지금 확인하기" 버튼이
 *     setSelectedItemId 만 호출 → 시각 신호 부재 = dead button 인지
 *   - AI 권장 처리 큐 섹션으로 scroll + immediate_action item 하이라이트
 *     (3초 후 자동 해제) 추가
 *   - queueItems wrapper 에 id="ai-action-queue" + item 에
 *     data-priority="urgent" (immediate_action 한정) 추가
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(
  resolve(__dirname, "../../app/dashboard/safety/page.tsx"),
  "utf8",
);

describe("§11.291 — 안전 관리 \"지금 확인하기\" scroll + highlight", () => {
  it("§11.291 trace marker + safety-confirm-now-scroll-highlight comment", () => {
    expect(PAGE).toMatch(/§11\.291/);
    expect(PAGE).toMatch(/safety-confirm-now-scroll-highlight/);
  });

  it('"지금 확인하기" 버튼 onClick 에 scrollIntoView + querySelectorAll urgent', () => {
    expect(PAGE).toMatch(/지금 확인하기/);
    expect(PAGE).toMatch(/document\.getElementById\("ai-action-queue"\)/);
    expect(PAGE).toMatch(/scrollIntoView\(\{\s*behavior:\s*"smooth"/);
    expect(PAGE).toMatch(
      /document\.querySelectorAll[\s\S]{0,80}\[data-priority='urgent'\]/,
    );
  });

  it("urgent item 에 ring-2 ring-red-500 animate-pulse class 추가 + 3초 후 자동 해제", () => {
    expect(PAGE).toMatch(
      /classList\.add\("ring-2",\s*"ring-red-500",\s*"animate-pulse"\)/,
    );
    expect(PAGE).toMatch(/setTimeout\(/);
    expect(PAGE).toMatch(
      /classList\.remove\("ring-2",\s*"ring-red-500",\s*"animate-pulse"\)/,
    );
    expect(PAGE).toMatch(/\},\s*3000\)/);
  });

  it("AI 권장 처리 큐 wrapper 에 id=\"ai-action-queue\" anchor", () => {
    expect(PAGE).toMatch(/id="ai-action-queue"/);
    expect(PAGE).toMatch(/AI 권장 처리 큐/);
  });

  it("queueItems item 에 data-priority={isUrgent ? \"urgent\" : \"normal\"} 분기", () => {
    expect(PAGE).toMatch(
      /q\.classification\s*===\s*"immediate_action"/,
    );
    expect(PAGE).toMatch(
      /data-priority=\{isUrgent \? "urgent" : "normal"\}/,
    );
  });

  it("기존 setSelectedItemId(firstImmediate.id) detail panel trigger 보존 (회귀 0)", () => {
    expect(PAGE).toMatch(/setSelectedItemId\(firstImmediate\.id\)/);
  });

  it("기존 queueItems useMemo filter (compliant/monitor_only 제외, slice 5) 보존", () => {
    expect(PAGE).toMatch(/classification !== "compliant"/);
    expect(PAGE).toMatch(/classification !== "monitor_only"/);
    expect(PAGE).toMatch(/\.slice\(0, 5\)/);
  });
});
