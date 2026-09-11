/**
 * §inventory-phaseB P3-UI-b — trackingMode 설정 UI + API 저장 (3모드 per-item, 기본 QUANTITY)
 *   (PLAN: docs/plans/PLAN_inventory-phaseB-gmp-usage-trackingmode.md P3-UI-b)
 *
 * 재고 등록/수정(AddInventoryModal)에서 trackingMode 선택 → content saveMutation → POST/PATCH 저장.
 *   화이트리스트(임의 값 차단) + 기본 QUANTITY(회귀 0). a(차감 3곳) 완료 후 land = dead-end 0.
 */

import { describe, it, expect } from "vitest";
import { buildInventoryFormPayload, buildInventoryPatchBody, type InventoryFormState } from "@/lib/inventory/inventory-form-payload";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MODAL = readFileSync(resolve(__dirname, "../../components/inventory/AddInventoryModal.tsx"), "utf8");
const CONTENT = readFileSync(resolve(__dirname, "../../app/dashboard/inventory/inventory-content.tsx"), "utf8");
const POST = readFileSync(resolve(__dirname, "../../app/api/inventory/route.ts"), "utf8");
const PATCH = readFileSync(resolve(__dirname, "../../app/api/inventory/[id]/route.ts"), "utf8");

describe("§inventory-phaseB P3-UI-b — 설정 UI(AddInventoryModal)", () => {
  it("trackingMode state + onSubmit 계약 + 3모드 select", () => {
    expect(MODAL).toMatch(/const \[trackingMode, setTrackingMode\] = useState<string>\(inventory\?\.trackingMode \?\? "QUANTITY"\)/);
    expect(MODAL).toMatch(/trackingMode\?: string;/);
    expect(MODAL).toMatch(/<Select value=\{trackingMode\} onValueChange=\{setTrackingMode\}>/);
    expect(MODAL).toMatch(/<SelectItem value="QUANTITY">/);
    expect(MODAL).toMatch(/<SelectItem value="LOT">/);
    expect(MODAL).toMatch(/<SelectItem value="GMP_STRICT">/);
  });
  it("handleSubmit data 에 trackingMode 포함", () => {
    /* 승계 (§inventory-notes-erase P1-b · 2026-09-11): 조립이 lib/inventory/inventory-form-payload.ts 로
     *   옮겨졌다(동작 동일 추출). 명제는 그 줄의 위치·바이트가 아니라 **조립 결과**다 — 결과와 배선으로 잰다. */
    expect(MODAL).toMatch(/buildInventoryFormPayload\s*\(/);
    expect(MODAL).toMatch(/testPurpose,\s*trackingMode,/);
    const state: InventoryFormState = { productId: "p", isManual: false, selectedProduct: null, currentQuantity: "1", unit: "ea", safetyStock: "", minOrderQty: "", location: "", expiryDate: undefined, notes: "", lotNumber: "", storageCondition: "", testPurpose: "", trackingMode: "QUANTITY", isEdit: true, editableCatNo: "" };
    expect(buildInventoryFormPayload({ ...state, trackingMode: "LOT" }).trackingMode).toBe("LOT");
  });
});

describe("§inventory-phaseB P3-UI-b — content saveMutation 전달", () => {
  it("payload 타입 + edit body 에 trackingMode", () => {
    expect(CONTENT).toMatch(/testPurpose\?: string; trackingMode\?: string;/);
    /* 승계 (§inventory-notes-erase P1-b · 2026-09-11): 조립이 lib/inventory/inventory-form-payload.ts 로
     *   옮겨졌다(동작 동일 추출). 명제는 그 줄의 위치·바이트가 아니라 **조립 결과**다 — 결과와 배선으로 잰다. */
    expect(CONTENT).toMatch(/buildInventoryPatchBody\s*\(\s*formPayload\s*\)/);
    expect(buildInventoryPatchBody({ currentQuantity: 1, trackingMode: "LOT" }).trackingMode).toBe("LOT");
    // 미전달이면 키가 빠진다 (PATCH 의 "미전달 시 변경 없음" 계약)
    expect("trackingMode" in JSON.parse(JSON.stringify(buildInventoryPatchBody({ currentQuantity: 1 })))).toBe(false);
  });
});

describe("§inventory-phaseB P3-UI-b — API 저장(화이트리스트·기본 QUANTITY)", () => {
  it("POST create — 화이트리스트 + 기본 QUANTITY(회귀 0)", () => {
    expect(POST).toMatch(/trackingMode: trackingMode === "LOT" \|\| trackingMode === "GMP_STRICT" \? trackingMode : "QUANTITY"/);
  });
  it("PATCH update — 화이트리스트(임의 값 차단, 미전달 시 변경 없음)", () => {
    expect(PATCH).toMatch(/trackingMode === "QUANTITY" \|\| trackingMode === "LOT" \|\| trackingMode === "GMP_STRICT"/);
    expect(PATCH).toMatch(/updateData\.trackingMode = trackingMode/);
  });
});
