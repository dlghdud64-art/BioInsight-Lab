/**
 * import-master-catalog.ts — 통합 제품 마스터(316 → 정제 304) 멱등 적재 스크립트
 *
 * ⚠️ 실행은 operator-shell(클로드코드) 전용. sandbox 실행/DB 접속 금지(CLAUDE.md §9.9).
 *   operator-shell 절차:
 *     1) (선행) prisma schema 에 ProductCategory.CONSUMABLE 추가 → prisma migrate
 *        (자세한 절차는 prisma/data/MASTER_IMPORT_DRYRUN.md "schema 선행 변경" 참조)
 *     2) npx prisma generate
 *     3) npx tsx apps/web/prisma/import-master-catalog.ts
 *
 * 특징:
 *   - 입력: prisma/data/master-catalog.cleaned.json (정제·매핑 완료본)
 *   - 멱등(upsert by deterministic id) — 재실행해도 중복 생성 0
 *   - deleteMany 전체 wipe 절대 안 함 → 기존 seed(hero-*, 9제품, vendor-* 등) 보존
 *   - Vendor upsert(중복 제거) → Product upsert → ProductVendor 링크 upsert 순
 *
 * 데이터 정합:
 *   - catalogNumber 는 비-unique 속성 (서로 다른 제품이 같은 Cat.No 공유 가능)
 *   - 제품 identity = cleaned.json 의 deterministic id (mp-*)
 *   - internalGrade(A~E) 는 Prisma `grade`(HPLC/GMP)와 의미 달라 specifications JSON 에 보존
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, type ProductCategory } from "@prisma/client";

const prisma = new PrismaClient();

type CleanedVendor = { id: string; name: string };
type CleanedProduct = {
  id: string;
  name: string;
  category: ProductCategory; // REAGENT | TOOL | CONSUMABLE
  manufacturer: string | null;
  catalogNumber: string | null;
  storageCondition: string | null;
  specifications: {
    internalGrade: string | null;
    testItem: string | null;
    purchaseYears: number[];
    source: string[];
    categoryConflict?: string[];
    importFlags?: string[];
    mergedFrom?: string[];
  };
};
type CleanedProductVendor = {
  id: string;
  productId: string;
  vendorId: string;
  vendorName: string;
};
type CleanedPayload = {
  meta: Record<string, unknown>;
  vendors: CleanedVendor[];
  products: CleanedProduct[];
  productVendors: CleanedProductVendor[];
};

const DATA_PATH = join(__dirname, "data", "master-catalog.cleaned.json");

function load(): CleanedPayload {
  return JSON.parse(readFileSync(DATA_PATH, "utf8")) as CleanedPayload;
}

async function main() {
  const { vendors, products, productVendors, meta } = load();

  console.log("📦 통합 제품 마스터 적재 시작");
  console.log(
    `   입력 정제본: 제품 ${products.length} · 벤더 ${vendors.length} · 링크 ${productVendors.length}`,
  );
  console.log(`   meta: ${JSON.stringify(meta)}`);

  // --------------------------------------------------------------------------
  // 1) Vendor upsert (한글 vendor명, 중복 제거 완료) — by deterministic id
  // --------------------------------------------------------------------------
  let vCreated = 0;
  for (const v of vendors) {
    await prisma.vendor.upsert({
      where: { id: v.id },
      // 기존 이름 보존(operator 가 손댄 메타 덮어쓰지 않음) — 이름만 보강
      update: { name: v.name },
      create: {
        id: v.id,
        name: v.name,
        country: "KR",
        currency: "KRW",
      },
    });
    vCreated += 1;
  }
  console.log(`✅ Vendor upsert 완료: ${vCreated}건`);

  // --------------------------------------------------------------------------
  // 2) Product upsert — by deterministic id (mp-*). catalogNumber 는 비-unique.
  // --------------------------------------------------------------------------
  let pCreated = 0;
  for (const p of products) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: {
        name: p.name,
        category: p.category,
        manufacturer: p.manufacturer ?? undefined,
        catalogNumber: p.catalogNumber ?? null,
        storageCondition: p.storageCondition ?? null,
        specifications: p.specifications,
      },
      create: {
        id: p.id,
        name: p.name,
        category: p.category,
        manufacturer: p.manufacturer ?? undefined,
        // 비-unique 속성. placeholder('prove'/null)는 cleaned 단계에서 이미 null 처리됨.
        catalogNumber: p.catalogNumber ?? null,
        storageCondition: p.storageCondition ?? null,
        // internalGrade/testItem/purchaseYears/source/flags 보존.
        // Prisma `grade`(HPLC/GMP)에는 내부등급(A~E) 넣지 않음.
        specifications: p.specifications,
      },
    });
    pCreated += 1;
  }
  console.log(`✅ Product upsert 완료: ${pCreated}건`);

  // --------------------------------------------------------------------------
  // 3) Product-Vendor 링크 upsert — ProductVendor (@@unique([productId, vendorId]))
  //    catalog 레벨 글로벌 관계. (org-scoped OrganizationVendorProduct 아님:
  //    그 모델은 organizationId/createdById(User) 필수라 마스터 적재엔 부적합.)
  //    vendor 0개 제품은 링크 없이 제품만 적재됨.
  // --------------------------------------------------------------------------
  let lCreated = 0;
  for (const pv of productVendors) {
    await prisma.productVendor.upsert({
      where: { id: pv.id },
      update: {},
      create: {
        id: pv.id,
        productId: pv.productId,
        vendorId: pv.vendorId,
        currency: "KRW",
      },
    });
    lCreated += 1;
  }
  console.log(`✅ ProductVendor 링크 upsert 완료: ${lCreated}건`);

  console.log("\n🎉 적재 완료 (멱등). 기존 seed 제품/벤더는 보존됨.");
}

main()
  .catch((e) => {
    console.error("❌ 적재 실패:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
