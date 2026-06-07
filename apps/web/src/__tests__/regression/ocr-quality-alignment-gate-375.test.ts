/**
 * §11.375 (재설계) — 라이브 "정합" 판정 폐기, OCR 후단 게이트 일원화
 *
 * 경위:
 *   §11.375(1차) overall good 에 alignment 게이트 추가 → 선명한 라벨도 "정합_미흡"(false negative)
 *     + 잡동사니 통과(false positive). 촬영 전 라이브 휴리스틱으로 "정합(라벨 일치)"을 알 수 없음(구조적).
 *   → 폐기. overall 은 blur+lighting(촬영 품질)만 측정. 정합은 촬영 후 OCR confidence 게이트(§11.378)가
 *     단일 판정(키보드=OCR 0→차단 / 선명 라벨=OCR 성공→통과).
 *
 * 검증: capture-quality 에 alignment 게이트·"정합_미흡" 없음(라이브 정합 주장 0). alignment 는
 *   참고용 계산만 유지. web↔mobile DUPLICATED 동기화.
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

describe("§11.375 — 라이브 정합 판정 폐기 (web)", () => {
  it("alignment 게이트(overall good→warn) 제거", () => {
    const src = read(WEB);
    expect(src).not.toMatch(/if \(overall === "good" && !alignment\.ok\)/);
  });

  it('라이브 "정합_미흡" 신호 제거(양방향 오판 → 신뢰 파괴)', () => {
    const src = read(WEB);
    expect(src).not.toMatch(/정합_미흡/);
  });

  it("overall 은 blur+lighting failCount 만(촬영 품질) — 보존", () => {
    const src = read(WEB);
    expect(src).toMatch(/const failCount = \(blurOk \? 0 : 1\) \+ \(lightingOk \? 0 : 1\)/);
    expect(src).toMatch(/failCount === 0 \? "good" : failCount === 2 \? "poor" : "warn"/);
  });

  it("alignment 는 참고용 계산만 유지(FrameQuality 필드 보존)", () => {
    const src = read(WEB);
    expect(src).toMatch(/alignmentScore/);
    expect(src).toMatch(/return \{ blur, lighting, alignment, captureConfidence, overall, reasons \}/);
  });
});

describe("§11.375 — mobile DUPLICATED 동기화", () => {
  it("mobile 도 alignment 게이트·정합_미흡 제거", () => {
    const src = read(MOBILE);
    expect(src).not.toMatch(/if \(overall === "good" && !alignment\.ok\)/);
    expect(src).not.toMatch(/정합_미흡/);
    expect(src).toMatch(/const failCount = \(blurOk \? 0 : 1\) \+ \(lightingOk \? 0 : 1\)/);
  });
});

describe("§11.375 — 정합은 OCR 후단(§11.378) 일원화", () => {
  it("LabelScanner: OCR confidence low + 미보정 → 입고 완료 차단(기존 게이트 보존)", () => {
    const src = read("apps/web/src/components/inventory/LabelScannerModal.tsx");
    expect(src).toMatch(/mapOcrConfidence\(scanResult\.parsed\.confidence\) === "low"/);
    expect(src).toMatch(/productNameDirty/);
  });

  it('LabelScanner 라이브 배지에 "정합" 문구 없음(흔들림/조명만)', () => {
    const src = read("apps/web/src/components/inventory/LabelScannerModal.tsx");
    // good 라벨은 "흔들림 없음"(정합 단어 금지)
    expect(src).toMatch(/\? "흔들림 없음"/);
    expect(src).not.toMatch(/정합_양호|정합_미흡/);
  });
});
