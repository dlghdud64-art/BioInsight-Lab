/**
 * §11.253 — 스마트 입고 (AI 스캔) 충돌 경고 메시지 강화 (case 3 = 이미 등록된 Lot).
 *
 * 호영님 spec (5 요구사항 중 본 트랙 4개):
 *   ① 항목 특정 — matchedProduct.name + matchedInventory.lotNumber 명시.
 *   ② 작업 유형 — "입고 처리" 명시 (정적, case 3 정합).
 *   ③ 행위자 — backend lock infra 필요 → §11.253b 별도 cluster (out of scope).
 *   ④ 액션 — [그래도 진행] / [취소] button 2개.
 *   ⑤ 시간 — backend updatedAt 확장 필요 → §11.253b 별도 cluster (out of scope).
 *
 * 경고 수준: Error (red) — case 3 "이미 완료된 입고 항목에 중복 입고 시도".
 *
 * canonical truth lock:
 *   - scanResult.matchedInventory canonical (DB Inventory row) 변경 0.
 *   - 기존 onDirectReceive / onScanComplete 시그니처 보존.
 *   - 동일 Lot 안내 메시지 자체는 보존 — 색상/액션/항목 정보만 강화.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const MODAL_PATH = resolve(__dirname, "../../components/inventory/LabelScannerModal.tsx");
const code = safeRead(MODAL_PATH);

describe("§11.253 #1 — 충돌 메시지 강화 (항목 + 작업 유형 + Error 톤)", () => {
  it("§11.253 trace marker 명시", () => {
    expect(code).toMatch(/§11\.253|11\.253/);
  });

  it("Error 톤 — border-red / bg-red / text-red 중 하나 (case 3 정확)", () => {
    // 호영님 spec — 이미 완료된 입고 항목 중복 시도 = Error (빨강).
    expect(code).toMatch(/§11\.253[\s\S]{0,2000}(border-red|bg-red|text-red)/);
  });

  it("작업 유형 명시 — '입고 처리' 또는 '입고' 라벨", () => {
    // 호영님 spec — "어떤 작업이 진행 중인지" 명시.
    expect(code).toMatch(/§11\.253[\s\S]{0,2000}입고\s*처리|입고\s*완료된/);
  });

  it("항목 특정 — matchedProduct.name 또는 productName + lotNumber 노출", () => {
    // 호영님 spec — "충돌 대상 품목명 명시".
    expect(code).toMatch(/§11\.253[\s\S]{0,2000}(matchedProduct\.name|matchedProduct\?\.name)/);
    expect(code).toMatch(/§11\.253[\s\S]{0,2000}lotNumber/);
  });
});

describe("§11.253 #2 — 액션 button ([그래도 진행] / [취소])", () => {
  it("[그래도 진행] button 명시 (사용자 의도 확인)", () => {
    expect(code).toMatch(/그래도\s*진행|계속\s*진행/);
  });

  it("[취소] button 명시 (모달 닫기 또는 conflict abort)", () => {
    // §11.253 trace marker 인근 안 취소.
    expect(code).toMatch(/§11\.253[\s\S]{0,2000}>\s*취소\s*<|취소[\s\S]{0,200}onClose/);
  });

  it("conflict acknowledge state (useState 또는 ref 으로 사용자 의도 추적)", () => {
    // [그래도 진행] click → state true 으로 banner hide. 또는 ack callback 명시.
    expect(code).toMatch(/(conflictAck|conflictAcknowledge|confirmedOverride|setConflict|acknowledgeConflict)/);
  });

  it("min-h-[44px] 또는 h-9+ 터치 타깃 (액션 button)", () => {
    // §11.253 trace 인근 button h-9 또는 min-h-[44px].
    expect(code).toMatch(/§11\.253[\s\S]{0,2500}(min-h-\[44px\]|h-9|h-10|h-11)/);
  });
});

describe("§11.253 — invariant 보존", () => {
  it("matchedInventory 시그니처 보존 (canonical truth)", () => {
    expect(code).toMatch(/matchedInventory/);
    expect(code).toMatch(/currentQuantity/);
  });

  it("onDirectReceive callback 보존 (기존 caller 호환)", () => {
    expect(code).toMatch(/onDirectReceive/);
  });

  it("AlertTriangle icon 보존 (충돌 시각 표현)", () => {
    expect(code).toMatch(/AlertTriangle/);
  });

  it("'동일 Lot' 또는 '이미 등록' 안내 텍스트 보존 (메시지 의미)", () => {
    expect(code).toMatch(/동일\s*Lot|이미\s*등록|이미\s*입고/);
  });
});
