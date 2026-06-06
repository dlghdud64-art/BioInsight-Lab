/**
 * §11.375 (RED→GREEN) — "양호" 가짜 판정 진짜화 (alignment 게이트)
 *
 * 증상(호영님, 모바일 웹): 스마트입고 카메라가 키보드·잡동사니 등 라벨 아닌 화면에도
 *   항상 "양호"(녹색). 가짜 신호 → §11.374 색변경 무의미 + 오입고 유발 위험.
 *
 * Root cause: assessFrameQuality overall = blur(선명) + lighting(조명) 2개만으로 good/warn/poor.
 *   alignment(중앙 ROI 엣지 집중 = 라벨 정합)는 계산되나 overall 에 미반영(Phase 1 "비차단").
 *   → 선명+조명만 OK 면 무엇이든 good. 키보드도 엣지 많아 blur>임계 → good.
 *
 * Fix: overall === "good" 이고 alignment.ok(중앙 정합) 미달이면 good→warn 격하 + reasons "정합_미흡".
 *   라벨이 프레임 중앙에 채워져야만 "양호". poor 는 약화 안 함.
 *
 * ⚠️ web↔mobile DUPLICATED 모듈 → 양쪽 동기화 검증.
 * 실제 임계(alignRaw>=0.5) 보정은 iOS 실기기 smoke(ops 최종). 여기선 게이트 로직 sentinel.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
const REPO_ROOT = join(APP_WEB_ROOT, "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const WEB = "apps/web/src/lib/ocr/capture-quality.ts";
const MOBILE = "apps/mobile/lib/ocr/capture-quality.ts";

const gateRe = /if \(overall === "good" && !alignment\.ok\)\s*\{\s*overall = "warn";\s*reasons\.push\("정합_미흡"\);/;

describe("§11.375 — alignment 게이트 (web)", () => {
  it("good 인데 alignment 미달 → warn 격하 + 정합_미흡 사유", () => {
    const src = read(WEB);
    expect(src).toMatch(gateRe);
  });

  it("게이트는 overall/captureConfidence 계산 이후, return 직전", () => {
    const src = read(WEB);
    const gateIdx = src.search(gateRe);
    const confIdx = src.indexOf("captureConfidence < poorFloor");
    const retIdx = src.indexOf("return { blur, lighting, alignment");
    expect(confIdx).toBeGreaterThan(0);
    expect(gateIdx).toBeGreaterThan(confIdx);
    expect(retIdx).toBeGreaterThan(gateIdx);
  });
});

describe("§11.375 — alignment 게이트 (mobile DUPLICATED 동기화)", () => {
  it("mobile 도 동일 게이트 보유", () => {
    const src = read(MOBILE);
    expect(src).toMatch(gateRe);
  });
});

describe("§11.375 — 회귀 0 (기존 판정 보존)", () => {
  it("web: blur/조명 failCount·poorFloor·alignment 계산 보존", () => {
    const src = read(WEB);
    expect(src).toMatch(/const failCount = \(blurOk \? 0 : 1\) \+ \(lightingOk \? 0 : 1\)/);
    expect(src).toMatch(/captureConfidence < poorFloor.*overall = "poor"/);
    expect(src).toMatch(/alignmentScore/);
    expect(src).toMatch(/ok: alignRaw >= 0\.5/);
  });

  it("mobile: 동일 구조 보존", () => {
    const src = read(MOBILE);
    expect(src).toMatch(/const failCount = \(blurOk \? 0 : 1\) \+ \(lightingOk \? 0 : 1\)/);
    expect(src).toMatch(/ok: alignRaw >= 0\.5/);
  });
});
