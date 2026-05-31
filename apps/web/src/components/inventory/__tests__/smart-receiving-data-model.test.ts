import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const MODAL = "src/components/inventory/SmartReceivingScannerModal.tsx";

describe("§11.326 — 스마트 입고 데이터 모델 분리 (packSize vs receivedQuantity)", () => {
  it("ConfirmedFormState 가 packSize/receivedQuantity 분리 필드를 가진다", () => {
    const src = read(MODAL);
    expect(src).toMatch(/packSize:\s*string/);
    expect(src).toMatch(/receivedQuantity:\s*number/);
  });

  it("handleSubmit 가 receivedQuantity 를 quantity 로 전송한다", () => {
    const src = read(MODAL);
    expect(src).toMatch(/quantity:\s*form\.receivedQuantity/);
  });

  it("packSize 는 Number 변환되어 전송된다", () => {
    const src = read(MODAL);
    expect(src).toMatch(/packSize:\s*form\.packSize\.trim\(\)\s*\?\s*Number\(/);
  });
});

// §11.326 v3 — PO 매핑 작업 중 데이터 무결성(매핑 분리) 회귀 보호.
//   PO 매핑 Phase 1~4 가 아래 분리를 깨지 않도록 선고정. 회귀 trace 분리.
describe("§11.326 v3 회귀 0 — 매핑 분리 불변식 (PO 매핑과 독립)", () => {
  it("packSize 와 receivedQuantity 가 별개 form 필드로 유지된다", () => {
    const src = read(MODAL);
    // 4필드 분리 모두 존재
    expect(src).toMatch(/packSize:\s*string/);
    expect(src).toMatch(/packUnit:\s*string/);
    expect(src).toMatch(/receivedQuantity:\s*number/);
    expect(src).toMatch(/receivedUnit:\s*string/);
  });

  it("입고 수량 검증은 receivedQuantity 기준(packSize 아님)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/form\.receivedQuantity\s*<=\s*0/);
    // 옛 단일 quantity 검증 패턴 회귀 금지
    expect(src).not.toMatch(/form\.quantity\s*<=\s*0/);
  });

  it("submit body 에 packSize(규격) 와 quantity(입고수량) 가 별개로 전송된다", () => {
    const src = read(MODAL);
    expect(src).toMatch(/quantity:\s*form\.receivedQuantity/);
    expect(src).toMatch(/packSize:\s*form\.packSize/);
    // 입고수량을 packSize 로 보내는 회귀 금지
    expect(src).not.toMatch(/quantity:\s*form\.packSize/);
  });

  it("UI 라벨이 규격(통 1개 함량) 과 입고 수량을 분리 노출한다", () => {
    const src = read(MODAL);
    expect(src).toMatch(/규격\s*\(통 1개 함량\)/);
    expect(src).toMatch(/srm-receivedQuantity/);
    expect(src).toMatch(/srm-packSize/);
  });
});
