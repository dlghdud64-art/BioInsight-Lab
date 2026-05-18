/**
 * §11.253b-1 — 스마트 입고 충돌 banner 시간/행위자 정보 추가 (호영님 spec ③ + ⑤).
 *
 * 호영님 spec 잔여 2 항목 (§11.253 case 3 후속):
 *   ③ 행위자 표시 — matchedInventory.user.name inline 노출.
 *   ⑤ 시간 정보 — matchedInventory.updatedAt 으로 "X분 전" RelativeTimeText.
 *
 * backend 변경 minimum:
 *   - scan-label/route.ts `matchedInventory` select 에 updatedAt + userId +
 *     user(name) 추가 (신규 model 0, migration 0).
 *
 * canonical truth lock:
 *   - matchedInventory shape 확장 (id/lotNumber/currentQuantity/unit 보존).
 *   - ScanApiResponse type 확장 (caller 기존 호환).
 *   - §11.253 conflict banner red Error 톤 + [그래도 진행] / [취소] button 보존.
 *   - §11.253b-2/3 별도 cluster (InventoryLock + BroadcastChannel).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const ROUTE_PATH = resolve(__dirname, "../../app/api/inventory/scan-label/route.ts");
const MODAL_PATH = resolve(__dirname, "../../components/inventory/LabelScannerModal.tsx");
const routeCode = safeRead(ROUTE_PATH);
const modalCode = safeRead(MODAL_PATH);

describe("§11.253b-1 #1 — scan-label route select 확장", () => {
  it("§11.253b-1 trace marker 명시 (route)", () => {
    expect(routeCode).toMatch(/§11\.253b-1|11\.253b-1/);
  });

  it("matchedInventory select 에 updatedAt 추가", () => {
    // select { id, lotNumber, currentQuantity, unit, updatedAt } 정합.
    expect(routeCode).toMatch(/select:\s*\{[\s\S]{0,300}updatedAt:\s*true/);
  });

  it("matchedInventory select 에 userId 또는 user (name) 추가", () => {
    // user relation include — name 노출용.
    expect(routeCode).toMatch(/user:\s*\{[\s\S]{0,200}select:\s*\{[\s\S]{0,200}name:\s*true|userId:\s*true/);
  });
});

describe("§11.253b-1 #2 — LabelScannerModal banner 시간/행위자 노출", () => {
  it("§11.253b-1 trace marker 명시 (modal)", () => {
    expect(modalCode).toMatch(/§11\.253b-1|11\.253b-1/);
  });

  it("RelativeTimeText import + 사용 (시간 정보 ⑤)", () => {
    expect(modalCode).toMatch(/RelativeTimeText/);
  });

  it("matchedInventory.updatedAt 또는 user.name 접근 (행위자 ③)", () => {
    expect(modalCode).toMatch(/matchedInventory\.updatedAt|matchedInventory\?\.updatedAt/);
    expect(modalCode).toMatch(/matchedInventory\.user|matchedInventory\?\.user/);
  });
});

describe("§11.253b-1 — invariant 보존", () => {
  it("scan-label route matchedInventory 기존 4 fields 보존", () => {
    expect(routeCode).toMatch(/id:\s*true/);
    expect(routeCode).toMatch(/lotNumber:\s*true/);
    expect(routeCode).toMatch(/currentQuantity:\s*true/);
    expect(routeCode).toMatch(/unit:\s*true/);
  });

  it("ScanApiResponse matchedInventory type 보존 (modal type)", () => {
    expect(modalCode).toMatch(/matchedInventory:\s*\{[\s\S]{0,500}(id|lotNumber|currentQuantity|unit)/);
  });

  it("§11.253 red Error banner + [그래도 진행] / [취소] 보존", () => {
    expect(modalCode).toMatch(/border-red-200/);
    expect(modalCode).toMatch(/그래도\s*진행/);
    expect(modalCode).toMatch(/§11\.253\b/);
  });

  it("conflictAck state + setConflictAck 보존", () => {
    expect(modalCode).toMatch(/conflictAck/);
    expect(modalCode).toMatch(/setConflictAck/);
  });

  it("이미 등록된 항목 헤더 + 입고 처리 작업 유형 보존", () => {
    expect(modalCode).toMatch(/이미\s*등록된\s*항목/);
    expect(modalCode).toMatch(/입고\s*처리/);
  });
});
