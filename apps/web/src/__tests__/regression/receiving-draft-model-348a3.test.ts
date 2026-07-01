/**
 * §11.348-A-3 (회귀) — 검증 대기 입고안(ReceivingDraft) 스키마 sentinel
 *
 * A-3 본체: 공급사가 발주(PO) 후 회신한 입고 정보를 "검증 대기 입고안"으로
 * 보관. canonical 아님(derived). 사람 승인(A-4)에서만 InventoryRestock 생성.
 *
 * 핵심 불변(§11.336 "승인 전 입고 mutation 0"의 스키마 보증):
 *   ReceivingDraft / ReceivingDraftItem 은 ProductInventory / InventoryRestock
 *   를 직접 변경하는 relation 을 갖지 않는다 (순수 데이터). 따라서 회신/입고안
 *   생성만으로는 재고가 절대 움직이지 않는다.
 *
 * 문자열 매칭은 toContain (esbuild ts-loader 모호성 회피).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const SCHEMA = "prisma/schema.prisma";
const MIGRATION = "prisma/migrations/20260603120000_add_receiving_draft/migration.sql";

describe("§11.348-A-3 — ReceivingDraft 모델 존재 + 핵심 필드", () => {
  it("ReceivingDraft 모델 + 회신 토큰/상태/만료", () => {
    const src = read(SCHEMA);
    expect(src).toContain("model ReceivingDraft {");
    expect(src).toContain("token           String               @unique");
    expect(src).toContain("status          ReceivingDraftStatus @default(AWAITING_REPLY)");
    expect(src).toContain("expiresAt       DateTime");
    // 이중 입고 idempotent 가드 (A-4 승인 시 사용)
    expect(src).toContain("restockSyncedAt DateTime?");
  });

  it("ReceivingDraftItem 모델 + 회신 실수량/LOT/유효기간", () => {
    const src = read(SCHEMA);
    expect(src).toContain("model ReceivingDraftItem {");
    expect(src).toContain("receivedQuantity Float?");
    expect(src).toContain("lotNumber        String?");
    expect(src).toContain("expiryDate       DateTime?");
    // PO 매핑은 scalar (OrderItem.productId 선례)
    expect(src).toContain("orderItemId      String?");
    expect(src).toContain("productId        String?");
  });

  it("ReceivingDraftStatus enum 5 상태", () => {
    const src = read(SCHEMA);
    expect(src).toContain("enum ReceivingDraftStatus {");
    expect(src).toContain("AWAITING_REPLY");
    expect(src).toContain("PENDING_REVIEW");
    expect(src).toContain("APPROVED");
    expect(src).toContain("REJECTED");
    expect(src).toContain("EXPIRED");
  });
});

describe("§11.348-A-3 — 백릴레이션 (Order/User/Org/Vendor)", () => {
  it("4개 모델에 receivingDrafts 역방향", () => {
    const src = read(SCHEMA);
    // ReceivingDraft 의 FK relation 선언
    expect(src).toContain("order        Order                @relation(fields: [orderId]");
    expect(src).toContain("user         User                 @relation(fields: [userId]");
    expect(src).toContain("vendor       Vendor?              @relation(fields: [vendorId]");
    expect(src).toContain("organization Organization?        @relation(fields: [organizationId]");
  });
});

describe("§11.348-A-3 불변 — 입고안은 재고를 변경하지 않는다 (§11.336)", () => {
  it("ReceivingDraft/Item 이 ProductInventory/InventoryRestock relation 미보유", () => {
    const src = read(SCHEMA);
    // ReceivingDraft 모델 블록만 추출 후 주석(//) 제거 — relation 부재만 검증
    const stripComments = (block: string) =>
      block
        .split("\n")
        .map((ln) => ln.replace(/\/\/.*$/, ""))
        .join("\n");
    const start = src.indexOf("model ReceivingDraft {");
    const end = src.indexOf("model ReceivingDraftItem {");
    const draftBlock = stripComments(src.slice(start, end));
    const itemStart = src.indexOf("model ReceivingDraftItem {");
    // itemBlock 을 ReceivingDraftItem 모델 끝(다음 model 선언)까지로 bound —
    //   slice-to-EOF 는 뒤 모델(SDSDocument 등)의 ProductInventory relation 을 오탐(§suite-red-cleanup fix).
    const itemEnd = src.indexOf("\nmodel ", itemStart + 1);
    const itemBlock = stripComments(
      src.slice(itemStart, itemEnd === -1 ? undefined : itemEnd),
    );
    // 순수 데이터: 재고/입고 모델로의 relation 금지 (주석 언급은 허용)
    for (const block of [draftBlock, itemBlock]) {
      expect(block).not.toContain("ProductInventory[]");
      expect(block).not.toContain("ProductInventory?");
      expect(block).not.toContain("ProductInventory @relation");
      expect(block).not.toContain("InventoryRestock[]");
      expect(block).not.toContain("InventoryRestock?");
      expect(block).not.toContain("InventoryRestock @relation");
    }
  });
});

describe("§11.348-A-3 — migration 은 순수 추가형 (기존 테이블 무변경)", () => {
  it("CREATE TABLE ReceivingDraft/Item + enum, 기존 테이블 ALTER/DROP 0", () => {
    const sql = read(MIGRATION);
    expect(sql).toContain('CREATE TYPE "ReceivingDraftStatus"');
    expect(sql).toContain('CREATE TABLE "ReceivingDraft"');
    expect(sql).toContain('CREATE TABLE "ReceivingDraftItem"');
    // 기존 운영 테이블을 건드리지 않음 (재고/입고/주문 컬럼 변경 0)
    expect(sql).not.toContain('ALTER TABLE "InventoryRestock"');
    expect(sql).not.toContain('ALTER TABLE "ProductInventory"');
    expect(sql).not.toContain('ALTER TABLE "Order"');
    expect(sql).not.toContain("DROP TABLE");
  });
});
