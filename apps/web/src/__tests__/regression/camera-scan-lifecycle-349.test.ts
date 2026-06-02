/**
 * §11.349 (회귀) — 모바일 웹뷰 카메라 lifecycle 정정 sentinel
 *
 * 재고 스캔(@zxing/browser)에서 "중지" dead 정정:
 *   - decodeFromVideoDevice 반환 IScannerControls 캡처(controlsRef)
 *   - stopScanner = controls.stop() + video track 강제 종료 (구 reader.reset() 제거)
 *   - visibilitychange(백그라운드) + 언마운트 cleanup
 *   - "카메라 시작" 진입 경로 보존
 *   문자열 매칭은 toContain 사용(esbuild ts-loader 모호성 + NUL 회피).
 *   ⚠️ getUserMedia 실동작은 실기기 수동 검증(Phase 3) — 본 sentinel 은 wiring/정지 핸들러 보장만.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const PAGE = "src/app/dashboard/inventory/scan/page.tsx";

describe("§11.349 — 카메라 중지 lifecycle", () => {
  it("IScannerControls 캡처 (controlsRef = await decodeFromVideoDevice)", () => {
    const src = read(PAGE);
    expect(src).toContain("controlsRef.current = await reader.decodeFromVideoDevice");
  });

  it("stopScanner 가 controls.stop() 호출 (중지 실동작)", () => {
    const src = read(PAGE);
    expect(src).toContain("controlsRef.current?.stop()");
  });

  it("구 reader.reset() (미존재 API, dead 원인) 제거", () => {
    const src = read(PAGE);
    expect(src).not.toContain("readerRef.current.reset()");
  });

  it("방어적 video track 강제 종료 (카메라 LED 소등 보장)", () => {
    const src = read(PAGE);
    expect(src).toContain("getTracks().forEach((t) => t.stop())");
  });

  it("백그라운드(visibilitychange) + 언마운트 cleanup", () => {
    const src = read(PAGE);
    expect(src).toContain('addEventListener("visibilitychange"');
    expect(src).toContain('document.visibilityState === "hidden"');
  });
});

describe("§11.349 — 회귀 0 (시작 경로 보존)", () => {
  it("'카메라 시작' 진입 버튼 보존", () => {
    const src = read(PAGE);
    expect(src).toContain("카메라 시작");
    expect(src).toContain("onClick={startScanner}");
  });
});
