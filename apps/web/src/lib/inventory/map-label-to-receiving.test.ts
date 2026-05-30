/**
 * §11.326 Phase 1 (RED) — 라벨 용량(packSize) vs 입고 수량(받은 통 개수) 분리 매핑
 *
 * root cause: OCR 라벨 "100 CAPSULES"(통 1개 함량=규격)가 입고 수량으로 매핑됨.
 * 결정(호영님 2026-05-30):
 *   - OCR quantity → packSize(품목), OCR unit → packUnit.
 *   - 입고 수량(receivedQuantity) = 사용자 입력, 기본값 1, **절대 라벨값 아님**.
 *   - receivedUnit 기본 "통". 총함량(received × packSize)은 표시만(영속화 X).
 *   - received 0/음수 입력 → 1 보정(0통 입고 무의미).
 *
 * surface-agnostic 순수 함수 — 구현 전이므로 RED.
 */
import { describe, it, expect } from "vitest";
import {
  mapLabelToReceiving,
  type LabelOcrFields,
} from "./map-label-to-receiving";

const ocr = (over: Partial<LabelOcrFields> = {}): LabelOcrFields => ({
  quantity: null,
  unit: null,
  ...over,
});

describe("§11.326 mapLabelToReceiving — 라벨값은 packSize, 입고수량 아님", () => {
  it("OCR '100'/'CAPSULES' + 입력 없음 → packSize 100, 입고수량 기본 1(라벨값 아님)", () => {
    const r = mapLabelToReceiving(ocr({ quantity: "100", unit: "CAPSULES" }));
    expect(r.packSize).toBe(100);
    expect(r.packUnit).toBe("CAPSULES");
    expect(r.receivedQuantity).toBe(1); // ★ 핵심: 100 아님
    expect(r.receivedUnit).toBe("통");
    expect(r.totalContent).toBe(100); // 1 × 100
  });

  it("받은 통 개수 3 입력 → receivedQuantity 3, 총함량 300", () => {
    const r = mapLabelToReceiving(ocr({ quantity: "100", unit: "CAPSULES" }), {
      receivedQuantity: 3,
    });
    expect(r.receivedQuantity).toBe(3);
    expect(r.totalContent).toBe(300);
  });

  it("packSize 없음(OCR quantity null) → packSize null, 총함량 null(지어내기 0)", () => {
    const r = mapLabelToReceiving(ocr({ quantity: null, unit: null }), {
      receivedQuantity: 2,
    });
    expect(r.packSize).toBeNull();
    expect(r.totalContent).toBeNull();
    expect(r.receivedQuantity).toBe(2);
  });

  it("입고수량 기본값은 절대 OCR 라벨값과 같아지지 않음(버그 회귀 차단)", () => {
    const r = mapLabelToReceiving(ocr({ quantity: "500", unit: "mL" }));
    expect(r.packSize).toBe(500);
    expect(r.receivedQuantity).not.toBe(500);
    expect(r.receivedQuantity).toBe(1);
  });

  it("received 0/음수 입력 → 1 보정", () => {
    expect(mapLabelToReceiving(ocr({ quantity: "10" }), { receivedQuantity: 0 }).receivedQuantity).toBe(1);
    expect(mapLabelToReceiving(ocr({ quantity: "10" }), { receivedQuantity: -3 }).receivedQuantity).toBe(1);
  });

  it("receivedUnit 입력 시 반영(박스), 미입력 시 '통'", () => {
    expect(mapLabelToReceiving(ocr({ quantity: "10" }), { receivedUnit: "박스" }).receivedUnit).toBe("박스");
    expect(mapLabelToReceiving(ocr({ quantity: "10" })).receivedUnit).toBe("통");
  });

  it("packSize 파싱: 숫자 추출('100')→100, 비숫자→null", () => {
    expect(mapLabelToReceiving(ocr({ quantity: "100" })).packSize).toBe(100);
    expect(mapLabelToReceiving(ocr({ quantity: "abc" })).packSize).toBeNull();
    expect(mapLabelToReceiving(ocr({ quantity: "" })).packSize).toBeNull();
  });
});
