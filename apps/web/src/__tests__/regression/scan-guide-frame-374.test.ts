/**
 * §11.374 (RED→GREEN) — 스캔 가이드 프레임 통일 (Scope A)
 *
 * 배경: 인앱 스캔 2종(라벨=정적 inset 프레임 white/70, QR=코너 4마커+스캔라인 blue)이
 *   제각각. 거래명세서는 native input capture 라 통일 대상 외(scope 제외).
 *
 * Fix: 공통 components/inventory/ScanGuideFrame.tsx 추출 — blue accent 코너 마커
 *   + 선택적 스캔라인(showScanLine). 라벨/QR 가 같은 컴포넌트 사용 → 시각 통일.
 *
 * 시각 회귀는 단위테스트 한계 → sentinel(readFileSync+regex)로 컴포넌트 추출 +
 *   사용처 wiring + 회귀 0(testid/scanning 조건)만 검증. 최종은 ops 실검증.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const FRAME = "src/components/inventory/ScanGuideFrame.tsx";
const LABEL = "src/components/inventory/LabelScannerModal.tsx";
const QR = "src/components/inventory/QRScanner.tsx";

describe("§11.374 — ScanGuideFrame 공통 컴포넌트", () => {
  it("ScanGuideFrame.tsx 파일 존재 + export", () => {
    expect(existsSync(join(APP_WEB_ROOT, FRAME))).toBe(true);
    const src = read(FRAME);
    expect(src).toMatch(/export function ScanGuideFrame/);
  });

  it("blue accent 코너 마커 + showScanLine prop", () => {
    const src = read(FRAME);
    expect(src).toMatch(/border-blue-400/);
    expect(src).toMatch(/showScanLine/);
    // 코너 4마커 구조
    expect(src).toMatch(/"tl"|"tr"|"bl"|"br"/);
  });

  it("testId prop 을 data-testid 로 부착(E2E hook 보존)", () => {
    const src = read(FRAME);
    expect(src).toMatch(/data-testid=\{testId\}/);
  });
});

describe("§11.374 — 라벨/QR 가 ScanGuideFrame 사용", () => {
  it("LabelScannerModal import + 사용", () => {
    const src = read(LABEL);
    expect(src).toMatch(/import \{ ScanGuideFrame \} from "\.\/ScanGuideFrame"/);
    expect(src).toMatch(/<ScanGuideFrame/);
  });

  it("QRScanner import + 사용(showScanLine)", () => {
    const src = read(QR);
    expect(src).toMatch(/import \{ ScanGuideFrame \} from "\.\/ScanGuideFrame"/);
    expect(src).toMatch(/<ScanGuideFrame[^>]*showScanLine/);
  });
});

describe("§11.374 — 회귀 0", () => {
  it("라벨 camera-guide-frame testid prop 전달 보존(E2E hook)", () => {
    const src = read(LABEL);
    expect(src).toMatch(/testId="camera-guide-frame"/);
  });

  it("QR scanning state 노출 조건 보존", () => {
    const src = read(QR);
    expect(src).toMatch(/state === "scanning" &&/);
  });
});
