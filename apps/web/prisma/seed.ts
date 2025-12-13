import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 시드 데이터 생성 시작...");

  // 1. 벤더 생성
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
      },
    }),
    prisma.vendor.upsert({
      where: { id: "vendor-sigma" },
      update: {},
      create: {
        id: "vendor-sigma",
        name: "Sigma-Aldrich",
        nameEn: "Sigma-Aldrich",
        email: "sales@sigmaaldrich.com",
        website: "https://www.sigmaaldrich.com",
        country: "US",
        currency: "USD",
      },
    }),
    prisma.vendor.upsert({
      where: { id: "vendor-bio-rad" },
      update: {},
      create: {
        id: "vendor-bio-rad",
        name: "Bio-Rad",
        nameEn: "Bio-Rad",
        email: "sales@bio-rad.com",
        website: "https://www.bio-rad.com",
        country: "US",
        currency: "USD",
      },
    }),
    prisma.vendor.upsert({
      where: { id: "vendor-korea" },
      update: {},
      create: {
        id: "vendor-korea",
        name: "한국바이오텍",
        nameEn: "Korea Biotech",
        email: "sales@koreabiotech.co.kr",
        website: "https://www.koreabiotech.co.kr",
        country: "KR",
        currency: "KRW",
      },
    }),
  ]);

  console.log(`✅ ${vendors.length}개 벤더 생성 완료`);

  // 2. 제품 생성
  const products = await Promise.all([
    // 시약
    prisma.product.upsert({
      where: { id: "product-1" },
      update: {},
      create: {
        id: "product-1",
        name: "Taq DNA Polymerase",
        nameEn: "Taq DNA Polymerase",
        description: "PCR 반응에 사용되는 고품질 DNA 중합효소",
        descriptionEn: "High-quality DNA polymerase for PCR reactions",
        category: "REAGENT",
        brand: "Thermo Fisher",
        modelNumber: "EP0402",
        catalogNumber: "EP0402",
        specifications: {
          unitSize: "250 units",
          storage: "-20°C",
          concentration: "5 U/μL",
        },
        datasheetUrl: "https://example.com/datasheet/taq-polymerase.pdf",
        imageUrl: "https://via.placeholder.com/300x300?text=Taq+Polymerase",
      },
    }),
    prisma.product.upsert({
      where: { id: "product-2" },
      update: {},
      create: {
        id: "product-2",
        name: "Taq DNA Polymerase (대체품)",
        nameEn: "Taq DNA Polymerase (Alternative)",
        description: "PCR 반응용 DNA 중합효소 대체 제품",
        descriptionEn: "Alternative DNA polymerase for PCR reactions",
        category: "REAGENT",
        brand: "Sigma-Aldrich",
        modelNumber: "D1806",
        catalogNumber: "D1806",
        specifications: {
          unitSize: "500 units",
          storage: "-20°C",
          concentration: "5 U/μL",
        },
        datasheetUrl: "https://example.com/datasheet/taq-polymerase-alt.pdf",
        imageUrl: "https://via.placeholder.com/300x300?text=Taq+Alt",
      },
    }),
    prisma.product.upsert({
      where: { id: "product-3" },
      update: {},
      create: {
        id: "product-3",
        name: "Agarose Gel",
        nameEn: "Agarose Gel",
        description: "DNA 전기영동용 아가로스 겔",
        descriptionEn: "Agarose gel for DNA electrophoresis",
        category: "REAGENT",
        brand: "Bio-Rad",
        modelNumber: "161-3100",
        catalogNumber: "161-3100",
        specifications: {
          size: "500g",
          gelStrength: "0.8-1.2%",
          meltingPoint: "88-92°C",
        },
        imageUrl: "https://via.placeholder.com/300x300?text=Agarose",
      },
    }),
    // 기구
    prisma.product.upsert({
      where: { id: "product-4" },
      update: {},
      create: {
        id: "product-4",
        name: "멸균 피펫 팁 (200μL)",
        nameEn: "Sterile Pipette Tips (200μL)",
        description: "자동 피펫용 멸균 피펫 팁",
        descriptionEn: "Sterile pipette tips for automated pipettes",
        category: "TOOL",
        brand: "Thermo Fisher",
        modelNumber: "RT-200",
        catalogNumber: "RT-200",
        specifications: {
          volume: "200μL",
          capacity: "1000개/박스",
          material: "Polypropylene",
        },
        imageUrl: "https://via.placeholder.com/300x300?text=Pipette+Tips",
      },
    }),
    prisma.product.upsert({
      where: { id: "product-5" },
      update: {},
      create: {
        id: "product-5",
        name: "PCR 튜브 (0.2mL)",
        nameEn: "PCR Tubes (0.2mL)",
        description: "PCR 반응용 멸균 튜브",
        descriptionEn: "Sterile tubes for PCR reactions",
        category: "TOOL",
        brand: "Sigma-Aldrich",
        modelNumber: "T2418",
        catalogNumber: "T2418",
        specifications: {
          volume: "0.2mL",
          capacity: "1000개/박스",
          material: "Polypropylene",
        },
        imageUrl: "https://via.placeholder.com/300x300?text=PCR+Tubes",
      },
    }),
    // 장비
    prisma.product.upsert({
      where: { id: "product-6" },
      update: {},
      create: {
        id: "product-6",
        name: "Real-time PCR 시스템",
        nameEn: "Real-time PCR System",
        description: "정량 PCR 분석용 실시간 PCR 시스템",
        descriptionEn: "Real-time PCR system for quantitative PCR analysis",
        category: "EQUIPMENT",
        brand: "Bio-Rad",
        modelNumber: "CFX96",
        catalogNumber: "CFX96",
        specifications: {
          channels: "6",
          sampleCapacity: "96 wells",
          temperatureRange: "4-99°C",
        },
        datasheetUrl: "https://example.com/datasheet/cfx96.pdf",
        imageUrl: "https://via.placeholder.com/300x300?text=PCR+System",
      },
    }),
    // 예시 검색어용 제품들
    prisma.product.upsert({
      where: { id: "product-elisa-1" },
      update: {},
      create: {
        id: "product-elisa-1",
        name: "Human IL-6 ELISA Kit",
        nameEn: "Human IL-6 ELISA Kit",
        description: "인간 인터루킨-6 (IL-6) 정량 분석용 ELISA 키트",
        descriptionEn: "ELISA kit for quantitative analysis of human interleukin-6 (IL-6)",
        category: "REAGENT",
        brand: "R&D Systems",
        modelNumber: "D6050",
        catalogNumber: "D6050",
        grade: "Research Grade",
        specification: "96-well plate",
        specifications: {
          sensitivity: "< 0.7 pg/mL",
          range: "3.13-300 pg/mL",
          sampleType: "Serum, Plasma, Cell Culture Supernatant",
        },
        datasheetUrl: "https://example.com/datasheet/il6-elisa.pdf",
        imageUrl: "https://via.placeholder.com/300x300?text=IL-6+ELISA",
      },
    }),
    prisma.product.upsert({
      where: { id: "product-elisa-2" },
      update: {},
      create: {
        id: "product-elisa-2",
        name: "Human IL-6 ELISA Kit (대체품)",
        nameEn: "Human IL-6 ELISA Kit (Alternative)",
        description: "인간 IL-6 정량 분석용 ELISA 키트 대체 제품",
        descriptionEn: "Alternative ELISA kit for human IL-6 quantitative analysis",
        category: "REAGENT",
        brand: "Thermo Fisher",
        modelNumber: "BMS213HS",
        catalogNumber: "BMS213HS",
        grade: "Research Grade",
        specification: "96-well plate",
        specifications: {
          sensitivity: "< 1.0 pg/mL",
          range: "7.8-500 pg/mL",
          sampleType: "Serum, Plasma, Cell Culture Supernatant",
        },
        datasheetUrl: "https://example.com/datasheet/il6-elisa-alt.pdf",
        imageUrl: "https://via.placeholder.com/300x300?text=IL-6+ELISA+Alt",
      },
    }),
    prisma.product.upsert({
      where: { id: "product-filter-1" },
      update: {},
      create: {
        id: "product-filter-1",
        name: "0.22μm 멸균 필터",
        nameEn: "0.22μm Sterile Filter",
        description: "세포 배양액 및 시약 멸균용 0.22μm 멸균 필터",
        descriptionEn: "0.22μm sterile filter for cell culture media and reagent sterilization",
        category: "TOOL",
        brand: "Millipore",
        modelNumber: "SLGP033RS",
        catalogNumber: "SLGP033RS",
        grade: "Sterile",
        specification: "0.22μm, 33mm",
        specifications: {
          poreSize: "0.22μm",
          diameter: "33mm",
          material: "PVDF",
          sterilization: "Gamma irradiated",
        },
        datasheetUrl: "https://example.com/datasheet/0.22um-filter.pdf",
        imageUrl: "https://via.placeholder.com/300x300?text=0.22um+Filter",
      },
    }),
    prisma.product.upsert({
      where: { id: "product-filter-2" },
      update: {},
      create: {
        id: "product-filter-2",
        name: "0.22μm 멸균 필터 (대체품)",
        nameEn: "0.22μm Sterile Filter (Alternative)",
        description: "0.22μm 멸균 필터 대체 제품",
        descriptionEn: "Alternative 0.22μm sterile filter",
        category: "TOOL",
        brand: "Sartorius",
        modelNumber: "16532",
        catalogNumber: "16532",
        grade: "Sterile",
        specification: "0.22μm, 33mm",
        specifications: {
          poreSize: "0.22μm",
          diameter: "33mm",
          material: "PES",
          sterilization: "Gamma irradiated",
        },
        datasheetUrl: "https://example.com/datasheet/0.22um-filter-alt.pdf",
        imageUrl: "https://via.placeholder.com/300x300?text=0.22um+Filter+Alt",
      },
    }),
    prisma.product.upsert({
      where: { id: "product-hplc-1" },
      update: {},
      create: {
        id: "product-hplc-1",
        name: "HPLC C18 컬럼",
        nameEn: "HPLC C18 Column",
        description: "역상 HPLC 분석용 C18 컬럼",
        descriptionEn: "C18 column for reverse-phase HPLC analysis",
        category: "EQUIPMENT",
        brand: "Waters",
        modelNumber: "186002350",
        catalogNumber: "186002350",
        grade: "HPLC Grade",
        specification: "4.6 x 150mm, 5μm",
        specifications: {
          dimensions: "4.6 x 150mm",
          particleSize: "5μm",
          poreSize: "100Å",
          phase: "C18",
        },
        datasheetUrl: "https://example.com/datasheet/hplc-c18.pdf",
        imageUrl: "https://via.placeholder.com/300x300?text=HPLC+C18",
      },
    }),
    prisma.product.upsert({
      where: { id: "product-hplc-2" },
      update: {},
      create: {
        id: "product-hplc-2",
        name: "HPLC C18 컬럼 (대체품)",
        nameEn: "HPLC C18 Column (Alternative)",
        description: "HPLC C18 컬럼 대체 제품",
        descriptionEn: "Alternative HPLC C18 column",
        category: "EQUIPMENT",
        brand: "Agilent",
        modelNumber: "959700-902",
        catalogNumber: "959700-902",
        grade: "HPLC Grade",
        specification: "4.6 x 150mm, 5μm",
        specifications: {
          dimensions: "4.6 x 150mm",
          particleSize: "5μm",
          poreSize: "100Å",
          phase: "C18",
        },
        datasheetUrl: "https://example.com/datasheet/hplc-c18-alt.pdf",
        imageUrl: "https://via.placeholder.com/300x300?text=HPLC+C18+Alt",
      },
    }),
  ]);

  console.log(`✅ ${products.length}개 제품 생성 완료`);

  // 3. 제품-벤더 연결 및 가격 정보
  await Promise.all([
    prisma.productVendor.upsert({
      where: { id: "pv-1" },
      update: {},
      create: {
        id: "pv-1",
        productId: "product-1",
        vendorId: "vendor-thermo",
        price: 150.0,
        currency: "USD",
        priceInKRW: 195000,
        stockStatus: "In Stock",
        leadTime: 7,
        minOrderQty: 1,
        url: "https://www.thermofisher.com/product/ep0402",
      },
    }),
    prisma.productVendor.upsert({
      where: { id: "pv-2" },
      update: {},
      create: {
        id: "pv-2",
        productId: "product-2",
        vendorId: "vendor-sigma",
        price: 120.0,
        currency: "USD",
        priceInKRW: 156000,
        stockStatus: "In Stock",
        leadTime: 10,
        minOrderQty: 1,
        url: "https://www.sigmaaldrich.com/product/d1806",
      },
    }),
    prisma.productVendor.upsert({
      where: { id: "pv-3" },
      update: {},
      create: {
        id: "pv-3",
        productId: "product-3",
        vendorId: "vendor-bio-rad",
        price: 85.0,
        currency: "USD",
        priceInKRW: 110500,
        stockStatus: "In Stock",
        leadTime: 5,
        minOrderQty: 1,
        url: "https://www.bio-rad.com/product/161-3100",
      },
    }),
    prisma.productVendor.upsert({
      where: { id: "pv-4" },
      update: {},
      create: {
        id: "pv-4",
        productId: "product-4",
        vendorId: "vendor-thermo",
        price: 45.0,
        currency: "USD",
        priceInKRW: 58500,
        stockStatus: "In Stock",
        leadTime: 2,
        minOrderQty: 10,
        url: "https://www.thermofisher.com/product/rt-200",
      },
    }),
    prisma.productVendor.upsert({
      where: { id: "pv-5" },
      update: {},
      create: {
        id: "pv-5",
        productId: "product-5",
        vendorId: "vendor-sigma",
        price: 35.0,
        currency: "USD",
        priceInKRW: 45500,
        stockStatus: "Backorder",
        leadTime: 14,
        minOrderQty: 5,
        url: "https://www.sigmaaldrich.com/product/t2418",
      },
    }),
    prisma.productVendor.upsert({
      where: { id: "pv-6" },
      update: {},
      create: {
        id: "pv-6",
        productId: "product-6",
        vendorId: "vendor-bio-rad",
        price: 25000.0,
        currency: "USD",
        priceInKRW: 32500000,
        stockStatus: "Made to Order",
        leadTime: 60,
        minOrderQty: 1,
        url: "https://www.bio-rad.com/product/cfx96",
      },
    }),
    // 예시 검색어용 제품-벤더 연결
    prisma.productVendor.upsert({
      where: { id: "pv-elisa-1" },
      update: {},
      create: {
        id: "pv-elisa-1",
        productId: "product-elisa-1",
        vendorId: "vendor-bio-rad",
        price: 450.0,
        currency: "USD",
        priceInKRW: 585000,
        stockStatus: "In Stock",
        leadTime: 7,
        minOrderQty: 1,
        url: "https://www.bio-rad.com/product/d6050",
      },
    }),
    prisma.productVendor.upsert({
      where: { id: "pv-elisa-2" },
      update: {},
      create: {
        id: "pv-elisa-2",
        productId: "product-elisa-2",
        vendorId: "vendor-thermo",
        price: 520.0,
        currency: "USD",
        priceInKRW: 676000,
        stockStatus: "In Stock",
        leadTime: 12,
        minOrderQty: 1,
        url: "https://www.thermofisher.com/product/bms213hs",
      },
    }),
    prisma.productVendor.upsert({
      where: { id: "pv-filter-1" },
      update: {},
      create: {
        id: "pv-filter-1",
        productId: "product-filter-1",
        vendorId: "vendor-sigma",
        price: 120.0,
        currency: "USD",
        priceInKRW: 156000,
        stockStatus: "In Stock",
        leadTime: 5,
        minOrderQty: 10,
        url: "https://www.sigmaaldrich.com/product/slgp033rs",
      },
    }),
    prisma.productVendor.upsert({
      where: { id: "pv-filter-2" },
      update: {},
      create: {
        id: "pv-filter-2",
        productId: "product-filter-2",
        vendorId: "vendor-thermo",
        price: 110.0,
        currency: "USD",
        priceInKRW: 143000,
        stockStatus: "In Stock",
        leadTime: 1,
        minOrderQty: 10,
        url: "https://www.thermofisher.com/product/16532",
      },
    }),
    prisma.productVendor.upsert({
      where: { id: "pv-hplc-1" },
      update: {},
      create: {
        id: "pv-hplc-1",
        productId: "product-hplc-1",
        vendorId: "vendor-sigma",
        price: 850.0,
        currency: "USD",
        priceInKRW: 1105000,
        stockStatus: "In Stock",
        leadTime: 14,
        minOrderQty: 1,
        url: "https://www.sigmaaldrich.com/product/186002350",
      },
    }),
    prisma.productVendor.upsert({
      where: { id: "pv-hplc-2" },
      update: {},
      create: {
        id: "pv-hplc-2",
        productId: "product-hplc-2",
        vendorId: "vendor-thermo",
        price: 920.0,
        currency: "USD",
        priceInKRW: 1196000,
        stockStatus: "In Stock",
        leadTime: 21,
        minOrderQty: 1,
        url: "https://www.thermofisher.com/product/959700-902",
      },
    }),
  ]);

  console.log("✅ 제품-벤더 연결 완료");

  // 4. 조직 생성
  const organizations = await Promise.all([
    prisma.organization.upsert({
      where: { id: "org-1" },
      update: {},
      create: {
        id: "org-1",
        name: "서울대학교 생명과학부",
        description: "서울대학교 생명과학부 연구실",
      },
    }),
    prisma.organization.upsert({
      where: { id: "org-2" },
      update: {},
      create: {
        id: "org-2",
        name: "한국과학기술원 (KAIST)",
        description: "KAIST 생명과학과",
      },
    }),
  ]);

  console.log(`✅ ${organizations.length}개 조직 생성 완료`);

  console.log("🎉 시드 데이터 생성 완료!");
}

main()
  .catch((e) => {
    console.error("❌ 시드 데이터 생성 실패:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


