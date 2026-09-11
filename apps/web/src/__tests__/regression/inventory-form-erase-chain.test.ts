/**
 * §inventory-notes-erase P1-b (2026-09-11 prod 실측) —
 * **폼에서 비운 값이 요청 본문에 "비움" 으로 실린다.** 모달 → PATCH 본문 → 직렬화 → 서버 해석을 한 줄로 잰다.
 *
 * ── 왜 이 테스트가 따로 필요한가 ──
 * 30083c3c 는 서버 해석(resolveNotesUpdate)을 고쳤고 순수 함수 테스트 6/6 이 GREEN 이었다.
 * 그런데 prod(94eb07ce)에서 비고는 여전히 안 지워졌다:
 *     textarea 비움 → PATCH 발신 → updatedAt 갱신 → notes 그대로
 * 원인은 클라이언트 AddInventoryModal 의 `notes: notes || undefined` — 빈 문자열이 undefined 가
 * 되어 JSON 에서 키가 빠지고, 서버는 "안 넘김" 으로 **올바르게** 판정했다.
 * 6/6 은 서버 축만 쟀다. 그 라우트에 무엇이 도착하는지는 검증 범위 밖이었다.
 * → 그래서 이 파일은 함수가 아니라 **직렬화된 본문**을 단언한다.
 *
 * ── 이 파일이 안 보는 것 (조항 11) ──
 *   1. expiryDate 비우기 — 1단계는 undefined, 2단계(`?? undefined`)는 null 도 떨군다. 두 단계 수정 필요 · 별건.
 *   2. storageCondition · testPurpose — 서버 PATCH 에 처리 코드가 없어 편집이 통째로 무시된다 · 별건.
 *   3. safetyStock · minOrderQty 숫자 비우기 — 서버가 빈 값을 0 으로 읽는 축 · 별건.
 *   4. 실제 브라우저 폼 이벤트 — 상태 → 조립만 본다. 최종 확인은 prod 화면 실측이 한다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildInventoryFormPayload,
  buildInventoryPatchBody,
  type InventoryFormState,
} from "@/lib/inventory/inventory-form-payload";
import { resolveNotesUpdate } from "@/lib/inventory/notes-update";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const WEB_ROOT = join(__dirname, "..", "..", "..");

const editing: InventoryFormState = {
  productId: "prod-1",
  isManual: false,
  selectedProduct: null,
  currentQuantity: "10",
  unit: "ea",
  safetyStock: "",
  minOrderQty: "",
  location: "냉장고 A",
  expiryDate: undefined,
  notes: "기존 비고",
  lotNumber: "LOT-1",
  storageCondition: "",
  testPurpose: "",
  trackingMode: "QUANTITY",
  isEdit: true,
  editableCatNo: "CAT-1",
};

/** 화면이 실제로 보내는 것: 1단계 → 2단계 → JSON 왕복. */
function wire(s: InventoryFormState): Record<string, unknown> {
  const form = buildInventoryFormPayload(s);
  const body = buildInventoryPatchBody(form);
  return JSON.parse(JSON.stringify(body)) as Record<string, unknown>;
}

describe("§inventory-notes-erase P1-b · 비운 값이 본문에 실린다", () => {
  it("🛑 비고를 비우면 본문에 notes 키가 빈 문자열로 실린다", () => {
    const body = wire({ ...editing, notes: "" });
    expect(Object.prototype.hasOwnProperty.call(body, "notes")).toBe(true);
    expect(body.notes).toBe("");
  });

  it("🛑 끝까지: 그 본문을 서버가 해석하면 비고가 지워진다(null)", () => {
    const body = wire({ ...editing, notes: "" });
    expect(resolveNotesUpdate(body.notes, "audit-smoke 20260911")).toBeNull();
  });

  it("🛑 형제 슬롯: 위치를 비우면 location 키가 빈 문자열로 실린다", () => {
    const body = wire({ ...editing, location: "" });
    expect(body.location).toBe("");
  });

  it("🛑 형제 슬롯: lot 을 비우면 lotNumber 키가 빈 문자열로 실린다", () => {
    const body = wire({ ...editing, lotNumber: "   " });
    expect(body.lotNumber).toBe("");
  });

  it("안 건드린 값은 그대로 실린다 (회귀 0)", () => {
    const body = wire(editing);
    expect(body.notes).toBe("기존 비고");
    expect(body.location).toBe("냉장고 A");
    expect(body.lotNumber).toBe("LOT-1");
    expect(body.quantity).toBe(10);
  });

  it("🔑 화면이 이 조립부를 쓴다 (배선) · 옛 `||` 폴백이 모달에 남아 있지 않다", () => {
    const modal = stripComments(
      readFileSync(join(WEB_ROOT, "src/components/inventory/AddInventoryModal.tsx"), "utf8"),
    );
    expect(modal).toMatch(/buildInventoryFormPayload\s*\(/);
    expect(modal).not.toMatch(/notes:\s*notes\s*\|\|\s*undefined/);
    const content = stripComments(
      readFileSync(join(WEB_ROOT, "src/app/dashboard/inventory/inventory-content.tsx"), "utf8"),
    );
    expect(content).toMatch(/buildInventoryPatchBody\s*\(\s*formPayload\s*\)/);
  });
});
