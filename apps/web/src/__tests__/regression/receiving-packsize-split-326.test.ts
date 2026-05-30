/**
 * §11.326 Phase 3 (RED) — 스마트 입고 "라벨 용량(packSize) vs 입고 수량" 분리 sentinel
 *
 * ⚠️ 이 sentinel 은 §11.326 Phase 3 GREEN 에서 통과로 전환됩니다.
 *    - 현재(작성 시점) 코드 기준 **의도된 RED**(실패) 상태로 commit 됩니다.
 *    - packSize/packUnit 컬럼은 §11.326 2-a 마이그레이션(`prisma migrate deploy`) 선행 필요.
 *    - Phase 3 GREEN: LabelScannerModal 섹션 분리 + inventory-content onDirectReceive
 *      가 receivedQuantity(사용자 입력)를 currentQuantity 로 쓰도록 수정하면 GREEN.
 *
 * root cause(차단 대상): 라벨 "100 CAPSULES"(통 1개 함량)가 입고 수량으로 매핑됨
 *   (inventory-content `currentQuantity: parseInt(data.quantity)`).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const MODAL = "src/components/inventory/LabelScannerModal.tsx";
const INV = "src/app/dashboard/inventory/inventory-content.tsx";
const GATE = "src/lib/inventory/map-label-to-receiving.ts";

describe("§11.326 Phase 3 — 매핑 함수 존재(2-a land 됨)", () => {
  it("map-label-to-receiving 코어 존재 + 핵심 export", () => {
    const src = read(GATE);
    expect(src).toMatch(/export function mapLabelToReceiving/);
    expect(src).toMatch(/packSize/);
    expect(src).toMatch(/receivedQuantity/);
  });
});

describe("§11.326 Phase 3 (RED until GREEN) — LabelScannerModal 섹션 분리", () => {
  it("'품목 정보' / '입고 정보' 섹션 분리", () => {
    const src = read(MODAL);
    expect(src).toMatch(/품목 정보/);
    expect(src).toMatch(/입고 정보/);
  });

  it("'규격(통 1개 함량)' 라벨 + 'CAPSULES 등 라벨 값' 안내", () => {
    const src = read(MODAL);
    expect(src).toMatch(/규격.*(함량|통 1개)|통 1개.*함량/);
  });

  it("'받은 통 개수' 신규 입고 수량 필드(기본 1)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/받은 통 개수|받은 개수|받은 박스/);
    expect(src).toMatch(/receivedQuantity/);
  });

  it("총 함량 자동계산 표시", () => {
    const src = read(MODAL);
    expect(src).toMatch(/총 ?함량/);
  });

  it("mapLabelToReceiving 사용(매핑 단일화)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/mapLabelToReceiving/);
  });
});

describe("§11.326 Phase 3 (RED until GREEN) — onDirectReceive 영속화 분리", () => {
  it("입고 수량 = 사용자 입력(receivedQuantity), 라벨값 아님", () => {
    const src = read(INV);
    expect(src).toMatch(/receivedQuantity/);
  });

  it("라벨값을 currentQuantity 로 쓰던 버그 제거", () => {
    const src = read(INV);
    // 현재: currentQuantity: parseInt(data.quantity) — 이 패턴이 남아있으면 RED
    expect(src).not.toMatch(/currentQuantity:\s*parseInt\(data\.quantity\)/);
  });

  it("packSize/packUnit 품목 마스터로 영속화", () => {
    const src = read(INV);
    expect(src).toMatch(/packSize/);
    expect(src).toMatch(/packUnit/);
  });
});

describe("§11.326 회귀 0 — 기존 스마트 입고 골격 보존", () => {
  it("LabelScannerModal scan-label/onDirectReceive/ConfidenceBadge 보존", () => {
    const src = read(MODAL);
    expect(src).toMatch(/\/api\/inventory\/scan-label/);
    expect(src).toMatch(/onDirectReceive/);
    expect(src).toMatch(/ConfidenceBadge/);
  });
  it("inventory-content 스마트 재고 등록 진입 보존", () => {
    const src = read(INV);
    expect(src).toMatch(/스마트 재고 등록/);
    expect(src).toMatch(/onDirectReceive/);
  });
});
