/**
 * §11.252c — FAB 72px+ sweep (모든 화면 FAB BottomNav 위 안전 마진 일관).
 *
 * 호영님 spec: 모든 화면 FAB 하단 마진 최소 72px (BottomNav h-14 = 56px + 16px).
 *
 * sweep 대상:
 *   1. BarcodeScanFab (이미 §11.251c 에서 bottom-[72px] 적용 — invariant 검증).
 *   2. OperationalBriefFloatingEntry (bottom-6 = 24px → 모바일 bottom-[72px]).
 *
 * canonical truth lock:
 *   - 두 FAB 모두 lg+ 에서는 기존 bottom 보존 (데스크탑 BottomNav 없음).
 *   - aria-label / aria-expanded / onClick / Sparkles + ScanLine icon 모두 보존.
 *   - lg:hidden (BarcodeScanFab) 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const SCAN_FAB_PATH = resolve(__dirname, "../../components/layout/barcode-scan-fab.tsx");
const BRIEF_FAB_PATH = resolve(__dirname, "../../components/operational-brief/floating-entry.tsx");
const scanCode = safeRead(SCAN_FAB_PATH);
const briefCode = safeRead(BRIEF_FAB_PATH);

describe("§11.252c #1 — BarcodeScanFab invariant (§11.251c bottom-[72px] 보존)", () => {
  it("BarcodeScanFab bottom-[72px] 보존 (§11.251c lock)", () => {
    expect(scanCode).toMatch(/bottom-\[72px\]/);
  });

  it("BarcodeScanFab lg:hidden 보존 (모바일 only)", () => {
    expect(scanCode).toMatch(/lg:hidden/);
  });

  it("BarcodeScanFab rounded-full + right-4 보존", () => {
    expect(scanCode).toMatch(/rounded-full/);
    expect(scanCode).toMatch(/right-4/);
  });
});

describe("§11.252c #2 — OperationalBriefFloatingEntry 모바일 bottom 72px+", () => {
  it("§11.252c trace marker 명시", () => {
    expect(briefCode).toMatch(/§11\.252c|11\.252c/);
  });

  it("모바일 bottom-[72px] 또는 bottom-20 (≥72px) 강제", () => {
    // bottom-[72px] (정확 spec) 또는 bottom-20 (80px, ≥72px 정합) 허용.
    expect(briefCode).toMatch(/bottom-\[72px\]|bottom-20/);
  });

  it("데스크탑 lg:bottom-6 또는 lg+ override 보존 (회귀 0)", () => {
    // 모바일 default 72px+ + lg+ 에서 기존 bottom-6 (24px) 보존.
    expect(briefCode).toMatch(/lg:bottom-(6|\[?\d+(?:px|rem)?\]?)/);
  });

  it("right-4 모바일 또는 right-6 보존 (가로 마진)", () => {
    expect(briefCode).toMatch(/right-(4|6)/);
  });
});

describe("§11.252c — invariant 보존", () => {
  it("OperationalBriefFloatingEntry — aria-label '운영 브리핑' 보존", () => {
    expect(briefCode).toMatch(/운영\s*브리핑/);
  });

  it("OperationalBriefFloatingEntry — aria-expanded + aria-controls 보존", () => {
    expect(briefCode).toMatch(/aria-expanded/);
    expect(briefCode).toMatch(/aria-controls/);
  });

  it("OperationalBriefFloatingEntry — Sparkles icon 보존", () => {
    expect(briefCode).toMatch(/Sparkles/);
  });

  it("OperationalBriefFloatingEntry — rounded-full + z-40 보존", () => {
    expect(briefCode).toMatch(/rounded-full/);
    expect(briefCode).toMatch(/z-40/);
  });
});
