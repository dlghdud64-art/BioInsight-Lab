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
    expect(src).toMatch(/aria-valuemax=\{\s*itemCount\s*\}/);
  });

  it("SENT/RESPONDED 분기 — PENDING hide", () => {
    // condition: quote.status === "SENT" || quote.status === "RESPONDED"
    expect(src).toMatch(/quote\.status\s*===\s*["']SENT["'][\s\S]{0,40}quote\.status\s*===\s*["']RESPONDED["']/);
  });

  it("회신 N/M 라벨 (responseCount/itemCount)", () => {
    expect(src).toMatch(/회신\s*\{responseCount\}\/\{itemCount\}/);
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
