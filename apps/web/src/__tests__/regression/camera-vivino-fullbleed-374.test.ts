/**
 * §11.374 Vivino 고도화 (RED) — 카메라 풀블리드 + 정합 색변화
 *
 * 호영님: Vivino 식 풀스크린 카메라 + 라벨이 프레임에 정합하면 색 변화.
 * 재사용: LabelScanner `quality.overall`(good/warn/poor) 판정 이미 존재 → ScanGuideFrame
 *   코너 색에 매핑(신규 ML 0, 시각화만).
 *
 * 계약:
 *  - ScanGuideFrame status?: "idle"|"good"|"warn" → 코너/스캔라인 색
 *      good=emerald-500, warn=yellow-500, idle/미지정=blue-400(하위호환, §11.374 보존).
 *  - LabelScanner: ScanGuideFrame 에 status={quality.overall 매핑} 전달.
 *  - 풀블리드: 카메라 컨테이너 aspect-[4/3] 작은 박스 → 모달 큰 높이(h-[68vh]).
 *
 * 이 시점 미구현(ScanGuideFrame status 없음·LabelScanner 전달 없음·aspect-[4/3] 잔존) → RED.
 * 시각/정합 색변화·자동촬영은 단위테스트 한계 → sentinel + iOS 실기기 smoke(ops 최종).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const FRAME = "src/components/inventory/ScanGuideFrame.tsx";
const LABEL = "src/components/inventory/LabelScannerModal.tsx";
const QR = "src/components/inventory/QRScanner.tsx";

describe("§11.374-vivino Phase 2 — ScanGuideFrame status 색변화", () => {
  it("status prop(idle/good/warn) 시그니처", () => {
    const src = read(FRAME);
    expect(src).toMatch(/status\?:\s*["']idle["']\s*\|\s*["']good["']\s*\|\s*["']warn["']/);
  });

  it("good=emerald-500, warn=yellow-500 코너 색 분기(§11.302 신호등)", () => {
    const src = read(FRAME);
    expect(src).toMatch(/border-emerald-500/);
    expect(src).toMatch(/border-yellow-500/);
  });

  it("하위호환: status 미지정/idle 은 기존 blue-400 보존", () => {
    const src = read(FRAME);
    expect(src).toMatch(/border-blue-400/);
  });
});

describe("§11.374-vivino Phase 3 — LabelScanner status 전달 + 풀블리드", () => {
  it("ScanGuideFrame 에 quality.overall 기반 status 전달", () => {
    const src = read(LABEL);
    expect(src).toMatch(/<ScanGuideFrame[^>]*status=\{/);
    expect(src).toMatch(/quality(\?\.|\.)overall/);
  });

  it("카메라 컨테이너 풀블리드(작은 aspect-[4/3] 박스 탈피, h-[68vh])", () => {
    const src = read(LABEL);
    expect(src).toMatch(/h-\[68vh\]/);
  });

  it("QR 풀블리드(max-w-sm 작은 정사각 탈피, h-[60vh])", () => {
    const src = read(QR);
    expect(src).toMatch(/h-\[60vh\]/);
    // QR 뷰파인더 컨테이너 max-w-sm 제거
    expect(src).not.toMatch(/뷰파인더 영역 \*\/\}\s*<div className="relative w-full max-w-sm"/);
  });
});

describe("§11.374-vivino — 회귀 0 (§11.374/374b 보존)", () => {
  it("ScanGuideFrame showScanLine·testId·코너 4마커 보존", () => {
    const src = read(FRAME);
    expect(src).toMatch(/showScanLine/);
    expect(src).toMatch(/data-testid=\{testId\}/);
    expect(src).toMatch(/"tl", "tr", "bl", "br"/);
  });

  it("§11.374b 프리뷰 상대 클램프(h-[78%] aspect-square) 보존", () => {
    const src = read(FRAME);
    expect(src).toMatch(/h-\[78%\] aspect-square/);
  });

  it("LabelScanner quality 판정·autoCapture·captureRef 보존", () => {
    const src = read(LABEL);
    expect(src).toMatch(/quality\.overall/);
    expect(src).toMatch(/autoCapture/);
    expect(src).toMatch(/captureRef/);
  });
});
