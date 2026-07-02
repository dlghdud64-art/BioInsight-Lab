/**
 * §11.326 Phase B (RED) — 모바일 스마트 입고 packSize vs 입고 수량 분리 sentinel
 *
 * 데스크톱(Phase 3) 동일 원칙을 모바일에 적용:
 *   - scan.tsx LabelForm: 라벨 quantity → packSize(품목), 입고 수량은 받은 통 개수(기본 1).
 *   - mapLabelToReceiving 모바일 복제(surface-agnostic, DUPLICATED 주석).
 *   - confirmLabelReceive: lot-receive prefillQty / register quantity 에 receivedQuantity(라벨값 아님).
 *
 * 모바일은 자체 test runner 없음 → web vitest 가 repo-root 상대경로로 readFileSync(§11.319 패턴).
 * 구현 전이므로 의도된 RED.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
const REPO_ROOT = join(APP_WEB_ROOT, "..", "..");
function readRepo(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const CQ_MOBILE = "apps/mobile/lib/inventory/map-label-to-receiving.ts";
const SCAN = "apps/mobile/app/scan.tsx";
const REGISTER = "apps/mobile/app/purchases/register.tsx";

describe("§11.326 Phase B — mapLabelToReceiving 모바일 복제", () => {
  it("복제본 존재 + 핵심 export + DUPLICATED 주석", () => {
    expect(existsSync(join(REPO_ROOT, CQ_MOBILE))).toBe(true);
    const src = readRepo(CQ_MOBILE);
    expect(src).toMatch(/export function mapLabelToReceiving/);
    expect(src).toMatch(/DUPLICATED[\s\S]{0,40}apps\/web\/src\/lib\/inventory/); // 주석 형식 "DUPLICATED 대상: ..." 허용
  });
  it("순수 모듈 — RN/expo import 금지", () => {
    const src = readRepo(CQ_MOBILE);
    expect(src).not.toMatch(/from ["']react-native["']/);
    expect(src).not.toMatch(/from ["']expo-/);
  });
});

describe("§11.326 Phase B — scan.tsx LabelForm 분리", () => {
  it("LabelForm 에 packSize/packUnit/receivedQuantity 분리", () => {
    const src = readRepo(SCAN);
    expect(src).toMatch(/packSize/);
    expect(src).toMatch(/receivedQuantity/);
  });
  it("mapLabelToForm: 라벨 quantity → packSize (입고 수량 아님)", () => {
    const src = readRepo(SCAN);
    expect(src).toMatch(/packSize:\s*r\.parsed\.quantity/);
    // 기존 버그: quantity: r.parsed.quantity 가 입고수량으로 — 제거되어야
    expect(src).not.toMatch(/quantity:\s*r\.parsed\.quantity\s*\|\|\s*"1"/);
  });
  it("규격/받은 통 개수 UI 라벨 분리", () => {
    const src = readRepo(SCAN);
    expect(src).toMatch(/규격|통 1개/);
    expect(src).toMatch(/받은 통 개수|받은 개수/);
  });
  it("라벨→입고 매핑 — scan.tsx 인라인 (packSize 분리, 헬퍼는 순수모듈 보존)", () => {
    const src = readRepo(SCAN);
    // 모바일은 mapLabelToReceiving 헬퍼 대신 인라인 매핑(packSize=라벨값 · receivedQuantity=입력).
    //   헬퍼 파일은 순수모듈로 보존(Block 1). 인라인 packSize 분리 증거로 재앵커.
    expect(src).toMatch(/packSize:\s*r\.parsed\.quantity/);
  });
  it("confirmLabelReceive prefill: receivedQuantity 사용(라벨값 아님)", () => {
    const src = readRepo(SCAN);
    expect(src).toMatch(/prefillQty:\s*labelForm\.receivedQuantity/);
    expect(src).not.toMatch(/prefillQty:\s*labelForm\.quantity/);
  });
});

describe("§11.326 Phase B — 회귀 0 (바코드/스캔 골격 보존)", () => {
  it("scan.tsx 바코드 + 라벨 모드 보존 (§11.380 VisionCamera CodeScanner)", () => {
    const src = readRepo(SCAN);
    expect(src).toMatch(/useCodeScanner/); // 구 expo handleBarCodeScanned → VisionCamera CodeScanner
    expect(src).toMatch(/scanLabel/);
    expect(src).toMatch(/label-review/);
  });
  it("register.tsx QuickEntryForm + prefill 보존", () => {
    const src = readRepo(REGISTER);
    expect(src).toMatch(/QuickEntryForm/);
    expect(src).toMatch(/catalogNumber/);
  });
});
