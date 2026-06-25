/**
 * §inventory-phaseB P3-UI-b — trackingMode 설정 UI + API 저장 (3모드 per-item, 기본 QUANTITY)
 *   (PLAN: docs/plans/PLAN_inventory-phaseB-gmp-usage-trackingmode.md P3-UI-b)
 *
 * 재고 등록/수정(AddInventoryModal)에서 trackingMode 선택 → content saveMutation → POST/PATCH 저장.
 *   화이트리스트(임의 값 차단) + 기본 QUANTITY(회귀 0). a(차감 3곳) 완료 후 land = dead-end 0.
 */

import { describe, it, expect } from "vitest";
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
    expect(MODAL).toMatch(/testPurpose: testPurpose\.trim\(\) \|\| undefined,\s*\n\s*trackingMode,/);
  });
});

describe("§inventory-phaseB P3-UI-b — content saveMutation 전달", () => {
  it("payload 타입 + edit body 에 trackingMode", () => {
    expect(CONTENT).toMatch(/testPurpose\?: string; trackingMode\?: string;/);
    expect(CONTENT).toMatch(/trackingMode: formPayload\.trackingMode \?\? undefined/);
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
