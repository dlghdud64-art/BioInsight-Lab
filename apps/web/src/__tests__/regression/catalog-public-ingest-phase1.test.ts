// §catalog-A Phase 1 — Contract & Failing Tests (호영님 P1, 2026-06-10)
// 계약: procurement_catalog_ref 스키마 / idempotent upsert(by 물품식별번호) /
//       dedup-match(exact만 auto, fuzzy는 후보 주석) / canonical(db.product) write 0.
// 패턴: sentinel(readFileSync) + pure unit. DB mount 없음.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  transformProcurementItem,
  buildRefUpsertArgs,
  matchRefToProduct,
  type ProcurementRefRow,
} from "@/lib/catalog/procurement-ref";

const REPO_WEB = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_WEB, rel), "utf8");
}

// ── 1. 스키마 계약 (sentinel) ─────────────────────────────────────────
describe("§catalog-A P1 — ProcurementCatalogRef 스키마 계약", () => {
  const schema = read("prisma/schema.prisma");

  it("모델 존재 + PK = prdctIdNo(물품식별번호)", () => {
    expect(schema).toMatch(/model ProcurementCatalogRef \{/);
    expect(schema).toMatch(/prdctIdNo\s+String\s+@id/);
  });

  it("PLAN §4 필드 전부 존재 (분류·제조사·품명·모델·provenance·승격 hook)", () => {
    for (const f of [
      "prdctClsfcNo",
      "dtilPrdctClsfcNo",
      "mfrtNm",
      "prdctNm",
      "dtilPrdctNm",
      "engPrdctNm",
      "modelNm",
      "source",
      "linkedProductId",
      "ingestedAt",
      "sourceUpdatedAt",
    ]) {
      expect(schema).toMatch(new RegExp(`\\b${f}\\b`));
    }
  });

  it("가격 필드 미적재 (가격 계층 = 별도 후속 플랜)", () => {
    const model = schema.split("model ProcurementCatalogRef {")[1]?.split("\n}")[0] ?? "";
    expect(model).not.toMatch(/price|prce|amount|unitCost/i);
  });

  it("검색 인덱스: 분류번호·제조사·품명", () => {
    const model = schema.split("model ProcurementCatalogRef {")[1]?.split("\n}")[0] ?? "";
    expect(model).toMatch(/@@index\(\[prdctClsfcNo\]\)/);
    expect(model).toMatch(/@@index\(\[mfrtNm\]\)/);
    expect(model).toMatch(/@@index\(\[prdctNm\]\)/);
  });

  it("§11.341 교훈 — Product 모델 본체 무변경 (FK/relation 미부착, plain 컬럼)", () => {
    const model = schema.split("model ProcurementCatalogRef {")[1]?.split("\n}")[0] ?? "";
    expect(model).not.toMatch(/@relation/);
    // Product 모델에 back-relation 미추가
    const product = schema.split("model Product {")[1]?.split("\nmodel ")[0] ?? "";
    expect(product).not.toMatch(/ProcurementCatalogRef/);
  });
});

// ── 2. 마이그레이션 계약 (sentinel) ────────────────────────────────────
describe("§catalog-A P1 — 마이그레이션 파일", () => {
  it("add_procurement_catalog_ref 마이그레이션 존재 + CREATE TABLE", () => {
    const dir = join(REPO_WEB, "prisma", "migrations");
    const found = readdirSync(dir).find((d) => d.includes("add_procurement_catalog_ref"));
    expect(found).toBeTruthy();
    const sql = readFileSync(join(dir, found!, "migration.sql"), "utf8");
    expect(sql).toMatch(/CREATE TABLE "ProcurementCatalogRef"/);
    expect(sql).toMatch(/"prdctIdNo" TEXT NOT NULL/);
    expect(sql).toMatch(/PRIMARY KEY \("prdctIdNo"\)/);
    expect(sql).toMatch(/CREATE INDEX .*prdctClsfcNo/);
  });
});

// ── 3. transform 계약 (unit) ─────────────────────────────────────────
describe("§catalog-A P1 — transformProcurementItem", () => {
  const apiItem = {
    prdctIdntNo: "24341501-00001",
    prdctClsfcNo: "41115404",
    dtilPrdctClsfcNo: "4111540401",
    mfrtNm: "써모피셔",
    prdctNm: "분광광도계",
    dtilPrdctNm: "자외선가시광선분광광도계",
    engPrdctNm: "UV-Vis Spectrophotometer",
    mdlNm: "NanoDrop One",
    rgstDt: "2025-11-03",
  };

  it("API 응답 → ref row 매핑 + provenance 고정", () => {
    const row = transformProcurementItem(apiItem);
    expect(row).not.toBeNull();
    expect(row!.prdctIdNo).toBe("24341501-00001");
    expect(row!.prdctClsfcNo).toBe("41115404");
    expect(row!.mfrtNm).toBe("써모피셔");
    expect(row!.modelNm).toBe("NanoDrop One");
    expect(row!.source).toBe("public_procurement");
    expect(row!.linkedProductId).toBeNull();
  });

  it("물품식별번호 없는 항목 reject (backbone 밖 = null)", () => {
    expect(transformProcurementItem({ ...apiItem, prdctIdntNo: "" })).toBeNull();
    expect(transformProcurementItem({ ...apiItem, prdctIdntNo: undefined })).toBeNull();
  });
});

// ── 4. idempotent upsert 계약 (unit) ──────────────────────────────────
describe("§catalog-A P1 — buildRefUpsertArgs (idempotent by 물품식별번호)", () => {
  const row: ProcurementRefRow = {
    prdctIdNo: "24341501-00001",
    prdctClsfcNo: "41115404",
    dtilPrdctClsfcNo: "4111540401",
    mfrtNm: "써모피셔",
    prdctNm: "분광광도계",
    dtilPrdctNm: "자외선가시광선분광광도계",
    engPrdctNm: "UV-Vis Spectrophotometer",
    modelNm: "NanoDrop One",
    source: "public_procurement",
    linkedProductId: null,
    sourceUpdatedAt: "2025-11-03",
  };

  it("where = PK(prdctIdNo), 동일 입력 → 동일 args (idempotent)", () => {
    const a = buildRefUpsertArgs(row);
    const b = buildRefUpsertArgs(row);
    expect(a.where).toEqual({ prdctIdNo: "24341501-00001" });
    expect(a).toEqual(b);
  });

  it("update에 linkedProductId 미포함 — 재ingest가 승격 link를 덮지 않음", () => {
    const args = buildRefUpsertArgs(row);
    expect(args.create.linkedProductId).toBeNull();
    expect("linkedProductId" in args.update).toBe(false);
  });
});

// ── 5. dedup match 계약 (unit) — exact만 auto, fuzzy는 후보 ───────────
describe("§catalog-A P1 — matchRefToProduct", () => {
  const ref: ProcurementRefRow = {
    prdctIdNo: "24341501-00001",
    prdctClsfcNo: "41115404",
    dtilPrdctClsfcNo: null,
    mfrtNm: "Thermo Fisher",
    prdctNm: "분광광도계",
    dtilPrdctNm: null,
    engPrdctNm: null,
    modelNm: "NanoDrop One",
    source: "public_procurement",
    linkedProductId: null,
    sourceUpdatedAt: null,
  };
  const products = [
    { id: "p1", name: "NanoDrop One 분광광도계", brand: "Thermo Fisher", manufacturer: null, modelNumber: "NanoDrop One" },
    { id: "p2", name: "분광광도계 셀", brand: "Hellma", manufacturer: null, modelNumber: null },
  ];

  it("제조사+모델 정규화 exact → auto-link", () => {
    const m = matchRefToProduct(ref, products);
    expect(m).toEqual({ kind: "auto-link", productId: "p1" });
  });

  it("모델 불일치 → fuzzy 후보만(candidate), 절대 auto 아님", () => {
    const m = matchRefToProduct({ ...ref, modelNm: "NanoDrop Eight" }, products);
    expect(m?.kind === "auto-link").toBe(false);
  });

  it("대소문자·공백 정규화 동등 처리", () => {
    const m = matchRefToProduct(
      { ...ref, mfrtNm: "thermo  fisher", modelNm: "nanodrop one" },
      products,
    );
    expect(m).toEqual({ kind: "auto-link", productId: "p1" });
  });
});

// ── 6. canonical truth boundary (sentinel) ────────────────────────────
describe("§catalog-A P1 — canonical 보호 (db.product write 0)", () => {
  it("procurement-ref lib에 product create/update/delete 0", () => {
    const src = read("src/lib/catalog/procurement-ref.ts");
    expect(src).not.toMatch(/product\.(create|update|upsert|delete)/);
    expect(src).not.toMatch(/prisma\.\$executeRaw/);
  });
});
