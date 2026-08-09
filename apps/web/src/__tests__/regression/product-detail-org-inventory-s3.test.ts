/**
 * §product-detail §3-1 — 우리 조직 재고 블록 (B1, 2026-08-09)
 *
 * 배경 (SCOPING_product-detail-s3-s4-wiring):
 *   §3 거래 맥락 3항목 중 **재고만** 이번 배치에 나간다. 최근 구매·구매가 이력은
 *   소스 갈림길(OrderItem 정확하나 prod 0건 / PurchaseRecord 15건이나 productId 부재)로
 *   보류 — 소스는 OrderItem 으로 결정됐고 착수 조건은 "OrderItem 실데이터 발생"이다.
 *
 * 계약:
 *   S1. 데이터 소스 = GET /api/inventory?productId= (B1 신설 필터).
 *       ⚠️ `inventory/lookup` 은 텍스트로 `{ inventoryId }` 하나만 주는 스마트입고
 *       매칭 헬퍼라 이 용도에 쓸 수 없다(실측). 그쪽으로 회귀하지 않는다.
 *   S2. **데이터 없으면 블록 자체 숨김** — 0건에 "재고 없음" 빈 껍데기를 그리지 않는다.
 *   S3. 로그인 전에는 호출하지 않는다(enabled 게이트).
 *   S4. 서버 필터가 실제로 where 에 productId 를 걸어야 한다 — 파라미터만 받고
 *       버리면 전 조직 재고가 노출된다(스코프 누수). ownerCondition 은 보존.
 *   S5. 안전재고 미달은 §9 신호등 red(#b91c1c) — amber/orange 금지.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(WEB_ROOT, rel), "utf8");

const PAGE = read("src/app/products/[id]/page.tsx");
const API = read("src/app/api/inventory/route.ts");

describe("§3-1 S1 — 소스는 productId 필터 (lookup 회귀 금지)", () => {
  it("페이지가 /api/inventory?productId= 로 조회", () => {
    expect(PAGE).toMatch(/\/api\/inventory\?productId=/);
  });

  it("inventory/lookup 을 재고 블록 소스로 쓰지 않는다", () => {
    // lookup 은 { inventoryId } 하나만 반환 — 수량·위치·안전재고가 없다.
    expect(PAGE).not.toMatch(/api\/inventory\/lookup/);
  });
});

describe("§3-1 S2·S3 — 빈 블록 금지 · 비로그인 호출 0", () => {
  it("0건이면 블록 미렌더 (length > 0 게이트)", () => {
    expect(PAGE).toMatch(/orgInventories\.length > 0 &&/);
  });

  it("'재고 없음' 류 빈 상태 문구를 이 블록에 그리지 않는다", () => {
    // 블록 자체를 숨기는 계약이므로 빈 상태 카피가 존재하면 계약 위반이다.
    expect(PAGE).not.toMatch(/우리 조직 재고[\s\S]{0,400}등록된 재고가 없습니다/);
  });

  it("세션 있을 때만 호출 (enabled 게이트)", () => {
    expect(PAGE).toMatch(/queryKey: \["product-org-inventory", id\][\s\S]{0,600}?enabled:[^\n]*session\?\.user\?\.id/);
  });
});

describe("§3-1 S4 — 서버가 실제로 스코프를 건다 (누수 0)", () => {
  it("productId 파라미터 수신", () => {
    expect(API).toMatch(/searchParams\.get\("productId"\)/);
  });

  it("where 절에 productId 반영 — 받기만 하고 버리지 않는다", () => {
    expect(API).toMatch(/\.\.\.\(productId \? \{ productId \} : \{\}\)/);
  });

  it("ownerCondition(조직·사용자 스코프) 보존 — 제품 필터가 스코프를 대체하지 않는다", () => {
    expect(API).toMatch(/const where: any = \{[\s\S]{0,200}?\.\.\.ownerCondition/);
  });
});

describe("§3-1 S5 — 신호등 정합 (§9)", () => {
  it("안전재고 미달 = red(#b91c1c), amber/orange 0", () => {
    // 앵커는 JSX 게이트(고유) — "우리 조직 재고" 문자열은 훅 JSDoc·§7 주석에도 있어
    // indexOf 가 블록이 아닌 곳에 걸린다(최초 작성 시 실제로 그렇게 빗나갔다).
    const start = PAGE.indexOf("orgInventories.length > 0 &&");
    expect(start).toBeGreaterThan(-1);
    const block = PAGE.slice(start, start + 1600);
    expect(block).toMatch(/#b91c1c/);
    expect(block).not.toMatch(/amber-|orange-/);
  });
});
