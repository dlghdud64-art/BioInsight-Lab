/**
 * §11.316 #signin-spline-immediate-mount — Regression sentinel
 *
 * 호영님 P1 (2026-05-29):
 *   로그인 페이지(/auth/signin) 의 Spline 3D 배경이 진입 후 약 3~5초 지연되어
 *   체감 매우 늦음. 원인:
 *   - setTimeout(800) "auth card 먼저, 그 다음 3D fade-in" 의도적 지연
 *   - opacity transition 2.4s (fade 자체도 길어 체감 가중)
 *
 *   Fix (즉시감 + 자연스러움):
 *   - setTimeout 제거 → 페이지 진입 즉시 dynamic import + Spline.load 시작
 *   - opacity transition 2.4s → 0.6s
 *   - cleanup race-condition 안전 위해 `disposed` flag 추가 (load 도중 unmount 대비)
 *
 * canonical truth 보존:
 *   - Spline scene URL 변경 0
 *   - reducedMotion 분기 보존
 *   - app.play() autoplay 보존
 *   - dispose cleanup 보존 (clearTimeout → disposed flag 로 패턴 swap)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PATH = "src/app/auth/signin/page.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.316 — Spline 3D 즉시 mount + 짧은 fade", () => {
  it("setTimeout(800) 지연 제거 (즉시 import + load)", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/setTimeout\([^,]+,\s*800\)/);
    expect(src).not.toMatch(/Delayed mount/);
  });

  it("opacity transition 0.6s ease (2.4s 잔존 0)", () => {
    const src = read(PATH);
    expect(src).toMatch(/transition:\s*"opacity 0\.6s ease"/);
    expect(src).not.toMatch(/transition:\s*"opacity 2\.4s ease"/);
  });

  it("§11.316 즉시 mount 주석 + 짧은 fade 명시", () => {
    const src = read(PATH);
    expect(src).toMatch(/§11\.316/);
    expect(src).toMatch(/즉시 mount/);
    expect(src).toMatch(/fade 2\.4s.*0\.6s/);
  });

  it("cleanup race-condition 안전 — disposed flag 패턴", () => {
    const src = read(PATH);
    expect(src).toMatch(/let disposed = false/);
    expect(src).toMatch(/disposed = true/);
    expect(src).toMatch(/if \(disposed/);
  });

  it("canonical 보존 — Spline scene URL + autoplay + reducedMotion", () => {
    const src = read(PATH);
    // scene URL (asset) 변경 0
    expect(src).toMatch(/prod\.spline\.design\/Nd9Ab5oDbi1kcWsV\/scene\.splinecode/);
    // autoplay loop
    expect(src).toMatch(/app\.play\(\)/);
    // reducedMotion 분기
    expect(src).toMatch(/prefers-reduced-motion/);
    expect(src).toMatch(/reducedMotion/);
    // opacity loaded 분기 (loaded ? 0.88 : 0)
    expect(src).toMatch(/opacity:\s*loaded\s*\?\s*0\.88\s*:\s*0/);
  });

  it("dispose cleanup 보존 (app?.dispose 잔존)", () => {
    const src = read(PATH);
    expect(src).toMatch(/app\?\.dispose\?\.\(\)/);
  });
});
