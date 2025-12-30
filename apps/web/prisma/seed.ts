import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env file
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const prisma = new PrismaClient();

// ============================================================================
// 🚀 BioInsight Lab - Predictive Ordering Engine Demo Seed
// ============================================================================
//
// 이 시드 데이터는 AI 기반 구매 주기 예측 엔진을 증명하기 위해 설계되었습니다.
//
// 핵심 시나리오:
// 1. Hero Product: "Sigma-Tech PBS 1X" - 모든 연구실의 필수 소모품
// 2. 30일 주기 구매 패턴: 90일 전, 60일 전, 30일 전 구매 기록
// 3. AI가 "오늘이 재주문 시점!"을 즉시 감지할 수 있도록 설계
//
// ============================================================================

async function main() {
  console.log("🧬 BioInsight Lab - Predictive Ordering Engine Seed 시작...");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // ============================================================================
  // 날짜 계산 유틸리티
  // ============================================================================
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const daysAgo = (days: number): Date => {
    const date = new Date(today);
    date.setDate(date.getDate() - days);
    return date;
  };

  console.log(`📅 기준 날짜: ${today.toISOString().split('T')[0]}`);
  console.log(`📅 90일 전: ${daysAgo(90).toISOString().split('T')[0]}`);
  console.log(`📅 60일 전: ${daysAgo(60).toISOString().split('T')[0]}`);
  console.log(`📅 30일 전: ${daysAgo(30).toISOString().split('T')[0]}`);

  // ============================================================================
  // 1. 벤더 생성
  // ============================================================================
  console.log("\n🏢 벤더 생성 중...");

  const vendors = await Promise.all([
    prisma.vendor.upsert({
      where: { id: "vendor-thermo" },
      update: {},
      create: {
        id: "vendor-thermo",
        name: "Thermo Fisher Scientific",
        nameEn: "Thermo Fisher Scientific",
        email: "sales@thermofisher.com",
        website: "https://www.thermofisher.com",
        country: "US",
        currency: "USD",
        isPremium: true,
      },
    }),
    prisma.vendor.upsert({
      where: { id: "vendor-sigma" },
      update: {},
      create: {
        id: "vendor-sigma",
        name: "Sigma-Aldrich (Merck)",
        nameEn: "Sigma-Aldrich",
        email: "sales@sigmaaldrich.com",
        website: "https://www.sigmaaldrich.com",
        country: "DE",
        currency: "EUR",
        isPremium: true,
      },
    }),
    prisma.vendor.upsert({
      where: { id: "vendor-bio-rad" },
      update: {},
      create: {
        id: "vendor-bio-rad",
        name: "Bio-Rad Laboratories",
        nameEn: "Bio-Rad",
        email: "sales@bio-rad.com",
        website: "https://www.bio-rad.com",
        country: "US",
        currency: "USD",
      },
    }),
    prisma.vendor.upsert({
      where: { id: "vendor-corning" },
      update: {},
      create: {
        id: "vendor-corning",
        name: "Corning Life Sciences",
        nameEn: "Corning",
        email: "sales@corning.com",
        website: "https://www.corning.com",
        country: "US",
        currency: "USD",
      },
    }),
    prisma.vendor.upsert({
      where: { id: "vendor-welgene" },
      update: {},
      create: {
        id: "vendor-welgene",
        name: "Welgene Inc.",
        nameEn: "Welgene",
        email: "sales@welgene.com",
        website: "https://www.welgene.com",
        country: "KR",
        currency: "KRW",
      },
    }),
  ]);

  console.log(`✅ ${vendors.length}개 벤더 생성 완료`);

  // ============================================================================
  // 2. HERO PRODUCT 생성 - Sigma-Tech PBS 1X (AI 예측의 핵심!)
  // ============================================================================
  console.log("\n⭐ HERO PRODUCT 생성 중...");

  const heroProduct = await prisma.product.upsert({
    where: { id: "hero-pbs-1x" },
    update: {},
    create: {
      id: "hero-pbs-1x",
      name: "Sigma-Tech PBS 1X (Sterile)",
      nameEn: "Sigma-Tech PBS 1X Phosphate Buffered Saline",
      description: "세포 배양 및 세척용 인산완충식염수 - 무균, 내독소 테스트 완료. 모든 연구실의 필수 소모품.",
      descriptionEn: "Sterile phosphate buffered saline for cell culture and washing. Endotoxin tested. Essential for every lab.",
      category: "REAGENT",
      brand: "Sigma-Tech",
      modelNumber: "ST-PBS-1X-500",
      catalogNumber: "ST-PBS-1X-500",
      grade: "Cell Culture Grade",
      specification: "500mL, pH 7.4, Sterile",
      regulatoryCompliance: "USP",
      specifications: {
        volume: "500mL",
        pH: "7.4 ± 0.1",
        sterile: true,
        endotoxin: "<0.25 EU/mL",
        osmolality: "280-320 mOsm/kg",
      },
      storageCondition: "2-8°C 냉장 보관",
      safetyNote: "냉장 보관 필수. 개봉 후 1개월 내 사용 권장.",
      imageUrl: "https://via.placeholder.com/300x300?text=PBS+1X+Hero",
      msdsUrl: "https://example.com/msds/pbs-1x.pdf",
    },
  });

  console.log(`⭐ HERO PRODUCT 생성: ${heroProduct.name}`);

  // Hero Product - Vendor 연결
  await prisma.productVendor.upsert({
    where: { id: "pv-hero-pbs" },
    update: {},
    create: {
      id: "pv-hero-pbs",
      productId: heroProduct.id,
      vendorId: "vendor-sigma",
      price: 18.5,
      currency: "EUR",
      priceInKRW: 28500,
      stockStatus: "In Stock",
      leadTime: 3,
      minOrderQty: 1,
      isPremiumFeatured: true,
      premiumPriority: 1,
    },
  });

  // ============================================================================
  // 3. 추가 제품들 (대시보드 볼륨감 + 다양한 카테고리)
  // ============================================================================
  console.log("\n🧪 추가 제품 생성 중...");

  const products = await Promise.all([
    // Premium Reagents
    prisma.product.upsert({
      where: { id: "product-fbs-premium" },
      update: {},
      create: {
        id: "product-fbs-premium",
        name: "Premium Fetal Bovine Serum",
        nameEn: "Premium FBS - Australia Origin",
        description: "호주산 프리미엄 태아 소 혈청. 최저 내독소, 최고 품질.",
        category: "REAGENT",
        brand: "Gibco",
        catalogNumber: "A3160801",
        grade: "Premium",
        specification: "500mL",
        specifications: { origin: "Australia", endotoxin: "<3 EU/mL" },
        storageCondition: "-20°C 동결 보관",
      },
    }),
    prisma.product.upsert({
      where: { id: "product-dmem-hg" },
      update: {},
      create: {
        id: "product-dmem-hg",
        name: "DMEM High Glucose with GlutaMAX",
        nameEn: "DMEM, high glucose, GlutaMAX",
        description: "고포도당 DMEM 배지 + GlutaMAX (안정화 글루타민)",
        category: "REAGENT",
        brand: "Gibco",
        catalogNumber: "10569-010",
        grade: "Cell Culture Grade",
        specification: "500mL",
        storageCondition: "2-8°C",
      },
    }),
    prisma.product.upsert({
      where: { id: "product-trypsin-edta" },
      update: {},
      create: {
        id: "product-trypsin-edta",
        name: "Trypsin-EDTA (0.25%)",
        nameEn: "Trypsin-EDTA Solution 0.25%",
        description: "세포 계대배양용 트립신-EDTA 용액",
        category: "REAGENT",
        brand: "Gibco",
        catalogNumber: "25200-056",
        grade: "Cell Culture Grade",
        specification: "100mL",
        storageCondition: "-20°C",
      },
    }),
    // Antibodies (고가 아이템)
    prisma.product.upsert({
      where: { id: "product-p53-ab" },
      update: {},
      create: {
        id: "product-p53-ab",
        name: "Anti-p53 Antibody (DO-1)",
        nameEn: "p53 Monoclonal Antibody",
        description: "p53 종양억제 단백질 검출용 모노클로날 항체",
        category: "REAGENT",
        brand: "Santa Cruz Biotechnology",
        catalogNumber: "sc-126",
        grade: "Research Grade",
        specification: "200µg/mL, 100µL",
        storageCondition: "-20°C",
      },
    }),
    prisma.product.upsert({
      where: { id: "product-egfr-ab" },
      update: {},
      create: {
        id: "product-egfr-ab",
        name: "Anti-EGFR Antibody",
        nameEn: "EGFR Rabbit Monoclonal Antibody",
        description: "EGFR 수용체 검출용 토끼 모노클로날 항체",
        category: "REAGENT",
        brand: "Cell Signaling Technology",
        catalogNumber: "4267S",
        grade: "Research Grade",
        specification: "100µL",
        storageCondition: "-20°C",
      },
    }),
    // Lab Consumables
    prisma.product.upsert({
      where: { id: "product-pipette-tips-1000" },
      update: {},
      create: {
        id: "product-pipette-tips-1000",
        name: "Filtered Pipette Tips 1000µL",
        nameEn: "Sterile Filter Tips 1000µL",
        description: "멸균 필터 피펫 팁 1000µL (96팁/랙, 10랙/박스)",
        category: "TOOL",
        brand: "Rainin",
        catalogNumber: "RT-LTS-A-1000µL-F",
        grade: "Sterile",
        specification: "960 tips/box",
      },
    }),
    prisma.product.upsert({
      where: { id: "product-cell-culture-flask" },
      update: {},
      create: {
        id: "product-cell-culture-flask",
        name: "Cell Culture Flask T-75",
        nameEn: "T-75 Flask, TC-Treated",
        description: "75cm² 세포배양 플라스크 (Tissue Culture Treated)",
        category: "TOOL",
        brand: "Corning",
        catalogNumber: "430641U",
        grade: "TC-Treated",
        specification: "75cm², 5/sleeve, 100/case",
      },
    }),
    // Equipment
    prisma.product.upsert({
      where: { id: "product-co2-incubator" },
      update: {},
      create: {
        id: "product-co2-incubator",
        name: "CO2 Incubator - 165L",
        nameEn: "Direct Heat CO2 Incubator",
        description: "165L 용량 이산화탄소 배양기. 오염 방지 구리 챔버.",
        category: "EQUIPMENT",
        brand: "Thermo Fisher",
        catalogNumber: "51033557",
        grade: "Research Grade",
        specification: "165L, 5% CO2",
        storageCondition: "실온",
      },
    }),
  ]);

  console.log(`✅ ${products.length}개 추가 제품 생성 완료`);

  // 제품-벤더 연결
  await Promise.all([
    prisma.productVendor.upsert({
      where: { id: "pv-fbs-premium" },
      update: {},
      create: {
        id: "pv-fbs-premium",
        productId: "product-fbs-premium",
        vendorId: "vendor-thermo",
        price: 650,
        currency: "USD",
        priceInKRW: 890000,
        stockStatus: "In Stock",
        leadTime: 7,
      },
    }),
    prisma.productVendor.upsert({
      where: { id: "pv-dmem-hg" },
      update: {},
      create: {
        id: "pv-dmem-hg",
        productId: "product-dmem-hg",
        vendorId: "vendor-thermo",
        price: 52,
        currency: "USD",
        priceInKRW: 72000,
        stockStatus: "In Stock",
        leadTime: 5,
      },
    }),
    prisma.productVendor.upsert({
      where: { id: "pv-trypsin" },
      update: {},
      create: {
        id: "pv-trypsin",
        productId: "product-trypsin-edta",
        vendorId: "vendor-thermo",
        price: 38,
        currency: "USD",
        priceInKRW: 52000,
        stockStatus: "In Stock",
        leadTime: 5,
      },
    }),
    prisma.productVendor.upsert({
      where: { id: "pv-p53-ab" },
      update: {},
      create: {
        id: "pv-p53-ab",
        productId: "product-p53-ab",
        vendorId: "vendor-sigma",
        price: 420,
        currency: "USD",
        priceInKRW: 580000,
        stockStatus: "In Stock",
        leadTime: 10,
      },
    }),
    prisma.productVendor.upsert({
      where: { id: "pv-egfr-ab" },
      update: {},
      create: {
        id: "pv-egfr-ab",
        productId: "product-egfr-ab",
        vendorId: "vendor-sigma",
        price: 485,
        currency: "USD",
        priceInKRW: 670000,
        stockStatus: "Low Stock",
        leadTime: 14,
      },
    }),
    prisma.productVendor.upsert({
      where: { id: "pv-tips" },
      update: {},
      create: {
        id: "pv-tips",
        productId: "product-pipette-tips-1000",
        vendorId: "vendor-corning",
        price: 185,
        currency: "USD",
        priceInKRW: 255000,
        stockStatus: "In Stock",
        leadTime: 3,
      },
    }),
    prisma.productVendor.upsert({
      where: { id: "pv-flask" },
      update: {},
      create: {
        id: "pv-flask",
        productId: "product-cell-culture-flask",
        vendorId: "vendor-corning",
        price: 320,
        currency: "USD",
        priceInKRW: 440000,
        stockStatus: "In Stock",
        leadTime: 5,
      },
    }),
    prisma.productVendor.upsert({
      where: { id: "pv-incubator" },
      update: {},
      create: {
        id: "pv-incubator",
        productId: "product-co2-incubator",
        vendorId: "vendor-thermo",
        price: 12500,
        currency: "USD",
        priceInKRW: 17200000,
        stockStatus: "Made to Order",
        leadTime: 45,
      },
    }),
  ]);

  console.log("✅ 제품-벤더 연결 완료");

  // ============================================================================
  // 4. 조직 생성
  // ============================================================================
  console.log("\n🏛️ 조직 생성 중...");

  await Promise.all([
    prisma.organization.upsert({
      where: { id: "org-bioinsight-lab" },
      update: {},
      create: {
        id: "org-bioinsight-lab",
        name: "BioInsight Research Lab",
        description: "AI 기반 바이오 연구 플랫폼 - 서울 본사",
        plan: "ORGANIZATION",
      },
    }),
  ]);

  console.log("✅ 조직 생성 완료");

  // ============================================================================
  // 5. 🔥 핵심: 30일 주기 구매 이력 (AI 예측 엔진의 핵심 데이터!)
  // ============================================================================
  console.log("\n🔥 30일 주기 구매 이력 생성 중 (AI 예측 핵심 데이터)...");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // 기존 구매 기록 삭제 (clean slate)
  await prisma.purchaseRecord.deleteMany({
    where: { scopeKey: "guest-demo" },
  });

  // ============================================================================
  // 🎯 HERO PRODUCT 구매 이력 - 정확히 30일 주기!
  // ============================================================================
  const heroPurchases = await Promise.all([
    // 90일 전 구매
    prisma.purchaseRecord.create({
      data: {
        scopeKey: "guest-demo",
        purchasedAt: daysAgo(90),
        vendorName: "Sigma-Aldrich (Merck)",
        category: "REAGENT",
        itemName: "Sigma-Tech PBS 1X (Sterile)",
        catalogNumber: "ST-PBS-1X-500",
        unit: "ea",
        qty: 10,
        unitPrice: 28500,
        amount: 285000,
        currency: "KRW",
        source: "import",
      },
    }),
    // 60일 전 구매
    prisma.purchaseRecord.create({
      data: {
        scopeKey: "guest-demo",
        purchasedAt: daysAgo(60),
        vendorName: "Sigma-Aldrich (Merck)",
        category: "REAGENT",
        itemName: "Sigma-Tech PBS 1X (Sterile)",
        catalogNumber: "ST-PBS-1X-500",
        unit: "ea",
        qty: 10,
        unitPrice: 28500,
        amount: 285000,
        currency: "KRW",
        source: "import",
      },
    }),
    // 30일 전 구매 (가장 최근)
    prisma.purchaseRecord.create({
      data: {
        scopeKey: "guest-demo",
        purchasedAt: daysAgo(30),
        vendorName: "Sigma-Aldrich (Merck)",
        category: "REAGENT",
        itemName: "Sigma-Tech PBS 1X (Sterile)",
        catalogNumber: "ST-PBS-1X-500",
        unit: "ea",
        qty: 10,
        unitPrice: 28500,
        amount: 285000,
        currency: "KRW",
        source: "import",
      },
    }),
  ]);

  console.log(`🎯 HERO PRODUCT 30일 주기 구매 이력: ${heroPurchases.length}건`);
  console.log("   → AI가 감지할 패턴: '이 연구실은 30일마다 PBS를 구매한다!'");
  console.log("   → 오늘 예측: '재주문 시점입니다!'");

  // ============================================================================
  // 6. 대시보드 볼륨감을 위한 추가 구매 이력 (억 단위 연구실!)
  // ============================================================================
  console.log("\n💰 억 단위 연구실 구매 이력 생성 중...");

  const additionalPurchases = await Promise.all([
    // 최근 주문 1: 배송 중 (2일 전 주문)
    prisma.purchaseRecord.create({
      data: {
        scopeKey: "guest-demo",
        purchasedAt: daysAgo(2),
        vendorName: "Thermo Fisher Scientific",
        category: "REAGENT",
        itemName: "Premium Fetal Bovine Serum (Australia)",
        catalogNumber: "A3160801",
        unit: "ea",
        qty: 4,
        unitPrice: 890000,
        amount: 3560000, // 356만원
        currency: "KRW",
        source: "import",
      },
    }),
    // 최근 주문 2: 어제 주문
    prisma.purchaseRecord.create({
      data: {
        scopeKey: "guest-demo",
        purchasedAt: daysAgo(1),
        vendorName: "Cell Signaling Technology",
        category: "REAGENT",
        itemName: "Anti-EGFR Antibody + Anti-p53 Antibody Bundle",
        catalogNumber: "CST-BUNDLE-001",
        unit: "set",
        qty: 2,
        unitPrice: 1250000,
        amount: 2500000, // 250만원
        currency: "KRW",
        source: "import",
      },
    }),
    // 최근 주문 3: 5일 전 대량 주문
    prisma.purchaseRecord.create({
      data: {
        scopeKey: "guest-demo",
        purchasedAt: daysAgo(5),
        vendorName: "Corning Life Sciences",
        category: "TOOL",
        itemName: "Cell Culture Flask T-75 (Case of 100)",
        catalogNumber: "430641U",
        unit: "case",
        qty: 5,
        unitPrice: 440000,
        amount: 2200000, // 220만원
        currency: "KRW",
        source: "import",
      },
    }),
    // 최근 주문 4: 7일 전 정기 주문
    prisma.purchaseRecord.create({
      data: {
        scopeKey: "guest-demo",
        purchasedAt: daysAgo(7),
        vendorName: "Rainin",
        category: "TOOL",
        itemName: "Filtered Pipette Tips 1000µL (10 boxes)",
        catalogNumber: "RT-LTS-A-1000µL-F",
        unit: "box",
        qty: 10,
        unitPrice: 255000,
        amount: 2550000, // 255만원
        currency: "KRW",
        source: "import",
      },
    }),
    // 최근 주문 5: 대형 장비 주문 (15일 전)
    prisma.purchaseRecord.create({
      data: {
        scopeKey: "guest-demo",
        purchasedAt: daysAgo(15),
        vendorName: "Thermo Fisher Scientific",
        category: "EQUIPMENT",
        itemName: "CO2 Incubator - 165L (Copper Chamber)",
        catalogNumber: "51033557",
        unit: "ea",
        qty: 1,
        unitPrice: 17200000,
        amount: 17200000, // 1720만원
        currency: "KRW",
        source: "import",
      },
    }),
    // 추가 볼륨 데이터: 지난 달 대량 구매
    prisma.purchaseRecord.create({
      data: {
        scopeKey: "guest-demo",
        purchasedAt: daysAgo(35),
        vendorName: "Thermo Fisher Scientific",
        category: "REAGENT",
        itemName: "DMEM High Glucose with GlutaMAX (Case of 24)",
        catalogNumber: "10569-010",
        unit: "case",
        qty: 3,
        unitPrice: 1728000,
        amount: 5184000, // 518만원
        currency: "KRW",
        source: "import",
      },
    }),
    prisma.purchaseRecord.create({
      data: {
        scopeKey: "guest-demo",
        purchasedAt: daysAgo(42),
        vendorName: "Gibco",
        category: "REAGENT",
        itemName: "Trypsin-EDTA 0.25% (Case of 20)",
        catalogNumber: "25200-056",
        unit: "case",
        qty: 2,
        unitPrice: 1040000,
        amount: 2080000, // 208만원
        currency: "KRW",
        source: "import",
      },
    }),
    prisma.purchaseRecord.create({
      data: {
        scopeKey: "guest-demo",
        purchasedAt: daysAgo(55),
        vendorName: "Santa Cruz Biotechnology",
        category: "REAGENT",
        itemName: "Anti-p53 Antibody (DO-1) - Lab Pack",
        catalogNumber: "sc-126-LP",
        unit: "pack",
        qty: 3,
        unitPrice: 1740000,
        amount: 5220000, // 522만원
        currency: "KRW",
        source: "import",
      },
    }),
    // 2달 전 데이터
    prisma.purchaseRecord.create({
      data: {
        scopeKey: "guest-demo",
        purchasedAt: daysAgo(65),
        vendorName: "Corning Life Sciences",
        category: "TOOL",
        itemName: "96-Well Microplates, Clear (Case of 50)",
        catalogNumber: "3599",
        unit: "case",
        qty: 4,
        unitPrice: 680000,
        amount: 2720000, // 272만원
        currency: "KRW",
        source: "import",
      },
    }),
    prisma.purchaseRecord.create({
      data: {
        scopeKey: "guest-demo",
        purchasedAt: daysAgo(75),
        vendorName: "Thermo Fisher Scientific",
        category: "REAGENT",
        itemName: "Premium FBS - 10-bottle Bundle",
        catalogNumber: "A3160801-10",
        unit: "bundle",
        qty: 1,
        unitPrice: 8500000,
        amount: 8500000, // 850만원
        currency: "KRW",
        source: "import",
      },
    }),
    // 3달 전 장비 구매
    prisma.purchaseRecord.create({
      data: {
        scopeKey: "guest-demo",
        purchasedAt: daysAgo(85),
        vendorName: "Bio-Rad Laboratories",
        category: "EQUIPMENT",
        itemName: "ChemiDoc MP Imaging System",
        catalogNumber: "12003154",
        unit: "ea",
        qty: 1,
        unitPrice: 45000000,
        amount: 45000000, // 4500만원
        currency: "KRW",
        source: "import",
      },
    }),
    prisma.purchaseRecord.create({
      data: {
        scopeKey: "guest-demo",
        purchasedAt: daysAgo(95),
        vendorName: "Eppendorf",
        category: "EQUIPMENT",
        itemName: "Centrifuge 5425 with Rotor",
        catalogNumber: "5405000565",
        unit: "ea",
        qty: 2,
        unitPrice: 8900000,
        amount: 17800000, // 1780만원
        currency: "KRW",
        source: "import",
      },
    }),
  ]);

  console.log(`💰 추가 구매 이력: ${additionalPurchases.length}건`);

  // ============================================================================
  // 7. 예산 설정 (억 단위 연구실!)
  // ============================================================================
  console.log("\n📊 월별 예산 설정 중...");

  // 기존 예산 삭제
  await prisma.budget.deleteMany({
    where: { scopeKey: "guest-demo" },
  });

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const budgets = await Promise.all([
    // 이번 달
    prisma.budget.create({
      data: {
        scopeKey: "guest-demo",
        yearMonth: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`,
        amount: 50000000, // 5천만원
        currency: "KRW",
        description: "Q4 연구 예산 - 장비 도입 포함",
      },
    }),
    // 지난 달
    prisma.budget.create({
      data: {
        scopeKey: "guest-demo",
        yearMonth: `${currentYear}-${String(currentMonth).padStart(2, '0')}`,
        amount: 35000000, // 3500만원
        currency: "KRW",
        description: "정기 소모품 + 시약 예산",
      },
    }),
    // 2달 전
    prisma.budget.create({
      data: {
        scopeKey: "guest-demo",
        yearMonth: `${currentYear}-${String(currentMonth - 1).padStart(2, '0')}`,
        amount: 30000000, // 3천만원
        currency: "KRW",
        description: "정기 연구 예산",
      },
    }),
    // 3달 전 (장비 구매 포함)
    prisma.budget.create({
      data: {
        scopeKey: "guest-demo",
        yearMonth: `${currentYear}-${String(currentMonth - 2).padStart(2, '0')}`,
        amount: 80000000, // 8천만원
        currency: "KRW",
        description: "대형 장비 도입 특별 예산",
      },
    }),
  ]);

  console.log(`📊 ${budgets.length}개월 예산 설정 완료`);

  // ============================================================================
  // 8. 테스트 사용자
  // ============================================================================
  console.log("\n👤 테스트 사용자 생성 중...");

  await prisma.user.upsert({
    where: { id: "user-bioinsight-admin" },
    update: {},
    create: {
      id: "user-bioinsight-admin",
      email: "admin@bioinsight-lab.com",
      name: "Dr. 김바이오",
      role: "ADMIN",
      organization: "BioInsight Research Lab",
    },
  });

  await prisma.user.upsert({
    where: { id: "user-bioinsight-researcher" },
    update: {},
    create: {
      id: "user-bioinsight-researcher",
      email: "researcher@bioinsight-lab.com",
      name: "이연구",
      role: "RESEARCHER",
      organization: "BioInsight Research Lab",
    },
  });

  console.log("✅ 테스트 사용자 생성 완료");

  // ============================================================================
  // 9. 🚀 Zero-Touch Inventory - "구매하면 자동으로 재고가 된다"
  // ============================================================================
  console.log("\n📦 Zero-Touch Inventory 생성 중...");
  console.log("   → 철학: 구매 완료 → 자동으로 재고에 반영");
  console.log("   → AI가 소비율을 추적하여 자동 재주문 알림");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // 기존 인벤토리 삭제 (clean slate)
  await prisma.inventoryUsage.deleteMany({});
  await prisma.productInventory.deleteMany({});

  // ============================================================================
  // 🔥 HERO PRODUCT 인벤토리 - AI가 추적하는 핵심 품목
  // ============================================================================
  const pbsInventory = await prisma.productInventory.create({
    data: {
      id: "inv-hero-pbs",
      userId: "user-bioinsight-researcher",
      productId: "hero-pbs-1x",
      currentQuantity: 2, // 🔥 딱 2개 남음 - LOW STOCK!
      unit: "ea",
      safetyStock: 5, // 안전 재고: 5개
      minOrderQty: 10,
      location: "냉장고 A-1",
      expiryDate: new Date(now.getFullYear(), now.getMonth() + 2, 15), // 2달 후 만료
      autoReorderEnabled: true, // AI 자동 재주문 활성화!
      autoReorderThreshold: 3, // 3개 이하면 알림
      notes: "🔔 AI 예측: 30일 주기 소비 패턴 감지. 오늘 재주문 권장!",
    },
  });

  console.log(`⭐ HERO PRODUCT 재고: ${pbsInventory.currentQuantity}개 (LOW STOCK - AI 알림 대상)`);

  // ============================================================================
  // 다양한 재고 상태 품목들
  // ============================================================================
  const inventoryItems = await Promise.all([
    // ✅ In Stock - 충분한 재고
    prisma.productInventory.create({
      data: {
        id: "inv-fbs",
        userId: "user-bioinsight-researcher",
        productId: "product-fbs-premium",
        currentQuantity: 8, // 충분함
        unit: "ea",
        safetyStock: 2,
        minOrderQty: 1,
        location: "초저온 냉동고 -80°C",
        expiryDate: new Date(now.getFullYear() + 1, 5, 1), // 내년 6월
        autoReorderEnabled: true,
        autoReorderThreshold: 2,
        notes: "2일 전 4개 입고 완료. 재고 충분.",
      },
    }),

    // ✅ In Stock - 넉넉한 배지
    prisma.productInventory.create({
      data: {
        id: "inv-dmem",
        userId: "user-bioinsight-researcher",
        productId: "product-dmem-hg",
        currentQuantity: 72, // 3케이스 = 72병
        unit: "ea",
        safetyStock: 12,
        minOrderQty: 24,
        location: "냉장고 B-2",
        expiryDate: new Date(now.getFullYear(), now.getMonth() + 4, 20),
        autoReorderEnabled: true,
        autoReorderThreshold: 24,
        notes: "35일 전 3케이스 입고. 약 60일분 재고.",
      },
    }),

    // ⚠️ Low Stock - Trypsin 부족!
    prisma.productInventory.create({
      data: {
        id: "inv-trypsin",
        userId: "user-bioinsight-researcher",
        productId: "product-trypsin-edta",
        currentQuantity: 3, // 🔥 부족!
        unit: "ea",
        safetyStock: 10,
        minOrderQty: 20,
        location: "냉동고 -20°C",
        expiryDate: new Date(now.getFullYear(), now.getMonth() + 1, 10),
        autoReorderEnabled: true,
        autoReorderThreshold: 5,
        notes: "⚠️ 재고 부족! 42일 전 입고분 거의 소진. 즉시 주문 필요.",
      },
    }),

    // ✅ In Stock - 항체 (고가, 소량 보유)
    prisma.productInventory.create({
      data: {
        id: "inv-p53-ab",
        userId: "user-bioinsight-researcher",
        productId: "product-p53-ab",
        currentQuantity: 5, // 5 vials
        unit: "vial",
        safetyStock: 2,
        minOrderQty: 1,
        location: "냉동고 -20°C / AB-RACK",
        expiryDate: new Date(now.getFullYear() + 1, 11, 31),
        autoReorderEnabled: false, // 고가 품목은 수동 관리
        notes: "55일 전 Lab Pack 입고. Western Blot 실험용.",
      },
    }),

    // ⚠️ Low Stock - EGFR 항체 (어제 도착, 바로 사용 시작)
    prisma.productInventory.create({
      data: {
        id: "inv-egfr-ab",
        userId: "user-bioinsight-researcher",
        productId: "product-egfr-ab",
        currentQuantity: 2, // 어제 도착한 2개
        unit: "vial",
        safetyStock: 2,
        minOrderQty: 1,
        location: "냉동고 -20°C / AB-RACK",
        expiryDate: new Date(now.getFullYear() + 1, 6, 15),
        autoReorderEnabled: true,
        autoReorderThreshold: 1,
        notes: "1일 전 입고. 신규 프로젝트용. 소비율 모니터링 시작.",
      },
    }),

    // ✅ In Stock - 피펫팁 (대량 보유)
    prisma.productInventory.create({
      data: {
        id: "inv-tips",
        userId: "user-bioinsight-researcher",
        productId: "product-pipette-tips-1000",
        currentQuantity: 9600, // 10박스 = 9600개
        unit: "ea",
        safetyStock: 2000,
        minOrderQty: 960,
        location: "소모품 선반 C-1",
        autoReorderEnabled: true,
        autoReorderThreshold: 1920, // 2박스
        notes: "7일 전 10박스 입고. 일 평균 100개 사용. 약 90일분.",
      },
    }),

    // ✅ In Stock - Flask (충분)
    prisma.productInventory.create({
      data: {
        id: "inv-flask",
        userId: "user-bioinsight-researcher",
        productId: "product-cell-culture-flask",
        currentQuantity: 450, // 5케이스 - 사용분
        unit: "ea",
        safetyStock: 100,
        minOrderQty: 100,
        location: "소모품 선반 C-2",
        autoReorderEnabled: true,
        autoReorderThreshold: 100,
        notes: "5일 전 5케이스 입고. 일 평균 10개 사용. 약 45일분.",
      },
    }),

    // 🔧 장비 - 수량 개념 없음
    prisma.productInventory.create({
      data: {
        id: "inv-incubator",
        userId: "user-bioinsight-researcher",
        productId: "product-co2-incubator",
        currentQuantity: 1,
        unit: "ea",
        location: "세포배양실 Main",
        autoReorderEnabled: false,
        notes: "15일 전 설치 완료. 정상 가동 중. 다음 캘리브레이션: 3개월 후.",
      },
    }),
  ]);

  console.log(`📦 인벤토리 품목: ${inventoryItems.length + 1}개 생성`);

  // ============================================================================
  // 10. 🤖 AI Consumption Rate - 소비율 추적 데이터 (InventoryUsage)
  // ============================================================================
  console.log("\n🤖 AI 소비율 추적 데이터 생성 중...");
  console.log("   → 이 데이터로 AI가 '30일마다 PBS 소진' 패턴을 학습");

  // PBS 소비 이력 - 30일 주기 증명!
  const pbsUsageRecords = await Promise.all([
    // 첫 번째 주기 (90~60일 전): 10개 → 0개
    prisma.inventoryUsage.create({
      data: {
        inventoryId: "inv-hero-pbs",
        userId: "user-bioinsight-researcher",
        quantity: 3,
        unit: "ea",
        usageDate: daysAgo(85),
        notes: "세포 배양 세척용",
      },
    }),
    prisma.inventoryUsage.create({
      data: {
        inventoryId: "inv-hero-pbs",
        userId: "user-bioinsight-researcher",
        quantity: 4,
        unit: "ea",
        usageDate: daysAgo(75),
        notes: "Western Blot 세척",
      },
    }),
    prisma.inventoryUsage.create({
      data: {
        inventoryId: "inv-hero-pbs",
        userId: "user-bioinsight-researcher",
        quantity: 3,
        unit: "ea",
        usageDate: daysAgo(65),
        notes: "ELISA 세척",
      },
    }),
    // 두 번째 주기 (60~30일 전): 10개 → 0개
    prisma.inventoryUsage.create({
      data: {
        inventoryId: "inv-hero-pbs",
        userId: "user-bioinsight-researcher",
        quantity: 4,
        unit: "ea",
        usageDate: daysAgo(55),
        notes: "세포 배양 세척용",
      },
    }),
    prisma.inventoryUsage.create({
      data: {
        inventoryId: "inv-hero-pbs",
        userId: "user-bioinsight-researcher",
        quantity: 3,
        unit: "ea",
        usageDate: daysAgo(45),
        notes: "면역염색 세척",
      },
    }),
    prisma.inventoryUsage.create({
      data: {
        inventoryId: "inv-hero-pbs",
        userId: "user-bioinsight-researcher",
        quantity: 3,
        unit: "ea",
        usageDate: daysAgo(35),
        notes: "FACS 세척",
      },
    }),
    // 세 번째 주기 (30~0일 전): 10개 → 2개 남음 (현재!)
    prisma.inventoryUsage.create({
      data: {
        inventoryId: "inv-hero-pbs",
        userId: "user-bioinsight-researcher",
        quantity: 3,
        unit: "ea",
        usageDate: daysAgo(25),
        notes: "세포 배양 세척용",
      },
    }),
    prisma.inventoryUsage.create({
      data: {
        inventoryId: "inv-hero-pbs",
        userId: "user-bioinsight-researcher",
        quantity: 3,
        unit: "ea",
        usageDate: daysAgo(15),
        notes: "Primary Culture 세척",
      },
    }),
    prisma.inventoryUsage.create({
      data: {
        inventoryId: "inv-hero-pbs",
        userId: "user-bioinsight-researcher",
        quantity: 2,
        unit: "ea",
        usageDate: daysAgo(5),
        notes: "Transfection 전처리",
      },
    }),
    // 🔥 오늘 - 마지막 재고 경고!
    prisma.inventoryUsage.create({
      data: {
        inventoryId: "inv-hero-pbs",
        userId: "user-bioinsight-researcher",
        quantity: 0, // 오늘은 아직 안씀
        unit: "ea",
        usageDate: today,
        notes: "🔔 현재 재고 2개. AI 예측: 오늘 재주문 권장!",
      },
    }),
  ]);

  console.log(`🔬 PBS 소비 기록: ${pbsUsageRecords.length}건 (30일 주기 패턴)`);

  // 다른 품목들 소비 기록
  const otherUsageRecords = await Promise.all([
    // FBS 사용 (최근 입고됨)
    prisma.inventoryUsage.create({
      data: {
        inventoryId: "inv-fbs",
        userId: "user-bioinsight-researcher",
        quantity: 1,
        unit: "ea",
        usageDate: daysAgo(1),
        notes: "HEK293 배양 배지 교체",
      },
    }),
    // DMEM 사용
    prisma.inventoryUsage.create({
      data: {
        inventoryId: "inv-dmem",
        userId: "user-bioinsight-researcher",
        quantity: 6,
        unit: "ea",
        usageDate: daysAgo(3),
        notes: "주간 세포 배양",
      },
    }),
    prisma.inventoryUsage.create({
      data: {
        inventoryId: "inv-dmem",
        userId: "user-bioinsight-researcher",
        quantity: 4,
        unit: "ea",
        usageDate: daysAgo(10),
        notes: "Primary Cell 배양",
      },
    }),
    // Trypsin 사용 (거의 소진!)
    prisma.inventoryUsage.create({
      data: {
        inventoryId: "inv-trypsin",
        userId: "user-bioinsight-researcher",
        quantity: 8,
        unit: "ea",
        usageDate: daysAgo(20),
        notes: "세포 계대배양",
      },
    }),
    prisma.inventoryUsage.create({
      data: {
        inventoryId: "inv-trypsin",
        userId: "user-bioinsight-researcher",
        quantity: 9,
        unit: "ea",
        usageDate: daysAgo(7),
        notes: "대량 세포 계대",
      },
    }),
    // 피펫팁 사용
    prisma.inventoryUsage.create({
      data: {
        inventoryId: "inv-tips",
        userId: "user-bioinsight-researcher",
        quantity: 480,
        unit: "ea",
        usageDate: daysAgo(5),
        notes: "ELISA 플레이트 분주",
      },
    }),
    // Flask 사용
    prisma.inventoryUsage.create({
      data: {
        inventoryId: "inv-flask",
        userId: "user-bioinsight-researcher",
        quantity: 50,
        unit: "ea",
        usageDate: daysAgo(3),
        notes: "신규 세포주 확립",
      },
    }),
  ]);

  console.log(`📊 기타 품목 소비 기록: ${otherUsageRecords.length}건`);

  // ============================================================================
  // 완료 리포트
  // ============================================================================
  console.log("\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🎉 BioInsight Lab - Predictive Ordering Engine Seed 완료!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");
  console.log("📌 AI 예측 시나리오 핵심:");
  console.log("   ⭐ HERO PRODUCT: Sigma-Tech PBS 1X (Sterile)");
  console.log("   📅 구매 주기: 정확히 30일");
  console.log("   📍 구매 이력: 90일 전, 60일 전, 30일 전");
  console.log("   🔔 AI 예측: '오늘이 재주문 시점!'");
  console.log("");
  console.log("💰 억 단위 연구실 볼륨:");
  console.log(`   총 구매 기록: ${heroPurchases.length + additionalPurchases.length}건`);
  console.log("   최근 3개월 총액: 약 1.1억원+");
  console.log("");
  console.log("📦 Zero-Touch Inventory:");
  console.log(`   총 인벤토리 품목: ${inventoryItems.length + 1}개`);
  console.log("   ⚠️ Low Stock 품목: PBS (2개), Trypsin (3개)");
  console.log("   ✅ In Stock 품목: FBS, DMEM, 항체, 피펫팁, Flask");
  console.log(`   AI 소비 추적 기록: ${pbsUsageRecords.length + otherUsageRecords.length}건`);
  console.log("");
  console.log("🤖 AI 예측 데모 시나리오:");
  console.log("   1. PBS: '30일 주기 소비 패턴 감지. 오늘 재주문 필요!'");
  console.log("   2. Trypsin: '재고 부족! 즉시 주문 권장'");
  console.log("   3. 사용자 액션: [응, 주문해] 버튼 클릭만 하면 끝!");
  console.log("");
  console.log("🚀 투자자 데모 준비 완료!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .catch((e) => {
    console.error("❌ 시드 데이터 생성 실패:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
