/**
 * §11.37x(b) — QR 재고 확인 게이트(중복구매 방지) 계약/회귀 가드
 *
 * 승인(2026-06-10): advisory 게이트 — 보유 시 경고 + 진행 허용(차단 아님).
 * 소싱 surface QR = read-only 조회. 차감/mutation 0. ScanHub(차감) 복제 금지.
 *
 * 본 파일 = 단위 계약(resolve/gate/gs1 포팅) + 소싱 wiring sentinel.
 * sandbox vitest 실행 가능 시 GREEN 확정, 불가 시 "실행 불가" 명시 후 클로드코드 GREEN.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseGs1 } from "@/lib/scan/gs1-parser";
import {
  resolveScanToStockQuery,
  computeDuplicatePurchaseGate,
} from "@/lib/scan/stock-lookup-resolve";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function readWeb(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const SEARCH = "src/app/_workbench/search/page.tsx";

// ---------------------------------------------------------------------------
// b-2 Core — GS1 파서 포팅(순수, mobile 동등)
// ---------------------------------------------------------------------------
describe("§11.37x(b) — GS1 파서 포팅(web, 순수)", () => {
  it("HRI 괄호 양식 — GTIN/EXP/Lot 디코드", () => {
    const r = parseGs1("(01)08806123456789(17)261231(10)ABC123");
    expect(r.isGs1).toBe(true);
    expect(r.gtin).toBe("08806123456789");
    expect(r.expirationDate).toBe("2026-12-31");
    expect(r.lotNo).toBe("ABC123");
  });

  it("일반 텍스트(카탈로그 번호) = GS1 아님", () => {
    const r = parseGs1("T1234-500");
    expect(r.isGs1).toBe(false);
    expect(r.lotNo).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// b-2 Core — resolveScanToStockQuery (스캔 텍스트 → 재고 조회 토큰)
// ---------------------------------------------------------------------------
describe("§11.37x(b) — resolveScanToStockQuery", () => {
  it("GS1 datamatrix(lot 보유) → lot 토큰(가장 구체적인 보유 매칭)", () => {
    const r = resolveScanToStockQuery("(01)08806123456789(17)261231(10)ABC123");
    expect(r.source).toBe("gs1-lot");
    expect(r.query).toBe("ABC123");
    expect(r.gs1?.isGs1).toBe(true);
  });

  it("GS1(gtin만, lot 없음) → gtin 토큰", () => {
    const r = resolveScanToStockQuery("(01)08806123456789");
    expect(r.source).toBe("gs1-gtin");
    expect(r.query).toBe("08806123456789");
  });

  it("일반 카탈로그 QR → raw 토큰", () => {
    const r = resolveScanToStockQuery("  T1234-500  ");
    expect(r.source).toBe("raw");
    expect(r.query).toBe("T1234-500");
  });

  it("빈 입력 → empty(조회 안 함)", () => {
    const r = resolveScanToStockQuery("   ");
    expect(r.source).toBe("empty");
    expect(r.query).toBe("");
  });
});

// ---------------------------------------------------------------------------
// b-2 Core — computeDuplicatePurchaseGate (보유 재고 → advisory 상태)
// ---------------------------------------------------------------------------
describe("§11.37x(b) — computeDuplicatePurchaseGate (advisory)", () => {
  it("보유(currentQuantity>0) 있으면 warn + 합산/매칭수/topMatch", () => {
    const g = computeDuplicatePurchaseGate([
      { currentQuantity: 3, product: { name: "Trypsin-EDTA", catalogNumber: "T1234" } },
      { currentQuantity: 0, product: { name: "Trypsin old", catalogNumber: "T1234" } },
      { currentQuantity: 2, product: { name: "Trypsin-EDTA", catalogNumber: "T1234" } },
    ]);
    expect(g.status).toBe("warn");
    expect(g.totalOnHand).toBe(5);
    expect(g.matchCount).toBe(2);
    expect(g.topMatch?.currentQuantity).toBe(3);
    expect(g.topMatch?.name).toBe("Trypsin-EDTA");
  });

  it("전부 0 재고 → clear(중복 아님)", () => {
    const g = computeDuplicatePurchaseGate([
      { currentQuantity: 0, product: { name: "X", catalogNumber: "X1" } },
    ]);
    expect(g.status).toBe("clear");
    expect(g.totalOnHand).toBe(0);
    expect(g.matchCount).toBe(0);
    expect(g.topMatch).toBeNull();
  });

  it("매칭 없음([]) → clear", () => {
    const g = computeDuplicatePurchaseGate([]);
    expect(g.status).toBe("clear");
    expect(g.totalOnHand).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// b-3 Wiring — 소싱 surface QR 재고 확인 진입(read-only) + advisory 게이트
//   (RED until Phase b-3 구현 — 진입점·게이트 미존재 시 실패)
// ---------------------------------------------------------------------------
describe("§11.37x(b) — 소싱 surface wiring(read-only, 평행진입 0)", () => {
  it("'QR 재고 확인' 진입(중복구매 방지) 존재", () => {
    const src = readWeb(SEARCH);
    expect(src).toMatch(/QR 재고 확인/);
  });

  it("QRScanner read-only — onScanSuccess wiring(resolve/조회로 연결)", () => {
    const src = readWeb(SEARCH);
    expect(src).toMatch(/onScanSuccess=\{/);
    expect(src).toMatch(/resolveScanToStockQuery/);
  });

  it("자동차감 금지 — 소싱 QR 경로에 차감/사용 mutation 호출 없음", () => {
    const src = readWeb(SEARCH);
    // 소싱 QR 재고 확인은 GET /api/inventory 조회만. use/dispatch 차감 fetch 금지.
    expect(src).not.toMatch(/\/api\/inventory\/[^"'`]*\/use/);
    expect(src).not.toMatch(/dispatch.*차감|차감.*dispatch/);
  });

  it("advisory 게이트 — 보유 경고 상태(컴포넌트 진행 허용, 차단 아님)", () => {
    const src = readWeb(SEARCH);
    expect(src).toMatch(/computeDuplicatePurchaseGate/);
  });
});
