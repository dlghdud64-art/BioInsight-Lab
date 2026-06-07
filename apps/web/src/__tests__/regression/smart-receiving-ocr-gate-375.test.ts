/**
 * §11.375 OCR 후단 게이트 — 라이브 입고 경로(SmartReceivingScannerModal) 일원화
 *
 * Truth reconciliation (2026-06-08, bug-hunter TR):
 *   §11.375 재설계 = 라이브 정합판정 폐기 → 촬영 후 OCR 신뢰도 게이트로 일원화(§11.378).
 *   §11.378 게이트는 LabelScannerModal 에만 적용 → 라이브 스마트입고 경로
 *   (SmartReceivingScannerModal, dashboard/inventory 진입)는 미적용 = 갭.
 *   handleSubmit 이 productName.trim()+quantity>0 만 검사, scanResult.confidence 는
 *   배지 표시만 → 키보드·잡동사니(low) 사진도 제품명만 있으면 입고 통과(fake success 잔존).
 *
 * Fix: §11.378 패턴 이식 — confidence "low" + 미보정(productNameDirty=false) → 입고 차단 + 경고.
 *   제품명 수동 수정 시 해제. 발주매핑 경로(selectedOrderId)는 OCR 무관이라 게이트 제외(우회 아님).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const MODAL = "src/components/inventory/SmartReceivingScannerModal.tsx";
const LABEL_MODAL = "src/components/inventory/LabelScannerModal.tsx";

describe("§11.375 — SmartReceivingScannerModal OCR 후단 게이트", () => {
  it("productNameDirty state + reset 초기화", () => {
    const src = read(MODAL);
    expect(src).toMatch(/const \[productNameDirty, setProductNameDirty\] = useState\(false\)/);
    expect(src).toMatch(/setProductNameDirty\(false\)/); // reset()
  });

  it("제품명 수동 수정 시 dirty 설정(게이트 해제 트리거)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/setProductNameDirty\(true\)/);
  });

  it("handleSubmit — confidence low + 미보정 시 입고 차단(return)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/scanResult\.confidence === "low" && !productNameDirty/);
    expect(src).toMatch(/라벨 인식 신뢰도가 낮습니다/);
  });

  it("입고 등록 버튼 disabled — low + 미보정 (no-op 아님)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/disabled=\{[\s\S]*?scanResult\?\.confidence === "low"[\s\S]*?!productNameDirty[\s\S]*?\}/);
  });

  it("저신뢰도 차단 사유 배너 노출", () => {
    const src = read(MODAL);
    expect(src).toMatch(/재고 오염 방지/);
  });

  it("발주매핑(selectedOrderId) 경로는 OCR 게이트 제외 — 우회 아님(OCR 무관)", () => {
    const src = read(MODAL);
    // 게이트는 !selectedOrderId 스코프(OCR 경로 한정). 발주매핑은 early-return 보존.
    expect(src).toMatch(/!selectedOrderId &&\s*\n?\s*scanResult\?\.confidence === "low"/);
    expect(src).toMatch(/if \(selectedOrderId\)/); // 발주매핑 early-return 보존
  });
});

describe("§11.375 — 회귀 0", () => {
  it("LabelScannerModal §11.378 게이트 보존", () => {
    const src = read(LABEL_MODAL);
    expect(src).toMatch(/const \[productNameDirty, setProductNameDirty\] = useState\(false\)/);
    expect(src).toMatch(/mapOcrConfidence\(scanResult\.parsed\.confidence\) === "low"/);
  });

  it("SmartReceiving 기존 제출 검증(제품명/수량) 보존", () => {
    const src = read(MODAL);
    expect(src).toMatch(/form\.receivedQuantity <= 0/);
    expect(src).toMatch(/smart-receiving-submit-cta/);
  });
});
