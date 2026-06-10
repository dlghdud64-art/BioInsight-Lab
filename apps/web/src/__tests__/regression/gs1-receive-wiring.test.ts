/**
 * §gs1-datamatrix Phase 2 — scan.tsx GS1 재고등록 배선 sentinel
 *
 * A안(호영님 확정): barcode 모드 onCodeScanned 에서 GS1 datamatrix(Lot/유효기간 보유)면
 *   재고등록 검토(label-review)로 분기 + Lot/유효기간 자동채움 + GTIN 표시(매칭 아님).
 *   use_qr(차감) 의도는 기존 조회 유지. frameProcessor(§11.380 라이브락) 무변경.
 *   GS1 경로는 OCR 저신뢰 게이트 미적용(datamatrix=결정적), 제품명은 여전히 필수.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
const REPO_ROOT = join(APP_WEB_ROOT, "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const SCAN = "apps/mobile/app/scan.tsx";

describe("§gs1 배선 — onCodeScanned GS1 분기", () => {
  it("parseGs1 import + GS1 분기(use_qr 제외, Lot/Expiry 보유)", () => {
    const src = read(SCAN);
    expect(src).toMatch(/import \{ parseGs1 \} from "\.\.\/lib\/scan\/gs1-parser"/);
    expect(src).toMatch(/const gs1 = parseGs1\(value\)/);
    expect(src).toMatch(/intent !== "use_qr" && gs1\.isGs1 && \(gs1\.lotNo \|\| gs1\.expirationDate\)/);
  });

  it("Lot/유효기간 자동채움 + GTIN 표시 state + label-review 분기", () => {
    const src = read(SCAN);
    expect(src).toMatch(/lotNumber: gs1\.lotNo \?\? f\.lotNumber/);
    expect(src).toMatch(/expirationDate: gs1\.expirationDate \?\? f\.expirationDate/);
    expect(src).toMatch(/setGs1Gtin\(gs1\.gtin\)/);
    expect(src).toMatch(/setState\("label-review"\)/);
  });

  it("GS1 경로 OCR 저신뢰 게이트 미적용(isGs1Capture) — 단 제품명 필수 보존", () => {
    const src = read(SCAN);
    expect(src).toMatch(/const isGs1Capture = !!gs1Gtin && !labelResult/);
    expect(src).toMatch(/const lowConf = !isGs1Capture && level === "low"/);
    // 제품명 필수 게이트는 유지(receiveBlocked 가 productName.trim 포함)
    // §11.381 batch baseline 정합 (2026-06-11): receiveBlocked 멀티라인 포맷
    //   드리프트(HEAD 기준 기존)로 단일라인 regex 비매칭 → 공백 허용으로 정합.
    expect(src).toMatch(/!labelForm\.productName\.trim\(\)\s*\|\|\s*\(lowConf && !productNameDirty\)/);
  });
});

describe("§gs1 배선 — 회귀 0", () => {
  it("barcode 일반 경로 performLookup 보존", () => {
    const src = read(SCAN);
    expect(src).toMatch(/performLookup\(value, "scan"\)/);
  });
  it("frameProcessor 라이브락(§11.380) 무변경 — stepLock/runAtTargetFps 보존", () => {
    const src = read(SCAN);
    expect(src).toMatch(/stepLock\(lockRuntimeRef\.current/);
    expect(src).toMatch(/runAtTargetFps\(5/);
  });
  it("§11.378 OCR 저신뢰 게이트 카피 보존", () => {
    const src = read(SCAN);
    expect(src).toMatch(/라벨 인식 신뢰도가 낮습니다/);
  });
  it("gs1Gtin reset 초기화", () => {
    const src = read(SCAN);
    expect(src).toMatch(/setGs1Gtin\(null\)/);
  });
});
