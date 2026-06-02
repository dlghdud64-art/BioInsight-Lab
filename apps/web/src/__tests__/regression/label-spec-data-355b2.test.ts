/**
 * §11.355-B(규격 데이터화) (회귀) — 라벨 규격 하드코딩 제거 + 실측 정정 + 커스텀 sentinel
 *
 * 플랜 §2 "라벨 규격 = 데이터, 하드코딩 금지". 폼텍 치수 실물 대조(2026-06):
 *   3101 60칸 38.1×19.2 / 3102 40칸 47×26.9 / 3104 27칸 62.7×30.1 (구 값 오류 정정).
 * 인쇄 width 가 `.includes("3104")` 문자열 매칭이 아니라 widthMm/heightMm canonical 파생.
 * 커스텀 규격(직접 입력) 추가.
 *
 * 문자열 매칭은 toContain (esbuild ts-loader 모호성 회피).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const MODAL = "src/components/inventory/LabelPrintModal.tsx";

describe("§11.355-B 규격 데이터화 — 실측 정정", () => {
  it("폼텍 실측 치수 데이터화 (3104=62.7×30.1, 3102=47×26.9, 3101=38.1×19.2)", () => {
    const src = read(MODAL);
    expect(src).toContain("widthMm: 62.7");
    expect(src).toContain("heightMm: 30.1");
    expect(src).toContain("widthMm: 47");
    expect(src).toContain("heightMm: 19.2");
  });
  it("구 오류 치수 제거 (99.1×67.7 / 99.1×38.1 / 63.5×38.1)", () => {
    const src = read(MODAL);
    expect(src).not.toContain("99.1 × 67.7");
    expect(src).not.toContain("99.1 × 38.1");
    expect(src).not.toContain("63.5 × 38.1");
  });
});

describe("§11.355-B 규격 데이터화 — 하드코딩 제거 + 커스텀", () => {
  it("인쇄 width 가 canonical mm(labelWidthMm) 파생 (문자열 .includes 매칭 아님)", () => {
    const src = read(MODAL);
    expect(src).toContain("width: ${labelWidthMm}mm");
    expect(src).toContain("min-height: ${labelHeightMm}mm");
  });
  it("커스텀 규격 옵션 + 직접 입력 (가로×세로 mm)", () => {
    const src = read(MODAL);
    expect(src).toContain('id: "custom"');
    expect(src).toContain("isCustomSpec");
    expect(src).toContain("setCustomW");
    expect(src).toContain("setCustomH");
  });
});

describe("§11.355-B 규격 데이터화 회귀 0 — 기존 보존", () => {
  it("실 QR(toDataURL) + 가짜 바코드 부재 보존", () => {
    const src = read(MODAL);
    expect(src).toContain("QRCode.toDataURL");
    expect(src).not.toContain("||||||||");
  });
  it("프리셋 5종(폼텍/DYMO) + 토글 보존", () => {
    const src = read(MODAL);
    expect(src).toContain("폼텍 3100");
    expect(src).toContain("폼텍 3104");
    expect(src).toContain("DYMO 11354");
    expect(src).toContain("setIncludeQR");
  });
});
