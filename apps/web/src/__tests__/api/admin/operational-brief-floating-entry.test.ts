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

describe("§11.175 inbox ContextPanel density-up", () => {
  const PATH = "src/app/dashboard/inbox/page.tsx";

  it("패널 너비 560", () => {
    const src = read(PATH);
    expect(src).toMatch(/w-\[560px\]/);
  });

  it("패널 padding p-6 (이전 p-4 흡수)", () => {
    const src = read(PATH);
    // ContextPanel 내부 root container 가 p-6 사용
    expect(src).toMatch(/className="p-6\s|className="[^"]*\sp-6\s/);
  });

  it("상황 요약 본문 text-base (이전 text-xs 흡수)", () => {
    const src = read(PATH);
    // brief-summary section 내부에 text-base + leading-relaxed
    expect(src).toMatch(/id="brief-summary"[\s\S]*?text-base[\s\S]*?leading-relaxed/);
  });

  it("핵심 근거 2x2 metric grid + MetricCell (text-3xl 수치는 shared component 책임)", () => {
    const src = read(PATH);
    // §11.176 — MetricCell + text-3xl 은 shared 로 추출, inbox 는 grid-cols-2 안에서 MetricCell 사용
    expect(src).toMatch(/id="brief-facts"[\s\S]*?grid-cols-2[\s\S]*?MetricCell/);
  });

  it("OPERATIONAL BRIEFING eyebrow", () => {
    const src = read(PATH);
    expect(src).toMatch(/OPERATIONAL\s+BRIEFING/);
  });

  it("LAST UPDATED 상대 시간 표시", () => {
    const src = read(PATH);
    expect(src).toMatch(/LAST\s+UPDATED/i);
  });
});

describe("§11.175 inbox auto_open URL handler", () => {
  const PATH = "src/app/dashboard/inbox/page.tsx";

  it("auto_open searchParam 파싱", () => {
    const src = read(PATH);
    expect(src).toMatch(/auto_open/);
  });

  it("priority sort 후 첫 row 자동 hydrate (P0 우선)", () => {
    const src = read(PATH);
    // useEffect 또는 useMemo 안에서 setSelectedItemId(autoTarget)
    expect(src).toMatch(/setSelectedItemId\(\s*[a-zA-Z_$][\w$]*(?:\.id|\.id\s*\?\?\s*null)\s*\)/);
  });

  it("OperationalBriefFloatingEntry import + 사용", () => {
    const src = read(PATH);
    expect(src).toMatch(/OperationalBriefFloatingEntry/);
  });
});

describe("§11.175 dashboard 진입점 wire", () => {
  const PATH = "src/app/dashboard/page.tsx";

  it("OperationalBriefFloatingEntry import + 사용", () => {
    const src = read(PATH);
    expect(src).toMatch(/OperationalBriefFloatingEntry/);
  });

  it("clicking entry → /dashboard/inbox?auto_open=p0", () => {
    const src = read(PATH);
    expect(src).toMatch(/auto_open=p0|\?auto_open=p0/);
  });
});
