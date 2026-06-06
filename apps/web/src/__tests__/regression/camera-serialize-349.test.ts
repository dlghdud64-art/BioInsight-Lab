/**
 * §11.349 (RED→GREEN) — 카메라 lifecycle 직렬화 + H2 전면 강등 방어
 *
 * 증상: LabelScannerModal 카메라 진입 시 후면 카메라 간헐 미작동(검은 화면).
 *   재진입하면 켜질 때 있음(비결정).
 *
 * Root cause (bug-hunter TR):
 *   H1 — deps([open,step,manualMode,uploadMode]) 빠른 토글 시 effect 재실행 →
 *        getRearCameraStream()(getUserMedia 체인) 동시 2회 in-flight →
 *        device 점유 충돌(검은 화면). cleanup 의 stopCamera 는 in-flight 시점
 *        stream===null 이라 못 막음(순서 결함).
 *   H2 — 4차 fallback video:true 가 전면(facingMode "user") 강등 시 성공 위장.
 *
 * Fix:
 *   - acquireGenRef(세대) + acquiringRef(이전 promise await)로 동시 in-flight 직렬화.
 *   - superseded/cancelled 획득 stream 즉시 track.stop.
 *   - 획득 track facingMode==="user" → stop + setCameraError(성공 위장 제거).
 *
 * web vitest sentinel(readFileSync+regex). 구현 전이므로 RED.
 * (sandbox vitest 는 @rollup 네이티브 부재로 실행 불가 — node regex 직접 검증으로 대체,
 *  최종 진위는 Read 도구 권위.)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const MODAL = "src/components/inventory/LabelScannerModal.tsx";

describe("§11.349 — getUserMedia 동시 in-flight 직렬화 (H1)", () => {
  it("acquisition 세대 ref 존재", () => {
    const src = read(MODAL);
    expect(src).toMatch(/acquireGenRef/);
  });

  it("이전 acquisition promise 를 await 하는 직렬화 가드 존재", () => {
    const src = read(MODAL);
    // 모듈/컴포넌트 스코프 acquiringRef + 이전 promise await 패턴
    expect(src).toMatch(/acquiringRef/);
    expect(src).toMatch(/await\s+(?:prev|acquiringRef\.current)/);
  });

  it("superseded 획득 stream 은 즉시 track.stop (세대/cancelled 불일치 시)", () => {
    const src = read(MODAL);
    // 세대 비교 가드 후 stream track stop
    expect(src).toMatch(/acquireGenRef\.current/);
    expect(src).toMatch(/getTracks\(\)\.forEach\(\(t\)\s*=>\s*t\.stop\(\)\)/);
  });
});

describe("§11.349 — H2 전면(facingMode user) 강등 방어", () => {
  it("획득 track getSettings().facingMode 검사", () => {
    const src = read(MODAL);
    expect(src).toMatch(/getSettings\(\)/);
    expect(src).toMatch(/facingMode/);
  });

  it('전면("user") 감지 시 setCameraError 로 성공 위장 제거', () => {
    const src = read(MODAL);
    expect(src).toMatch(/===\s*["']user["']/);
    // 전면 분기 안에서 cameraError 설정 + 후면 미획득 메시지
    expect(src).toMatch(/setCameraError/);
    expect(src).toMatch(/후면 카메라를 찾지 못했습니다/);
  });
});

describe("§11.349 — 회귀 0 (기존 lifecycle 보존)", () => {
  it("cleanup return: cancelled 플래그 + stopCamera 보존", () => {
    const src = read(MODAL);
    expect(src).toMatch(/cancelled\s*=\s*true/);
    expect(src).toMatch(/const stopCamera = \(\) =>/);
    expect(src).toMatch(/if \(stream\) stream\.getTracks\(\)\.forEach\(\(t\) => t\.stop\(\)\)/);
  });

  it("후면 4단계 fallback util(§11.355-C) 호출 보존", () => {
    const src = read(MODAL);
    expect(src).toMatch(/getRearCameraStream\(\)/);
  });

  it("effect deps array 보존 (open/step/manualMode/uploadMode/runScan)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/\}, \[open, step, manualMode, uploadMode, runScan\]\);/);
  });

  it("기존 카메라 모드 게이트 조건 보존", () => {
    const src = read(MODAL);
    expect(src).toMatch(
      /open && step === "upload" && !manualMode && uploadMode === "camera"/,
    );
  });
});
