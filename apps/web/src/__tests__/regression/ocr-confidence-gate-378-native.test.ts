/**
 * §11.378-native (RED→GREEN) — OCR 무효입력 신뢰도 게이트 (모바일 native 포팅)
 *
 * 증상(호영님 §11.380 truth reconciliation): web LabelScannerModal 엔 §11.378 차단
 *   게이트가 있으나 native scan.tsx label-review 엔 부재. lowConf 는 "비차단" 권유
 *   배너뿐, confirmLabelReceive 는 productName.trim() 만 검사 → 키보드 등 무효 사진이
 *   재고로 진입(fake success 변종 / 재고 오염).
 *
 * Fix (web 동치):
 *   - confidence "low" + 사용자 미보정(productNameDirty=false) → 입고/등록 이동 차단 + 경고.
 *   - 사용자가 제품명 직접 수정(productNameDirty) → 차단 해제(수동 보정 허용).
 *   - confirmLabelReceive 가드 + 버튼 disabled 양쪽 적용(우회 0).
 *
 * sentinel(readFileSync+regex). 최종은 실기기 OCR.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// __dirname = apps/web/src/__tests__/regression → 3단계 위 = apps/web
const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

// native scan 화면은 apps/mobile (apps/web 기준 ../mobile)
const SCAN = "../mobile/app/scan.tsx";

describe("§11.378-native — 신뢰도 게이트", () => {
  it("productNameDirty 추적 state + updateLabelField wiring", () => {
    const src = read(SCAN);
    expect(src).toMatch(/const \[productNameDirty, setProductNameDirty\] = useState\(false\)/);
    expect(src).toMatch(/if \(key === "productName"\) setProductNameDirty\(true\)/);
  });

  it("confirmLabelReceive 가드: confidence low + 미보정 차단", () => {
    const src = read(SCAN);
    expect(src).toMatch(/mapOcrConfidence\([^)]*confidence[^)]*\) === "low"/);
    expect(src).toMatch(/!productNameDirty/);
  });

  it("입고/등록 이동 버튼 disabled 에 low + 미보정 차단", () => {
    const src = read(SCAN);
    // receiveBlocked = 제품명 빈값 OR (저신뢰 + 미보정) → 버튼 disabled 결합(우회 0)
    expect(src).toMatch(/receiveBlocked[\s\S]*lowConf && !productNameDirty/);
    expect(src).toMatch(/disabled=\{receiveBlocked\}/);
  });

  it("저신뢰도 차단 경고 카피 노출", () => {
    const src = read(SCAN);
    expect(src).toMatch(/신뢰도가 낮습니다|라벨을 인식하지 못했습니다/);
  });

  it("resetToScan 에서 productNameDirty 초기화", () => {
    const src = read(SCAN);
    expect(src).toMatch(/setProductNameDirty\(false\)/);
  });
});

describe("§11.378-native — 회귀 0", () => {
  it("기존 productName.trim 게이트 + 신뢰도 배지 + lot/expiry dirty 추적 보존", () => {
    const src = read(SCAN);
    expect(src).toMatch(/labelForm\.productName\.trim\(\)/);
    expect(src).toMatch(/mapOcrConfidence/);
    expect(src).toMatch(/setLotDirty/);
    expect(src).toMatch(/setExpiryDirty/);
  });

  it("기존 ScanState/ScanMode + 바코드 핸들러 보존", () => {
    const src = read(SCAN);
    expect(src).toMatch(/handleBarCodeScanned/);
    expect(src).toMatch(/"label-review"/);
  });
});
