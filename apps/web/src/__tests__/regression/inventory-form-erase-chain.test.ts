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
 *   1. storageCondition — 저장 자리가 **ProductInventory 가 아니라 Product.storageCondition** 이다.
 *      재고 PATCH 가 받아도 쓸 열이 없어 catalogNumber 처럼 제품 마스터 갱신 경로가 필요하다 · 별건.
 *   2. testPurpose — schema.prisma 와 prod DB **어디에도 컬럼이 없다**(2026-09-12 실측).
 *      폼은 입력을 받아 보내는데 저장할 자리가 없다 → DDL 선행 · 별건.
 *   3. 실제 브라우저 폼 이벤트 — 상태 → 조립만 본다. 최종 확인은 prod 화면 실측이 한다.
 *
 * ── 닫은 한계 (옛 1·3) ──
 *   expiryDate · safetyStock · minOrderQty 비우기 → 아래 §inventory-edit-blank-fields 블록이 잠갔다.
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
import { resolveNumericUpdate } from "@/lib/inventory/numeric-field-update";
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

describe("§inventory-edit-blank-fields (호영님 2026-09-12) — 숫자·날짜 비우기도 본문에 실린다", () => {
  it("🛑 안전재고를 비우면 safetyStock 이 null 로 실린다 (키 소실 0)", () => {
    const body = wire({ ...editing, safetyStock: "" });
    expect(Object.prototype.hasOwnProperty.call(body, "safetyStock")).toBe(true);
    expect(body.safetyStock).toBeNull();
  });

  it("🛑 최소주문수량을 비우면 minOrderQty 가 null 로 실린다", () => {
    const body = wire({ ...editing, minOrderQty: "" });
    expect(Object.prototype.hasOwnProperty.call(body, "minOrderQty")).toBe(true);
    expect(body.minOrderQty).toBeNull();
  });

  it("🛑 유효기간을 비우면 expiryDate 가 null 로 실린다 (1단계·2단계 둘 다)", () => {
    const body = wire({ ...editing, expiryDate: undefined });
    expect(Object.prototype.hasOwnProperty.call(body, "expiryDate")).toBe(true);
    expect(body.expiryDate).toBeNull();
  });

  it("🛑 끝까지: 그 본문을 서버가 해석하면 미설정(null)이 된다 · 0 이 아니다", () => {
    const body = wire({ ...editing, safetyStock: "", minOrderQty: "" });
    expect(resolveNumericUpdate(body.safetyStock)).toBeNull();
    expect(resolveNumericUpdate(body.minOrderQty)).toBeNull();
    /* 🔑 0 이면 안 되는 이유: 알림 조건이 safetyStock > 0 이라 0 은 "0개까지 괜찮다" 가 되어
     *   재고가 바닥나도 경고가 영영 안 뜬다. 비움과 0 은 다른 사건이다. */
    expect(resolveNumericUpdate(body.safetyStock)).not.toBe(0);
  });

  it("🔑 해석 계약 3값 (안 넘김 · 비움 · 숫자)", () => {
    expect(resolveNumericUpdate(undefined)).toBeUndefined();
    expect(resolveNumericUpdate(null)).toBeNull();
    expect(resolveNumericUpdate("")).toBeNull();
    expect(resolveNumericUpdate("  ")).toBeNull();
    expect(resolveNumericUpdate("1,200")).toBe(1200);
    expect(resolveNumericUpdate(5)).toBe(5);
    expect(resolveNumericUpdate(0)).toBe(0); // 사용자가 **0 을 입력한 것** 은 비움이 아니다
    expect(Number.isNaN(resolveNumericUpdate("abc") as number)).toBe(true); // 400 은 호출부 몫
  });

  it("안 건드린 숫자는 그대로 실린다 (회귀 0)", () => {
    const body = wire({ ...editing, safetyStock: "3", minOrderQty: "10" });
    expect(body.safetyStock).toBe(3);
    expect(body.minOrderQty).toBe(10);
  });

  it("🛑 서버 PATCH 가 safetyStock 을 받고 해석기를 쓴다 (옛 판본은 키를 꺼내지도 않았다)", () => {
    const src = stripComments(
      readFileSync(join(WEB_ROOT, "src/app/api/inventory/[id]/route.ts"), "utf8"),
    );
    expect(src).toMatch(/resolveNumericUpdate/);
    expect(src).toMatch(/updateData\.safetyStock\s*=/);
    expect(src).not.toMatch(/Number\(minOrderQty\.replace/);
  });

  it("🛑 폼 조립부에 옛 `? : undefined` 떨굼이 남아 있지 않다", () => {
    const src = stripComments(
      readFileSync(join(WEB_ROOT, "src/lib/inventory/inventory-form-payload.ts"), "utf8"),
    );
    expect(src).not.toMatch(/safetyStock:\s*s\.safetyStock\s*\?/);
    expect(src).not.toMatch(/minOrderQty:\s*s\.minOrderQty\s*\?/);
    expect(src).not.toMatch(/safetyStock:\s*p\.safetyStock\s*\?\?\s*undefined/);
  });
});
