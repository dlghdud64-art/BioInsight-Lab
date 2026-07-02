/**
 * §11.380 Phase 3 — scan.tsx frame processor 배선 + 햅틱 + 가이드 색전환 sentinel
 *
 * 라벨 모드 라이브 텍스트 검출(ML Kit) → lock 상태머신 → 가이드 emerald + 햅틱 1회 +
 *   촬영 강조. §11.375 경계(라이브=신호, 진위=§11.378) 및 dead-end 금지(idle 도 촬영 가능) 강제.
 *
 * sentinel(readFileSync+regex). 검출 로직 자체는 label-lock-380(실 import 단위) + 실기기 QA.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", ".."); // apps/web
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const SCAN = "../mobile/app/scan.tsx";

describe("§11.380 Phase 3 — frame processor 배선", () => {
  it("ML Kit useTextRecognition + scanText 프레임 처리", () => {
    const src = read(SCAN);
    expect(src).toMatch(/useTextRecognition\(\{\s*language:\s*"latin"\s*\}\)/);
    expect(src).toMatch(/scanText\(frame\)/);
  });

  it("useFrameProcessor + runAtTargetFps throttle + worklet", () => {
    const src = read(SCAN);
    expect(src).toMatch(/useFrameProcessor/);
    expect(src).toMatch(/runAtTargetFps\(5/);
    expect(src).toMatch(/"worklet"/);
  });

  it("Worklets.createRunOnJS 로 worklet→JS 상태머신 호출", () => {
    const src = read(SCAN);
    expect(src).toMatch(/Worklets\.createRunOnJS/);
    expect(src).toMatch(/stepLock\(/);
  });

  it("frameProcessor 는 라벨 모드 스캔 중에만(바코드 모드는 codeScanner)", () => {
    const src = read(SCAN);
    expect(src).toMatch(/frameProcessor=\{[\s\S]*scanMode === "label" && state === "scanning"/);
    expect(src).toMatch(/codeScanner=\{scanMode === "barcode"/);
  });

  it("전이 1회 햅틱(haptic true 일 때만 impactAsync)", () => {
    const src = read(SCAN);
    expect(src).toMatch(/if \(haptic\)/);
    expect(src).toMatch(/Haptics\.impactAsync/);
  });

  it("가이드 색전환 + 촬영 버튼 강조(locked=emerald)", () => {
    const src = read(SCAN);
    expect(src).toMatch(/isLocked \? "border-emerald-400"/);
    expect(src).toMatch(/isLocked \? "bg-emerald-500" : "bg-white"/);
  });
});

describe("§11.380 Phase 3 — 경계/회귀", () => {
  it("§11.375 경계: 라이브 UI 에 '정합' 단어 0 (주석 제외 render)", () => {
    const src = read(SCAN);
    // §scan-mobile-align-glow 주석(글로우 advisory 설명)은 제외 — 라이브 UI text 만 검증(false-positive 방지).
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");
    expect(stripped).not.toMatch(/정합/);
  });

  it("dead-end 금지: 촬영 버튼 disabled 는 isBusy 만(idle 여도 수동 촬영 가능)", () => {
    const src = read(SCAN);
    // §11.380 VisionCamera: onPress 는 wrapped(() => handleCaptureLabel(accumulate)), disabled 는 isBusy 만.
    expect(src).toMatch(/onPress=\{\(\) => handleCaptureLabel\(accumulate\)\}/);
    expect(src).toMatch(/disabled=\{isBusy\}/);
  });

  it("§11.378 후단 게이트 보존(회귀 0)", () => {
    const src = read(SCAN);
    expect(src).toMatch(/receiveBlocked/);
    expect(src).toMatch(/lowConf && !productNameDirty/);
  });

  it("바코드 모드 전환 시 lock 초기화(라벨 신호 잔존 방지)", () => {
    const src = read(SCAN);
    expect(src).toMatch(/scanMode !== "label"/);
    expect(src).toMatch(/initialLockRuntime\(\)/);
  });
});
