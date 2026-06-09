/**
 * Phase 3 — 라벨 저신뢰 commit 게이트 surface wiring sentinel
 * PLAN_label-lowconfidence-gate / 호영님 5규칙.
 *
 * 3 surface(SmartReceiving·LabelScanner·mobile scan)가 공통 helper
 * evaluateLabelCommitGate 를 사용하고, rule 2(Lot·유효기간 명시 확인) + rule 1
 * (확인 필요 마크) + 저장 비활성을 배선했는지 검증. 기존 §11.375/378 패턴 보존(회귀 0).
 *
 * sandbox vitest = rollup-native 불일치로 "실행 불가" → 클로드코드 실제 실행 PASS 확정.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function readWeb(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
function readMobile(rel: string): string {
  return readFileSync(resolve(APP_WEB_ROOT, "../mobile", rel), "utf8");
}

const SMART = "src/components/inventory/SmartReceivingScannerModal.tsx";
const LABEL = "src/components/inventory/LabelScannerModal.tsx";

describe("Phase 3 — SmartReceivingScannerModal critical-field 게이트", () => {
  it("evaluateLabelCommitGate helper import·사용", () => {
    const src = readWeb(SMART);
    expect(src).toMatch(/from "@\/lib\/ocr\/label-commit-gate"/);
    expect(src).toMatch(/evaluateLabelCommitGate\(\{/);
  });

  it("Lot·유효기간 명시 확인 state + 터치/수정 시 confirm", () => {
    const src = readWeb(SMART);
    expect(src).toMatch(/const \[lotConfirmed, setLotConfirmed\] = useState\(false\)/);
    expect(src).toMatch(/const \[expiryConfirmed, setExpiryConfirmed\] = useState\(false\)/);
    expect(src).toMatch(/setLotConfirmed\(true\)/);
    expect(src).toMatch(/setExpiryConfirmed\(true\)/);
    // reset 초기화
    expect(src).toMatch(/setLotConfirmed\(false\)/);
    expect(src).toMatch(/setExpiryConfirmed\(false\)/);
  });

  it("handleSubmit — Lot/EXP 미확인 차단(return)", () => {
    const src = readWeb(SMART);
    expect(src).toMatch(/lot-unconfirmed/);
    expect(src).toMatch(/expiry-unconfirmed/);
    expect(src).toMatch(/Lot 번호·유효기한을 확인/);
  });

  it("저장 버튼 disabled 에 criticalUnconfirmed 포함 (no-op 아님)", () => {
    const src = readWeb(SMART);
    expect(src).toMatch(/criticalUnconfirmed/);
    expect(src).toMatch(/disabled=\{[\s\S]*?criticalUnconfirmed[\s\S]*?\}/);
  });

  it("확인 필요 마크 노출(fieldMarks needs-confirm)", () => {
    const src = readWeb(SMART);
    expect(src).toMatch(/fieldMarks\.lot === "needs-confirm"/);
    expect(src).toMatch(/fieldMarks\.expiry === "needs-confirm"/);
    expect(src).toMatch(/확인 필요/);
  });

  it("발주매핑(selectedOrderId)은 게이트 제외 — 우회 아님", () => {
    const src = readWeb(SMART);
    expect(src).toMatch(/!selectedOrderId &&[\s\S]*?lot-unconfirmed/);
  });
});

describe("Phase 3 — §11.375/378 회귀 0(SmartReceiving 기존 게이트 보존)", () => {
  it("기존 저신뢰 게이트 패턴 보존", () => {
    const src = readWeb(SMART);
    expect(src).toMatch(/scanResult\.confidence === "low" && !productNameDirty/);
    expect(src).toMatch(/라벨 인식 신뢰도가 낮습니다/);
    expect(src).toMatch(/재고 오염 방지/);
    expect(src).toMatch(/smart-receiving-submit-cta/);
  });
});

describe("Phase 3 — LabelScannerModal critical-field 게이트(직접 입고 한정)", () => {
  it("evaluateLabelCommitGate helper import·사용", () => {
    const src = readWeb(LABEL);
    expect(src).toMatch(/from "@\/lib\/ocr\/label-commit-gate"/);
    expect(src).toMatch(/evaluateLabelCommitGate\(\{/);
  });

  it("기존 lotDirty/expiryDirty 를 criticalConfirmed 로 재사용", () => {
    const src = readWeb(LABEL);
    expect(src).toMatch(/criticalConfirmed:\s*\{\s*lot:\s*lotDirty,\s*expiry:\s*expiryDirty\s*\}/);
  });

  it("handleDirectReceive(commit)만 게이트 — 폼 적용(handoff) 제외", () => {
    const src = readWeb(LABEL);
    // criticalUnconfirmed 는 onDirectReceive 스코프
    expect(src).toMatch(/!!onDirectReceive &&[\s\S]*?lot-unconfirmed/);
    expect(src).toMatch(/Lot 번호·유효기한을 확인/);
  });

  it("완료 disabled 에 criticalUnconfirmed 포함", () => {
    const src = readWeb(LABEL);
    expect(src).toMatch(/criticalUnconfirmed/);
  });

  it("§11.378 회귀 0 — 기존 저신뢰 게이트·핸드오프 보존", () => {
    const src = readWeb(LABEL);
    expect(src).toMatch(/mapOcrConfidence\(scanResult\.parsed\.confidence\) === "low"/);
    expect(src).toMatch(/onClick=\{onDirectReceive \? handleDirectReceive : handleApplyToForm\}/);
    expect(src).toMatch(/!formData\.productName\.trim\(\)/);
  });
});

describe("Phase 3 — mobile scan.tsx critical-field 게이트 + rule 3 datamatrix verified", () => {
  it("helper import·사용", () => {
    const src = readMobile("app/scan.tsx");
    expect(src).toMatch(/from "\.\.\/lib\/scan\/label-commit-gate"/);
    expect(src).toMatch(/evaluateLabelCommitGate\(\{/);
  });

  it("datamatrix(GS1) Lot/EXP = verified 설정(rule 3)", () => {
    const src = readMobile("app/scan.tsx");
    expect(src).toMatch(/setLotVerified\(Boolean\(gs1\.lotNo\)\)/);
    expect(src).toMatch(/setExpiryVerified\(Boolean\(gs1\.expirationDate\)\)/);
    // OCR-fill 은 verified 아님
    expect(src).toMatch(/setLotVerified\(false\)/);
  });

  it("confirmLabelReceive(commit) Lot/EXP 게이트 + 버튼 disabled 결합", () => {
    const src = readMobile("app/scan.tsx");
    expect(src).toMatch(/lot-unconfirmed/);
    expect(src).toMatch(/criticalUnconfirmed/);
    expect(src).toMatch(/disabled=\{receiveBlocked\}/);
  });

  it("§11.378-native 회귀 0 — 기존 저신뢰 게이트 보존", () => {
    const src = readMobile("app/scan.tsx");
    expect(src).toMatch(/lowConf && !productNameDirty/);
    expect(src).toMatch(/useCodeScanner\s*\(/);
  });
});

// mobile mirror 존재 가드(드리프트 방지는 label-commit-gate.test.ts)
describe("Phase 3 — mobile mirror 존재", () => {
  it("apps/mobile/lib/scan/label-commit-gate.ts export", () => {
    const src = readMobile("lib/scan/label-commit-gate.ts");
    expect(src).toMatch(/export function evaluateLabelCommitGate/);
  });
});
