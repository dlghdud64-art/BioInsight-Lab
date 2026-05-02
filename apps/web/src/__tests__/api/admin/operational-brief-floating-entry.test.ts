/**
 * §11.175 #operational-brief-floating-entry-and-density-up
 *
 * RED guard for:
 *   1. shared OperationalBriefFloatingEntry component (slate-900 + sparkle + label).
 *   2. inbox ContextPanel density-up (560 width, p-6, text-base summary, 2x2 metric
 *      grid with text-3xl numbers, amber risk alert).
 *   3. inbox auto_open URL param handler (?auto_open=p0 → priority sort + first hydrate).
 *   4. dashboard page wires the floating entry → /dashboard/inbox?auto_open=p0.
 *
 * Source-level guards (readFileSync + regex). Hook integration tests run in their
 * own files (vitest dom).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.175 floating entry — shared component", () => {
  const PATH = "src/components/operational-brief/floating-entry.tsx";

  it("파일 존재", () => {
    expect(existsSync(join(REPO_ROOT, PATH))).toBe(true);
  });

  it("Slate-900 고대비 + 화이트 텍스트", () => {
    const src = read(PATH);
    expect(src).toMatch(/bg-slate-900/);
    expect(src).toMatch(/text-white/);
  });

  it("\"운영 브리핑\" 텍스트 라벨 명시", () => {
    const src = read(PATH);
    expect(src).toMatch(/운영 브리핑/);
  });

  it("sparkle / Sparkles icon 노출", () => {
    const src = read(PATH);
    expect(src).toMatch(/Sparkles|sparkle/i);
  });

  it("우하단 fixed 위치 + z-40", () => {
    const src = read(PATH);
    expect(src).toMatch(/fixed/);
    expect(src).toMatch(/bottom-/);
    expect(src).toMatch(/right-/);
    expect(src).toMatch(/z-40/);
  });

  it("터치 타겟 ≥ h-12 (label-bearing FAB)", () => {
    const src = read(PATH);
    expect(src).toMatch(/h-1[2-6]/);
  });

  it("aria-label / aria-expanded 접근성 wiring", () => {
    const src = read(PATH);
    expect(src).toMatch(/aria-label/);
  });

  it("named export OperationalBriefFloatingEntry", () => {
    const src = read(PATH);
    expect(src).toMatch(/export\s+function\s+OperationalBriefFloatingEntry|export\s+\{[^}]*OperationalBriefFloatingEntry/);
  });
});

// §11.175 inbox ContextPanel density-up + auto_open describe block 은
// §11.191 운영작업함 hidden redirect 로 자연 drop (inbox/page.tsx → 27 line redirect-only).
// dashboard 메인이 priority list + popup 으로 흡수.

describe("§11.175 dashboard 진입점 wire (§11.181 popup default 로 marshall 됨)", () => {
  const PATH = "src/app/dashboard/page.tsx";

  it("OperationalBriefFloatingEntry import + 사용", () => {
    const src = read(PATH);
    expect(src).toMatch(/OperationalBriefFloatingEntry/);
  });

  it("§11.181 — onClick prop 없음 (popup context default 사용)", () => {
    const src = read(PATH);
    const m = src.match(/<OperationalBriefFloatingEntry[\s\S]*?\/>/);
    expect(m).not.toBeNull();
    expect(m![0]).not.toMatch(/\bonClick\s*=/);
  });
});
