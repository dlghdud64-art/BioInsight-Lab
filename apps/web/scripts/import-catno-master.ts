/**
 * §11.336-data — 통합 제품 마스터 + 벤더 import (Product + Vendor + ProductVendor)
 *
 * 검증된 실거래 데이터(시약관리대장 + 구매신청내역) 286 Product / 68 Vendor /
 * 269 ProductVendor 를 운영 DB 에 투입. canonical truth = Prisma(§11.336-data 진단).
 *
 * 실행 방법 (apps/web):
 *   1) DRY-RUN (기본 — 아무것도 쓰지 않음, 매칭/신규/충돌 건수만 보고):
 *        npx tsx scripts/import-catno-master.ts
 *   2) 실제 적용 (호영님 "진행" 후에만):
 *        npx tsx scripts/import-catno-master.ts --apply
 *
 * 주의:
 *   - DIRECT_URL 환경 변수 필요(.env.local) — production DB.
 *   - Product.catalogNumber 는 unique 제약 없음 → findFirst(insensitive)로 매칭.
 *   - ProductVendor 는 @@unique([productId, vendorId]) → upsert.
 *   - 환각 방지: price/leadTime 없으면 null(추측 X). 전부 실거래 데이터.
 *   - merge: 입력 단계에서 Cat.No 중복 23그룹은 긴 이름으로 이미 병합(prepared.json).
 *
 * 매칭 정책 (Product):
 *   1. catalogNumber 정확 일치(insensitive) → 기존 Product 재사용(벤더만 추가).
 *   2. (1) 없고 name+manufacturer 일치 → 기존 Product 의 빈 catalogNumber 채우기(§11.336 옵션 A).
 *   3. 매칭 0 → 신규 Product 생성.
 */

import { PrismaClient, ProductCategory } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const APPLY = process.argv.includes("--apply");

const prisma = new PrismaClient({
  log: ["error"],
  datasources: process.env.DIRECT_URL
    ? { db: { url: process.env.DIRECT_URL } }
    : undefined,
});

interface PreparedProduct {
  catalogNumber: string;
  name: string;
  category: keyof typeof ProductCategory; // REAGENT / TOOL / RAW_MATERIAL
  category_kr: string;
  manufacturer: string | null;
  grade: string | null;
  vendors: string[];
  merged_from: number;
}
interface Prepared {
  products: PreparedProduct[];
  vendors: string[];
  skipped: string[];
}

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

async function main() {
  const dataPath = path.resolve(__dirname, "./catno-master-prepared.json");
  const data: Prepared = JSON.parse(fs.readFileSync(dataPath, "utf8"));

  console.log("═══════════════════════════════════════════════");
  console.log(`§11.336-data import  [${APPLY ? "APPLY (실제 쓰기)" : "DRY-RUN (쓰기 없음)"}]`);
  console.log("═══════════════════════════════════════════════");
  console.log(`입력: Product ${data.products.length} / Vendor ${data.vendors.length} / skip ${data.skipped.length}`);
  console.log("");

  // ── 1. Vendor 매칭/신규 분석 ──
  const vendorIdByName = new Map<string, string>();
  let vendorExisting = 0;
  let vendorNew = 0;
  for (const vname of data.vendors) {
    const found = await prisma.vendor.findFirst({
      where: { name: { equals: vname, mode: "insensitive" } },
      select: { id: true },
    });
    if (found) {
      vendorIdByName.set(vname, found.id);
      vendorExisting++;
    } else {
      vendorNew++;
      if (APPLY) {
        const created = await prisma.vendor.create({ data: { name: vname } });
        vendorIdByName.set(vname, created.id);
      }
    }
  }
  console.log(`[Vendor] 기존 재사용 ${vendorExisting} / 신규 ${vendorNew}`);

  // ── 2. Product 매칭/신규 분석 ──
  let pCatMatch = 0;   // catalogNumber 정확 일치(재사용)
  let pNameFill = 0;   // name+manufacturer 일치 → 빈 Cat.No 채우기
  let pNew = 0;        // 신규 생성
  let pConflict = 0;   // name+mfr 일치하나 기존 Cat.No 가 다른 값(덮어쓰기 안 함, 신규로)
  const productIdByCat = new Map<string, string>();

  for (const p of data.products) {
    const catKey = norm(p.catalogNumber);

    // (1) catalogNumber 정확 일치
    const byCat = await prisma.product.findFirst({
      where: { catalogNumber: { equals: p.catalogNumber, mode: "insensitive" } },
      select: { id: true },
    });
    if (byCat) {
      pCatMatch++;
      productIdByCat.set(catKey, byCat.id);
      continue;
    }

    // (2) name + manufacturer 일치 → 빈 Cat.No 채우기
    const byName = await prisma.product.findFirst({
      where: {
        name: { equals: p.name, mode: "insensitive" },
        ...(p.manufacturer ? { manufacturer: { equals: p.manufacturer, mode: "insensitive" } } : {}),
      },
      select: { id: true, catalogNumber: true },
    });
    if (byName) {
      if (!byName.catalogNumber || byName.catalogNumber.trim() === "") {
        pNameFill++;
        if (APPLY) {
          await prisma.product.update({
            where: { id: byName.id },
            data: { catalogNumber: p.catalogNumber },
          });
        }
        productIdByCat.set(catKey, byName.id);
        continue;
      } else if (norm(byName.catalogNumber) !== catKey) {
        // 기존 Cat.No 가 다른 값 → 덮어쓰지 않고 신규 Product 로 처리(충돌 보존).
        pConflict++;
      } else {
        pCatMatch++;
        productIdByCat.set(catKey, byName.id);
        continue;
      }
    }

    // (3) 신규 Product
    pNew++;
    if (APPLY) {
      const created = await prisma.product.create({
        data: {
          name: p.name,
          category: ProductCategory[p.category],
          catalogNumber: p.catalogNumber,
          manufacturer: p.manufacturer ?? null,
          brand: p.manufacturer ?? null,
          // §11.341 — A~E 자사등급. internalGrade 분리는 migration 선적용 후(§11.337-hotfix P0).
          //   현재는 기존 grade 필드 사용(컬럼 존재 보장). 분리 재개 시 internalGrade 로 전환.
          grade: p.grade ?? null,
        },
      });
      productIdByCat.set(catKey, created.id);
    }
  }
  console.log(`[Product] Cat.No 일치 재사용 ${pCatMatch} / 빈 Cat.No 채우기 ${pNameFill} / 신규 ${pNew} / Cat.No 충돌(신규처리) ${pConflict}`);

  // ── 3. ProductVendor 동반 생성 (검색 노출 조건) ──
  let pvNew = 0;
  let pvExisting = 0;
  let pvSkippedNoVendor = 0;     // 벤더 0개 Product
  let pvPlannedNewProduct = 0;   // dry-run: 신규 예정 Product 의 ProductVendor(전부 신규 예정)
  for (const p of data.products) {
    if (!p.vendors.length) { pvSkippedNoVendor++; continue; }
    const catKey = norm(p.catalogNumber);
    const productId = productIdByCat.get(catKey);
    for (const vname of p.vendors) {
      const vendorId = vendorIdByName.get(vname);
      if (!vendorId) continue; // dry-run 신규 벤더는 id 없음 → 신규 예정으로 계상
      if (!productId) {
        // dry-run 에서 신규 예정 Product → ProductVendor 도 전부 신규 예정.
        pvPlannedNewProduct++;
        continue;
      }
      if (APPLY) {
        await prisma.productVendor.upsert({
          where: { productId_vendorId: { productId, vendorId } },
          create: { productId, vendorId },
          update: {},
        });
        pvNew++;
      } else {
        const exists = await prisma.productVendor.findUnique({
          where: { productId_vendorId: { productId, vendorId } },
          select: { id: true },
        });
        if (exists) pvExisting++; else pvNew++;
      }
    }
  }
  const pvTotal = pvNew + pvPlannedNewProduct;
  console.log(`[ProductVendor] 신규/예정 ${pvTotal} (기존 Product분 ${pvNew}` + (!APPLY ? ` + 신규Product분 ${pvPlannedNewProduct}` : "") + `) / 이미존재 ${pvExisting} / 벤더0개 제품 skip ${pvSkippedNoVendor}`);

  console.log("");
  console.log(`skip(Cat.No 없음): ${data.skipped.join(", ") || "없음"}`);
  console.log("═══════════════════════════════════════════════");
  if (!APPLY) {
    console.log("DRY-RUN 종료 — 위 건수 확인 후 --apply 로 실제 적용하세요.");
    console.log("  (dry-run 에서 신규 Product 의 ProductVendor 는 productId 미생성이라 일부 추정치)");
  } else {
    console.log("APPLY 완료 — Product/Vendor/ProductVendor 투입됨.");
  }
}

main()
  .catch((e) => {
    console.error("오류:", e?.message ?? e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
