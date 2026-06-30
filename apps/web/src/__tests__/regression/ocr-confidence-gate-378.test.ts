/**
 * §11.378 (RED→GREEN) — OCR 무효입력 신뢰도 게이트
 *
 * 증상(호영님): 키보드·잡동사니 사진도 "AI 분석 완료" → 입고 완료 진입(무효 통과 =
 *   fake success 변종). "낮은 신뢰도" 뱃지는 표시만, 진행 차단 안 함. 완료 게이트가
 *   productName.trim() 하나뿐(LabelScannerModal L1198).
 *
 * Fix:
 *   - confidence "low" + 사용자 미보정(productNameDirty=false) → 입고 완료 차단 + 경고.
 *   - 사용자가 제품명 직접 수정(productNameDirty) → 차단 해제(수동 보정 허용).
 *   - "낮은 신뢰도"를 경고 → 진행 차단 사유로 격상(재고 오염 방지).
 *
 * sentinel(readFileSync+regex). 최종은 실기기 OCR.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const MODAL = "src/components/inventory/LabelScannerModal.tsx";

describe("§11.378 — 신뢰도 게이트", () => {
  it("productNameDirty 추적 state + updateField wiring", () => {
    const src = read(MODAL);
    expect(src).toMatch(/const \[productNameDirty, setProductNameDirty\] = useState\(false\)/);
    expect(src).toMatch(/if \(key === "productName"\) setProductNameDirty\(true\)/);
  });

  it("완료 버튼 disabled 에 confidence low + 미보정 차단", () => {
    const src = read(MODAL);
    // mapOcrConfidence low 이고 productNameDirty 아니면 차단
    expect(src).toMatch(/mapOcrConfidence\(scanResult\.parsed\.confidence\) === "low"/);
    expect(src).toMatch(/!productNameDirty/);
  });

  it("저신뢰도 차단 경고 카피 노출", () => {
    const src = read(MODAL);
    expect(src).toMatch(/신뢰도가 낮습니다|라벨을 인식하지 못했습니다/);
  });

  it("resetState 에서 productNameDirty 초기화", () => {
    const src = read(MODAL);
    expect(src).toMatch(/setProductNameDirty\(false\)/);
  });
});

describe("§11.378b — 자동캡처도 동일 OCR 게이트 (우회 0, 호영님 §11.375 재설계)", () => {
  it("자동캡처는 capture(false)→runScan→review 까지만(자동 입고 직행 없음)", () => {
    const src = read(MODAL);
    // 자동캡처 트리거(good 연속)는 capture 호출 → runScan → review step. 직접 입고 호출 아님.
    expect(src).toMatch(/autoCaptureRef\.current && q\.overall === "good"/);
    expect(src).toMatch(/void runScan\(dataUrl\)/);
    expect(src).toMatch(/setStep\("review"\)/);
  });

  it("입고 완료(handleDirectReceive)는 수동 버튼 onClick 만 — 동일 disabled 게이트 경유", () => {
    const src = read(MODAL);
    expect(src).toMatch(/onClick=\{onDirectReceive \? handleDirectReceive : handleApplyToForm\}/);
    // 완료 버튼 disabled = 제품명 빈값 OR (confidence low + 미보정) → 자동캡처 결과도 동일 차단
    expect(src).toMatch(/!formData\.productName\.trim\(\)/);
    expect(src).toMatch(/mapOcrConfidence\(scanResult\.parsed\.confidence\) === "low"/);
  });
});

describe("§11.378 — 회귀 0", () => {
  // §scan-card-polish (호영님 2026-06-30) — ConfidenceBadge 헤더는 low 일 때만 노출(보통/높음 숨김).
  //   무조건 mapOcrConfidence 주입 → low 조건부 진화. productName.trim 게이트는 보존.
  it("기존 productName.trim 게이트 + ConfidenceBadge(low 한정) 보존", () => {
    const src = read(MODAL);
    expect(src).toMatch(/!formData\.productName\.trim\(\)/);
    expect(src).toMatch(/=== "low" && <ConfidenceBadge level="low"/);
  });
});
