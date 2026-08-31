import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { stripComments, violations } from "@/__tests__/_helpers/em-dash-scan";

/**
 * §scan-recognition-upgrade P2 sentinel — 명세서 다품목 일괄 초안 + 근사 매칭.
 *
 * 잠그는 계약:
 *   1) smart-receiving: `items[]` 있으면 **$transaction 1회 안에서** 라인별 처리 —
 *      트랜잭션 밖 개별 create 0(부분 실패 롤백). 없으면 기존 단품 경로 무회귀.
 *   2) 모달 review: 라인별 수량 input + 포함 체크. 후보 선택(selectedOrderId)은
 *      **옵션** — 등록 버튼 disabled 조건에 후보 선택 요구 0(연결 강제 금지).
 *   3) 근사 매칭 = matchReceiptToOrders 순수함수 wiring(다품목 모드 한정) —
 *      자동 선택 0. "다품목도 자동 인식됩니다" 카피는 P2 land 로 참이 된다.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const ROUTE = "src/app/api/inventory/smart-receiving/route.ts";
const MODAL = "src/components/inventory/SmartReceivingScannerModal.tsx";

describe("§scan-recognition-upgrade P2 (1) — smart-receiving 다품목 additive", () => {
  it("items[] 분기 존재 + $transaction 1회가 라인 루프를 감싼다", () => {
    const src = stripComments(read(ROUTE));
    expect(src).toMatch(/Array\.isArray\(body\.items\)/);
    expect(src).toMatch(/db\.\$transaction\([\s\S]{0,300}?for \(const line of/);
  });

  it("라인 루프 안 direct db.* 쓰기 0 — 전부 tx.* (부분 실패 롤백 보장)", () => {
    const src = stripComments(read(ROUTE));
    // 쓰기 메서드 한정 — 사전 검증의 read(findUnique)는 트랜잭션 밖이 정상.
    expect(src).not.toMatch(
      /for \(const line of[\s\S]{0,5000}?await db\.(product|productInventory|inventoryRestock)\.(create|createMany|update|updateMany|upsert|delete)/,
    );
    // 루프 안 라인 생성은 tx 경유 — 존재 단언(무효 부정 단언 방지)
    expect(src).toMatch(/for \(const line of[\s\S]{0,5000}?await tx\.inventoryRestock\.create/);
  });

  it("소유/조직 스코프 검증은 트랜잭션 앞 — 403/404 계약 (500 위장 결함 교정)", () => {
    const src = stripComments(read(ROUTE));
    // 사전 검증(403)이 $transaction 보다 먼저 — 실패 시 트랜잭션 진입 0.
    expect(src).toMatch(
      /if \(!owned && !orgOk\)[\s\S]{0,300}?status: 403[\s\S]{0,2500}?db\.\$transaction\(/,
    );
    // 트랜잭션 안 throw 스코프 검증 부활 차단.
    expect(src).not.toMatch(/throw new Error\("라인 재고에 대한 권한이 없습니다/);
  });

  it("단품 경로 무회귀 — 기존 분기 A/B 앵커 보존", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/if \(inventoryId\) \{/);
    expect(src).toMatch(/confirmedData\.productName/);
    expect(src).toMatch(/allowMissingCatalog/);
  });

  it("다품목 응답 = 라인별 결과 배열 (등록 라인 수 검증 가능 계약)", () => {
    const src = stripComments(read(ROUTE));
    expect(src).toMatch(/results, count: results\.length/);
  });
});

describe("§scan-recognition-upgrade P2 (2) — 모달 다품목 review", () => {
  it("라인별 포함 체크 + 수량 input", () => {
    const src = read(MODAL);
    expect(src).toMatch(/data-testid="srm-multi-include"/);
    expect(src).toMatch(/data-testid="srm-multi-qty"/);
  });

  it("등록 버튼 disabled 에 후보 선택 요구 0 — 선택 없이도 등록 가능(연결 강제 금지)", () => {
    const src = stripComments(read(MODAL));
    // ② 창 시작점: 버튼 여는 태그부터 — testid 로 유일 식별 후 disabled 식까지.
    const btn = src.match(/<Button[\s\S]{0,120}?data-testid="smart-receiving-submit-cta"[\s\S]{0,1400}?className=/)?.[0];
    expect(btn, "submit 버튼 창").toBeTruthy();
    // 선택 강제의 두 형태 모두 차단: `|| !selectedOrderId` · `!selectedOrderId ||`
    expect(btn!).not.toMatch(/\|\|\s*!selectedOrderId/);
    expect(btn!).not.toMatch(/!selectedOrderId\s*\|\|/);
    expect(btn!).not.toMatch(/selectedOrderId\s*==+\s*null/);
  });

  it("다품목 payload = 포함 라인만 items[] 로 전송", () => {
    const src = stripComments(read(MODAL));
    expect(src).toMatch(/items: includedLines\.map\(/);
  });
});

describe("§scan-recognition-upgrade P2 (3) — 근사 매칭 wiring", () => {
  it("matchReceiptToOrders 순수함수 배선 (다품목 모드) · 자동 선택 0", () => {
    const src = stripComments(read(MODAL));
    expect(src).toMatch(/matchReceiptToOrders\(/);
    // 매칭 결과로 selectedOrderId 를 자동 set 하지 않는다 — 선택은 사람 클릭만.
    const wiring = src.match(/matchReceiptToOrders\([\s\S]{0,900}?\n  \}/)?.[0];
    expect(wiring, "매칭 wiring 창").toBeTruthy();
    expect(wiring!).not.toMatch(/setSelectedOrderId\(/);
  });

  it('"다품목도 자동 인식됩니다" 카피 — P2 구현으로 참 (카피 보존 + 다품목 테이블 실재)', () => {
    const src = read(MODAL);
    expect(src).toMatch(/다품목도 자동 인식됩니다/);
    expect(src).toMatch(/isMulti/);
  });
});

describe("§scan-recognition-upgrade P2 — §11.302 색·타이포 (신규 표면)", () => {
  it("신규 매칭 모듈 amber/orange 0 · em dash 구분자 0", () => {
    for (const rel of ["src/lib/receiving/receipt-match.ts"]) {
      const src = read(rel);
      expect(src, rel).not.toMatch(/amber-\d/);
      expect(src, rel).not.toMatch(/orange-\d/);
      const hits = violations(src);
      expect(hits, `${rel}: ${JSON.stringify(hits)}`).toHaveLength(0);
    }
  });
});
