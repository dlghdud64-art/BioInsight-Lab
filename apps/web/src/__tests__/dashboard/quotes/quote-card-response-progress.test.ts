/**
 * §11.217 Phase 4 — RED test
 *
 * Goal: quote card 의 readiness strip 직전에 회신 수집 progress bar 추가.
 *       회신 카운트 시각화 — N/M responses 진행률 (PENDING 제외, SENT/RESPONDED 만).
 *
 * canonical truth lock:
 *   - condition: quote.status === "SENT" || quote.status === "RESPONDED" (PENDING hide).
 *   - value: responseCount / itemCount (0~100%).
 *   - color: 0% slate-200, partial blue-500, full(>=) emerald-500.
 *   - aria-valuenow / aria-valuemin / aria-valuemax — a11y.
 *   - "회신 N/M" 라벨 + bar + 100% 시 "완료" 라벨.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const src = readFileSync(PAGE_PATH, "utf8");

describe("§11.217 Phase 4 — quote card 회신 수집 progress bar", () => {
  it("role='progressbar' element 존재", () => {
    expect(src).toMatch(/role=["']progressbar["']/);
  });

  it("aria-valuenow / aria-valuemax — responseCount / itemCount 기반", () => {
    expect(src).toMatch(/aria-valuenow=\{\s*responseCount\s*\}/);
    /* 승계 §quote-reply-denominator (2026-09-25 · 호영님 판정) — 분모가 품목 수에서 **요청한 공급사 수**로 바뀌었다.
       「회신 1/1」 은 「보낸 공급사 중 몇 곳이 답했나」 이고, 품목 수로 나누면
       품목 3개를 1곳에 보낸 견적이 「1/3」 이 된다(호영님). 명제(진행률이 회신 수를 보여준다)는 불변.
       분모 축의 단언은 regression/quote-reply-denominator.test.ts 가 든다. */
    expect(src).toMatch(/aria-valuemax=\{\s*replyTotal\s*\}/);
  });

  it("발송 전 hide · 발송 후 노출", () => {
    /* 승계 §quote-reply-count-split (2026-09-25 · 호영님 실측) — 명제는 「발송 전에는 회신 진행률을 보여주지 않는다」 다.
       구 판본이 상태 목록을 핀하는 바람에 COMPLETED·PURCHASED 가 **발송 전과 같은 취급**을 받았다.
       판정을 이름 있는 함수로 옮기고, 그 함수가 무엇을 발송 전으로 세는지까지 고정한다. */
    expect(src).toMatch(/function hasBeenSent\(/);
    expect(src).toMatch(/NOT_YET_SENT_STATUSES[\s\S]{0,120}new Set\(\["PENDING",\s*"PARSED"\]\)/);
    expect(src).toMatch(/hasBeenSent\(quote\) && replyTotal > 0/);
  });

  it("회신 N/M 라벨 (responseCount/itemCount)", () => {
    expect(src).toMatch(/회신\s*\{responseCount\}\/\{replyTotal\}/);
  });

  it("color tone — 0% slate / partial blue / full(>=) emerald", () => {
    expect(src).toMatch(/bg-slate-200|bg-slate-100/);
    expect(src).toMatch(/bg-blue-500/);
    expect(src).toMatch(/bg-emerald-500/);
  });

  it("§11.217 Phase 4 cluster trace marker", () => {
    expect(src).toMatch(/§11\.217 Phase 4|회신 수집 progress|회신 진행률/);
  });
});
