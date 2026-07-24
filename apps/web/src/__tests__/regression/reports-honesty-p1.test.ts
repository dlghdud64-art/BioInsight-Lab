/**
 * §reports-honesty P1 — 구매 리포트 정직성 계약 (호영님 계획서 P1 / PLAN_reports-honesty.md)
 *
 * 정본: docs/plans/PLAN_reports-honesty.md (P0 완료 `8942022b` — 수정 지점 라인 잠금·
 *   Quote 식별자 실재(quoteNumber/title)·실벤더 관계 경로·sentinel 경계 계수).
 *
 * 3결함(프로덕션 payload + 코드 + 스키마 실측 확정):
 *   ① ₩0 날조 — QuoteItem 에 가격 필드가 **부재**하여 `(item.unitPrice||0)*qty` 는 구조적으로 항상 0.
 *      미확정 견적을 ₩0 지출로 합산 = 없는 지출 날조.
 *   ② vendor 오표기 — 견적 실벤더(QuoteVendor) 대신 product 카탈로그 첫 벤더를 사용.
 *   ③ project 오용 — `quote.description`(요청 메시지 원문)을 project 로 노출.
 *
 * 정직성 원칙: 미확정 금액은 0 으로 단정하지 않고 "미확정" 표기 · 실지출 canonical = PurchaseRecord.
 * Out of Scope: QuoteReply 이메일 본문 금액 파싱(비구조) · 스키마 변경/마이그레이션.
 *
 * ⚠️ Phase 1 RED sentinel — P2(route)/P3(UI) 구현 전 실패가 정상.
 *
 * 🔒 false-pass 방지(P0 실측 근거):
 *   - `totalAmount` 단순 매칭 금지 — route 로컬 누산기/응답 필드(L132·146·170·312)가 이미 존재.
 *     ⇒ **`quote.totalAmount`** 로 정밀 pin.
 *   - `vendorName` 단순 매칭 금지 — PurchaseRecord `record.vendorName` 5건이 이미 존재.
 *     ⇒ **`quote.vendors`** 경로로 정밀 pin.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");

const ROUTE = "src/app/api/reports/purchase/route.ts";
const PAGE = "src/app/dashboard/reports/page.tsx";
const MOBILE = "src/app/dashboard/reports/mobile-report-view.tsx";

describe("§reports-honesty P1 — 계약 (P2·P3 구현 후 GREEN)", () => {
  it("(a) 부재 필드 미참조 — item.unitPrice 파생 0 (QuoteItem 가격 컬럼 없음)", () => {
    // 스키마 확정: QuoteItem = { quantity, notes, productId } — 가격 필드 부재.
    //   ⇒ (item.unitPrice||0)*qty 는 구조적으로 항상 0. 전건 제거 대상(L144·236·282).
    const src = read(ROUTE);
    expect(src).not.toMatch(/item\.unitPrice/);
  });

  it("(b) 견적 금액 truth — Quote.totalAmount 참조(견적 측 유일 구조 금액)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/quote\.totalAmount/);
  });

  it("(c) vendor 파생 — 견적 실벤더(quote.vendors) 경유, 카탈로그 첫벤더 매핑 폐기", () => {
    const src = read(ROUTE);
    // 실벤더 = QuoteVendor(quote.vendors[].vendorName). record.vendorName(PurchaseRecord)와 구분.
    expect(src).toMatch(/quote\.vendors/);
    // 상세행 vendor 가 product 카탈로그 첫 벤더 파생을 쓰지 않아야 함.
    expect(src).not.toMatch(/item\.product\?\.vendors\?\.\[0\]\?\.vendor/);
  });

  it("(d) project 정정 — description 직접 노출 폐기, 견적 식별자(quoteNumber ?? title)", () => {
    const src = read(ROUTE);
    expect(src).not.toMatch(/project:\s*quote\.description/);
    expect(src).toMatch(/quoteNumber/);
  });

  it("(e) 미확정 견적은 지출 합계 제외 — totalAmount null 판정 실재(₩0 합산 금지)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/§reports-honesty/); // trace marker
    // quote.totalAmount 에 대한 null/부재 분기가 실재해야 함(무조건 누산 금지).
    expect(src).toMatch(
      /quote\.totalAmount\s*(===|!==|==|!=)\s*null|quote\.totalAmount\s*\?\?|!\s*quote\.totalAmount/,
    );
  });

  it("(f) UI 정직 표기 — '미확정' + '회신 대기'(₩0 단정 표기 금지)", () => {
    const page = read(PAGE);
    const mobile = read(MOBILE);
    const both = page + mobile;
    expect(both).toMatch(/미확정/);
    expect(both).toMatch(/회신 대기/);
  });
});

describe("§reports-honesty P1 — 회귀 0 (기존 계약 보존)", () => {
  it("집계 배열 shape 보존 — categoryData/vendorData/monthlyData (purchase.contract 19 pin)", () => {
    const src = read(ROUTE);
    // client 가 c.amount > 0 필터 + dataKey="amount" 로 렌더 — 키 형태 변경 금지.
    expect(src).toMatch(/categoryData/);
    expect(src).toMatch(/vendorData/);
    expect(src).toMatch(/monthlyData/);
  });

  it("실지출 canonical 보존 — PurchaseRecord 기반 actualAmount 누산", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/actualAmount/);
    expect(src).toMatch(/record\.amount/);
  });

  it("§reports-500-null-product 가드 보존 — product null 크래시 방지", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/item\.product\?\./);
  });

  it("details 행 코어 필드 보존 — date/organization/category/productName/type", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/date:\s*quote\.createdAt/);
    expect(src).toMatch(/organization:\s*quote\.organization\?\.name/);
    expect(src).toMatch(/category:/);
    expect(src).toMatch(/productName:/);
    expect(src).toMatch(/type:\s*"quote"/);
  });
});
