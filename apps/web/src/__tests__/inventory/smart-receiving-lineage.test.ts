import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

/**
 * §receiving-scan-source-merge 선행(가) — 스캔 입고 lineage 쓰기 활성.
 *
 * 배경(2026-09-02 P0 실측): `InventoryRestock.ocrJobId`·`extractedData` 는 컬럼이
 * 존재하는데 **쓰는 코드가 없었다** — 2026-05 "migration pending" 주석이 컬럼 적용
 * 후에도 남아 세 경로 전부 주석 처리. 그래서 prod 전 행이 null 이고,
 * §receiving-scan-source-merge 의 C3(공급사명 파생)가 성립하지 않았다.
 *
 * 잠그는 계약:
 *   1) restock 생성 3경로(단품-기존재고 · 단품-신규 · 다품목) **전부** ocrJobId 기입
 *   2) extractedData = 사용자가 확인한 최종 데이터(감사 추적) — 단품은 confirmedData,
 *      다품목은 해당 line(행별 근거. 전체 payload 를 행마다 복제하지 않는다)
 *   3) 주석 부활 차단 — "migration pending" 문구로 되돌아가지 않는다
 *   4) 재고 수량 계산은 무접촉(lineage 는 감사 축이지 수량 축이 아니다)
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");
const ROUTE = "src/app/api/inventory/smart-receiving/route.ts";
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

/** inventoryRestock.create 블록만 잘라낸다 — 창은 여는 호출부터(② 창 시작점). */
function restockCreateBlocks(src: string): string[] {
  return src.match(/(?:tx|db)\.inventoryRestock\.create\(\{[\s\S]{0,900}?\n\s*\}\);/g) ?? [];
}

describe("§scan-lineage (1) — restock 생성 전 경로가 ocrJobId 를 남긴다", () => {
  it("inventoryRestock.create 블록 3개 이상 · 전부 ocrJobId 기입", () => {
    const src = stripComments(read(ROUTE));
    const blocks = restockCreateBlocks(src);
    expect(blocks.length, `create 블록 수: ${blocks.length}`).toBeGreaterThanOrEqual(3);
    const missing = blocks.filter((b) => !/ocrJobId/.test(b));
    expect(missing, `ocrJobId 누락 블록 ${missing.length}건`).toHaveLength(0);
  });

  it("전 경로가 extractedData 를 남긴다 (감사 추적)", () => {
    const src = stripComments(read(ROUTE));
    const missing = restockCreateBlocks(src).filter((b) => !/extractedData/.test(b));
    expect(missing, `extractedData 누락 블록 ${missing.length}건`).toHaveLength(0);
  });
});

describe("§scan-lineage (2) — 근거 값 축", () => {
  it("단품 = confirmedData · 다품목 = line (행별 근거)", () => {
    const src = stripComments(read(ROUTE));
    expect(src).toMatch(/extractedData: confirmedData as unknown as Prisma\.InputJsonValue/);
    expect(src).toMatch(/extractedData: line as unknown as Prisma\.InputJsonValue/);
  });
});

describe("§scan-lineage (3) — 회귀 0", () => {
  it("주석 처리된 lineage 쓰기 부활 차단 — 이번 결함의 실제 형태", () => {
    // 🛑 단언 대상이 '주석' 이므로 stripComments 를 쓰지 않는다(그러면 검사 자체가 사라진다).
    //    대신 금지 문자열을 산문으로 인용하지 말고 **결함 형태**(주석 처리된 쓰기)를 직접 친다 —
    //    설명 주석이 자기 단언을 RED 로 만드는 자기함정 회피(2026-09-02 실측 1회).
    expect(read(ROUTE)).not.toMatch(/\/\/\s*ocrJobId,/);
    expect(read(ROUTE)).not.toMatch(/\/\/\s*extractedData:/);
  });

  it("수량 축 무접촉 — 기존 increment·quantity 계약 보존", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/currentQuantity: \{ increment: confirmedData\.quantity \}/);
    expect(src).toMatch(/currentQuantity: \{ increment: line\.quantity \}/);
    expect(src).toMatch(/allowMissingCatalog/);
  });
});
