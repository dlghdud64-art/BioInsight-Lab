import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env file
dotenv.config({ path: path.resolve(__dirname, "../.env") });

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
        grade: "Molecular Biology Grade",
        specification: "250 units, 5 U/μL",
        regulatoryCompliance: "GMP",
        specifications: {
          unitSize: "250 units",
          storage: "-20°C",
          concentration: "5 U/μL",
        },
        datasheetUrl: "https://example.com/datasheet/taq-polymerase.pdf",
        imageUrl: "https://via.placeholder.com/300x300?text=Taq+Polymerase",
        msdsUrl: "https://example.com/msds/taq-polymerase.pdf",
        safetyNote: "-20°C에서 보관, 동결 보호제와 함께 보관 권장",
        hazardCodes: ["H319"],
        pictograms: ["exclamation"],
        storageCondition: "-20°C 동결 보관",
        ppe: ["gloves", "lab coat"],
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
        grade: "Molecular Biology Grade",
        specification: "500 units, 5 U/μL",
        regulatoryCompliance: "USP",
        specifications: {
          unitSize: "500 units",
          storage: "-20°C",
          concentration: "5 U/μL",
        },
        datasheetUrl: "https://example.com/datasheet/taq-polymerase-alt.pdf",
        imageUrl: "https://via.placeholder.com/300x300?text=Taq+Alt",
        msdsUrl: "https://example.com/msds/taq-polymerase-alt.pdf",
        safetyNote: "-20°C에서 보관, 동결 보호제와 함께 보관 권장",
        hazardCodes: ["H319"],
        pictograms: ["exclamation"],
        storageCondition: "-20°C 동결 보관",
        ppe: ["gloves"],
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
        grade: "Electrophoresis Grade",
        specification: "500g",
        specifications: {
          size: "500g",
          gelStrength: "0.8-1.2%",
          meltingPoint: "88-92°C",
        },
        imageUrl: "https://via.placeholder.com/300x300?text=Agarose",
        msdsUrl: "https://example.com/msds/agarose.pdf",
        safetyNote: "실온 보관, 습기 차단",
        storageCondition: "실온, 습기 차단 보관",
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
        grade: "Sterile",
        specification: "200μL, 1000개/박스",
        specifications: {
          volume: "200μL",
          capacity: "1000개/박스",
          material: "Polypropylene",
        },
        imageUrl: "https://via.placeholder.com/300x300?text=Pipette+Tips",
        msdsUrl: "https://example.com/msds/pipette-tips.pdf",
        safetyNote: "멸균 제품, 무균 조작 권장",
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
        grade: "Sterile",
        specification: "0.2mL, 1000개/박스",
        specifications: {
          volume: "0.2mL",
          capacity: "1000개/박스",
          material: "Polypropylene",
        },
        imageUrl: "https://via.placeholder.com/300x300?text=PCR+Tubes",
        msdsUrl: "https://example.com/msds/pcr-tubes.pdf",
        safetyNote: "멸균 제품, 무균 조작 권장",
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
        grade: "Research Grade",
        specification: "96 wells, 6 channels",
        specifications: {
          channels: "6",
          sampleCapacity: "96 wells",
          temperatureRange: "4-99°C",
        },
        datasheetUrl: "https://example.com/datasheet/cfx96.pdf",
        imageUrl: "https://via.placeholder.com/300x300?text=PCR+System",
        msdsUrl: "https://example.com/msds/cfx96.pdf",
        safetyNote: "전기 장비, 적절한 전원 공급 필요",
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
        msdsUrl: "https://example.com/msds/il6-elisa-alt.pdf",
        safetyNote: "2~8°C 냉장 보관, 동결 방지",
        storageCondition: "2~8°C 냉장 보관",
        ppe: ["gloves"],
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
        msdsUrl: "https://example.com/msds/0.22um-filter.pdf",
        safetyNote: "멸균 제품, 무균 조작 권장",
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
        msdsUrl: "https://example.com/msds/0.22um-filter-alt.pdf",
        safetyNote: "멸균 제품, 무균 조작 권장",
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
        msdsUrl: "https://example.com/msds/hplc-c18.pdf",
        safetyNote: "실온 보관, 습기 차단",
        storageCondition: "실온, 습기 차단 보관",
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
        msdsUrl: "https://example.com/msds/hplc-c18-alt.pdf",
        safetyNote: "실온 보관, 습기 차단",
        storageCondition: "실온, 습기 차단 보관",
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
        stockStatus: "Low Stock",
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

  // 5. 실제 연구실 제품 추가
  const bioProducts = await Promise.all([
    // Cell Culture Media & Sera
    prisma.product.upsert({
      where: { id: "product-fbs" },
      update: {},
      create: {
        id: "product-fbs",
        name: "Fetal Bovine Serum (FBS)",
        nameEn: "Fetal Bovine Serum",
        description: "세포 배양용 태아 소 혈청 - South America Origin",
        descriptionEn: "Premium quality fetal bovine serum for cell culture",
        category: "REAGENT",
        brand: "Gibco",
        modelNumber: "10270-106",
        catalogNumber: "10270-106",
        grade: "Cell Culture Tested",
        specification: "500mL",
        specifications: {
          volume: "500mL",
          origin: "South America",
          endotoxin: "<10 EU/mL",
          hemoglobin: "<25 mg/dL",
        },
        storageCondition: "-20°C 동결 보관",
        safetyNote: "동결 보관, 해동 후 빠른 사용 권장",
        imageUrl: "https://via.placeholder.com/300x300?text=FBS",
      },
    }),
    prisma.product.upsert({
      where: { id: "product-dmem" },
      update: {},
      create: {
        id: "product-dmem",
        name: "DMEM (High Glucose)",
        nameEn: "DMEM, high glucose",
        description: "세포 배양 배지 - High Glucose, with L-Glutamine",
        descriptionEn: "Dulbecco's Modified Eagle Medium for cell culture",
        category: "REAGENT",
        brand: "Gibco",
        modelNumber: "11965-092",
        catalogNumber: "11965-092",
        grade: "Cell Culture Grade",
        specification: "500mL",
        specifications: {
          volume: "500mL",
          glucose: "4.5 g/L",
          glutamine: "with L-Glutamine",
          phenolRed: "with Phenol Red",
        },
        storageCondition: "2-8°C 냉장 보관",
        safetyNote: "냉장 보관, 오염 방지 주의",
        imageUrl: "https://via.placeholder.com/300x300?text=DMEM",
      },
    }),
    prisma.product.upsert({
      where: { id: "product-pbs" },
      update: {},
      create: {
        id: "product-pbs",
        name: "PBS (Phosphate Buffered Saline)",
        nameEn: "PBS",
        description: "인산완충식염수 - 1X, pH 7.4",
        descriptionEn: "Sterile phosphate buffered saline",
        category: "REAGENT",
        brand: "Welgene",
        modelNumber: "LB001-02",
        catalogNumber: "LB001-02",
        grade: "Cell Culture Grade",
        specification: "500mL",
        specifications: {
          volume: "500mL",
          pH: "7.4",
          sterile: "Yes",
        },
        storageCondition: "실온 보관",
        imageUrl: "https://via.placeholder.com/300x300?text=PBS",
      },
    }),
    // Antibodies
    prisma.product.upsert({
      where: { id: "product-gapdh-ab" },
      update: {},
      create: {
        id: "product-gapdh-ab",
        name: "Anti-GAPDH Antibody",
        nameEn: "Anti-GAPDH Antibody",
        description: "GAPDH Loading Control Antibody (Mouse Monoclonal)",
        descriptionEn: "Mouse monoclonal antibody for GAPDH detection",
        category: "REAGENT",
        brand: "Cell Signaling Technology",
        modelNumber: "2118S",
        catalogNumber: "2118S",
        grade: "Research Grade",
        specification: "100μL",
        specifications: {
          volume: "100μL",
          host: "Mouse",
          reactivity: "Human, Mouse, Rat",
          application: "WB, IP",
        },
        storageCondition: "-20°C 동결 보관",
        imageUrl: "https://via.placeholder.com/300x300?text=GAPDH+Ab",
      },
    }),
    prisma.product.upsert({
      where: { id: "product-beta-actin-ab" },
      update: {},
      create: {
        id: "product-beta-actin-ab",
        name: "Anti-β-Actin Antibody",
        nameEn: "Anti-β-Actin Antibody",
        description: "β-Actin Loading Control Antibody (Rabbit Polyclonal)",
        descriptionEn: "Rabbit polyclonal antibody for β-actin detection",
        category: "REAGENT",
        brand: "Abcam",
        modelNumber: "ab8227",
        catalogNumber: "ab8227",
        grade: "Research Grade",
        specification: "100μg",
        specifications: {
          amount: "100μg",
          host: "Rabbit",
          reactivity: "Human, Mouse, Rat",
          application: "WB, ICC, IHC",
        },
        storageCondition: "-20°C 동결 보관",
        imageUrl: "https://via.placeholder.com/300x300?text=Beta-Actin+Ab",
      },
    }),
    // Lab Plasticware
    prisma.product.upsert({
      where: { id: "product-conical-50ml" },
      update: {},
      create: {
        id: "product-conical-50ml",
        name: "50mL Conical Tube",
        nameEn: "50mL Conical Tube",
        description: "멸균 원심분리관 50mL (Polypropylene)",
        descriptionEn: "Sterile centrifuge tube 50mL",
        category: "TOOL",
        brand: "SPL Life Sciences",
        modelNumber: "50050",
        catalogNumber: "50050",
        grade: "Sterile",
        specification: "50mL, 25개/rack, 500개/case",
        specifications: {
          volume: "50mL",
          material: "Polypropylene",
          sterile: "Yes",
          packaging: "25/rack, 500/case",
        },
        imageUrl: "https://via.placeholder.com/300x300?text=50mL+Tube",
      },
    }),
    prisma.product.upsert({
      where: { id: "product-plate-96well" },
      update: {},
      create: {
        id: "product-plate-96well",
        name: "96-Well Cell Culture Plate",
        nameEn: "96-Well Plate",
        description: "세포 배양용 96웰 플레이트 (Flat Bottom, TC-Treated)",
        descriptionEn: "96-well cell culture plate for tissue culture",
        category: "TOOL",
        brand: "Corning",
        modelNumber: "3599",
        catalogNumber: "3599",
        grade: "Tissue Culture Treated",
        specification: "96 wells, Flat Bottom",
        specifications: {
          wells: "96",
          bottomType: "Flat",
          treatment: "TC-Treated",
          sterile: "Yes",
        },
        imageUrl: "https://via.placeholder.com/300x300?text=96-Well+Plate",
      },
    }),
    prisma.product.upsert({
      where: { id: "product-serological-pipette" },
      update: {},
      create: {
        id: "product-serological-pipette",
        name: "Serological Pipette 10mL",
        nameEn: "Serological Pipette 10mL",
        description: "멸균 혈청 피펫 10mL (Individually Wrapped)",
        descriptionEn: "Sterile serological pipette 10mL",
        category: "TOOL",
        brand: "Falcon",
        modelNumber: "357551",
        catalogNumber: "357551",
        grade: "Sterile",
        specification: "10mL, 200개/case",
        specifications: {
          volume: "10mL",
          sterile: "Yes",
          packaging: "Individually wrapped, 200/case",
        },
        imageUrl: "https://via.placeholder.com/300x300?text=Pipette+10mL",
      },
    }),
  ]);

  console.log(`✅ ${bioProducts.length}개 바이오 제품 생성 완료`);

  // 6. 제품-벤더 연결 (바이오 제품)
  await Promise.all([
    prisma.productVendor.upsert({
      where: { id: "pv-fbs-1" },
      update: {},
      create: {
        id: "pv-fbs-1",
        productId: "product-fbs",
        vendorId: "vendor-thermo",
        price: 420.0,
        currency: "USD",
        priceInKRW: 546000,
        stockStatus: "In Stock",
        leadTime: 7,
        minOrderQty: 1,
      },
    }),
    prisma.productVendor.upsert({
      where: { id: "pv-dmem-1" },
      update: {},
      create: {
        id: "pv-dmem-1",
        productId: "product-dmem",
        vendorId: "vendor-thermo",
        price: 45.0,
        currency: "USD",
        priceInKRW: 58500,
        stockStatus: "In Stock",
        leadTime: 5,
        minOrderQty: 1,
      },
    }),
    prisma.productVendor.upsert({
      where: { id: "pv-pbs-1" },
      update: {},
      create: {
        id: "pv-pbs-1",
        productId: "product-pbs",
        vendorId: "vendor-korea",
        price: 12000,
        currency: "KRW",
        priceInKRW: 12000,
        stockStatus: "In Stock",
        leadTime: 2,
        minOrderQty: 1,
      },
    }),
    prisma.productVendor.upsert({
      where: { id: "pv-gapdh-1" },
      update: {},
      create: {
        id: "pv-gapdh-1",
        productId: "product-gapdh-ab",
        vendorId: "vendor-sigma",
        price: 280.0,
        currency: "USD",
        priceInKRW: 364000,
        stockStatus: "In Stock",
        leadTime: 10,
        minOrderQty: 1,
      },
    }),
    prisma.productVendor.upsert({
      where: { id: "pv-beta-actin-1" },
      update: {},
      create: {
        id: "pv-beta-actin-1",
        productId: "product-beta-actin-ab",
        vendorId: "vendor-sigma",
        price: 320.0,
        currency: "USD",
        priceInKRW: 416000,
        stockStatus: "Low Stock",
        leadTime: 14,
        minOrderQty: 1,
      },
    }),
    prisma.productVendor.upsert({
      where: { id: "pv-conical-1" },
      update: {},
      create: {
        id: "pv-conical-1",
        productId: "product-conical-50ml",
        vendorId: "vendor-korea",
        price: 85000,
        currency: "KRW",
        priceInKRW: 85000,
        stockStatus: "In Stock",
        leadTime: 2,
        minOrderQty: 1,
      },
    }),
    prisma.productVendor.upsert({
      where: { id: "pv-plate-1" },
      update: {},
      create: {
        id: "pv-plate-1",
        productId: "product-plate-96well",
        vendorId: "vendor-thermo",
        price: 95.0,
        currency: "USD",
        priceInKRW: 123500,
        stockStatus: "In Stock",
        leadTime: 7,
        minOrderQty: 1,
      },
    }),
    prisma.productVendor.upsert({
      where: { id: "pv-pipette-1" },
      update: {},
      create: {
        id: "pv-pipette-1",
        productId: "product-serological-pipette",
        vendorId: "vendor-bio-rad",
        price: 120.0,
        currency: "USD",
        priceInKRW: 156000,
        stockStatus: "In Stock",
        leadTime: 5,
        minOrderQty: 1,
      },
    }),
  ]);

  console.log("✅ 바이오 제품-벤더 연결 완료");

  // 7. 사용자 생성 (테스트용)
  const testUser = await prisma.user.upsert({
    where: { id: "user-test-1" },
    update: {},
    create: {
      id: "user-test-1",
      email: "researcher@bioinsight.com",
      name: "김연구",
      role: "RESEARCHER",
      organization: "서울대학교 생명과학부",
    },
  });

  console.log("✅ 테스트 사용자 생성 완료");

  // 8. 주문 내역 생성 (최근 6개월)
  const now = new Date();
  const purchaseRecords = await Promise.all([
    // 7월 데이터
    prisma.purchaseRecord.create({
      data: {
        scopeKey: "guest-demo",
        purchasedAt: new Date(2025, 6, 5), // 2025-07-05
        vendorName: "Thermo Fisher Scientific",
        category: "REAGENT",
        itemName: "Fetal Bovine Serum (FBS)",
        catalogNumber: "10270-106",
        unit: "ea",
        qty: 2,
        unitPrice: 546000,
        amount: 1092000,
        currency: "KRW",
        source: "import",
      },
    }),
    prisma.purchaseRecord.create({
      data: {
        scopeKey: "guest-demo",
        purchasedAt: new Date(2025, 6, 12), // 2025-07-12
        vendorName: "한국바이오텍",
        category: "REAGENT",
        itemName: "PBS (Phosphate Buffered Saline)",
        catalogNumber: "LB001-02",
        unit: "ea",
        qty: 5,
        unitPrice: 12000,
        amount: 60000,
        currency: "KRW",
        source: "import",
      },
    }),
    prisma.purchaseRecord.create({
      data: {
        scopeKey: "guest-demo",
        purchasedAt: new Date(2025, 6, 20), // 2025-07-20
        vendorName: "Sigma-Aldrich",
        category: "REAGENT",
        itemName: "Anti-GAPDH Antibody",
        catalogNumber: "2118S",
        unit: "ea",
        qty: 1,
        unitPrice: 364000,
        amount: 364000,
        currency: "KRW",
        source: "import",
      },
    }),
    // 8월 데이터
    prisma.purchaseRecord.create({
      data: {
        scopeKey: "guest-demo",
        purchasedAt: new Date(2025, 7, 3), // 2025-08-03
        vendorName: "Thermo Fisher Scientific",
        category: "REAGENT",
        itemName: "DMEM (High Glucose)",
        catalogNumber: "11965-092",
        unit: "ea",
        qty: 10,
        unitPrice: 58500,
        amount: 585000,
        currency: "KRW",
        source: "import",
      },
    }),
    prisma.purchaseRecord.create({
      data: {
        scopeKey: "guest-demo",
        purchasedAt: new Date(2025, 7, 15), // 2025-08-15
        vendorName: "한국바이오텍",
        category: "TOOL",
        itemName: "50mL Conical Tube",
        catalogNumber: "50050",
        unit: "case",
        qty: 2,
        unitPrice: 85000,
        amount: 170000,
        currency: "KRW",
        source: "import",
      },
    }),
    prisma.purchaseRecord.create({
      data: {
        scopeKey: "guest-demo",
        purchasedAt: new Date(2025, 7, 25), // 2025-08-25
        vendorName: "Sigma-Aldrich",
        category: "REAGENT",
        itemName: "Anti-β-Actin Antibody",
        catalogNumber: "ab8227",
        unit: "ea",
        qty: 1,
        unitPrice: 416000,
        amount: 416000,
        currency: "KRW",
        source: "import",
      },
    }),
    // 9월 데이터
    prisma.purchaseRecord.create({
      data: {
        scopeKey: "guest-demo",
        purchasedAt: new Date(2025, 8, 8), // 2025-09-08
        vendorName: "Thermo Fisher Scientific",
        category: "TOOL",
        itemName: "96-Well Cell Culture Plate",
        catalogNumber: "3599",
        unit: "ea",
        qty: 20,
        unitPrice: 123500,
        amount: 2470000,
        currency: "KRW",
        source: "import",
      },
    }),
    prisma.purchaseRecord.create({
      data: {
        scopeKey: "guest-demo",
        purchasedAt: new Date(2025, 8, 18), // 2025-09-18
        vendorName: "Bio-Rad",
        category: "TOOL",
        itemName: "Serological Pipette 10mL",
        catalogNumber: "357551",
        unit: "case",
        qty: 1,
        unitPrice: 156000,
        amount: 156000,
        currency: "KRW",
        source: "import",
      },
    }),
    prisma.purchaseRecord.create({
      data: {
        scopeKey: "guest-demo",
        purchasedAt: new Date(2025, 8, 25), // 2025-09-25
        vendorName: "Thermo Fisher Scientific",
        category: "REAGENT",
        itemName: "Fetal Bovine Serum (FBS)",
        catalogNumber: "10270-106",
        unit: "ea",
        qty: 3,
        unitPrice: 546000,
        amount: 1638000,
        currency: "KRW",
        source: "import",
      },
    }),
    // 10월 데이터
    prisma.purchaseRecord.create({
      data: {
        scopeKey: "guest-demo",
        purchasedAt: new Date(2025, 9, 5), // 2025-10-05
        vendorName: "한국바이오텍",
        category: "REAGENT",
        itemName: "PBS (Phosphate Buffered Saline)",
        catalogNumber: "LB001-02",
        unit: "ea",
        qty: 10,
        unitPrice: 12000,
        amount: 120000,
        currency: "KRW",
        source: "import",
      },
    }),
    prisma.purchaseRecord.create({
      data: {
        scopeKey: "guest-demo",
        purchasedAt: new Date(2025, 9, 15), // 2025-10-15
        vendorName: "Thermo Fisher Scientific",
        category: "REAGENT",
        itemName: "DMEM (High Glucose)",
        catalogNumber: "11965-092",
        unit: "ea",
        qty: 15,
        unitPrice: 58500,
        amount: 877500,
        currency: "KRW",
        source: "import",
      },
    }),
    // 11월 데이터
    prisma.purchaseRecord.create({
      data: {
        scopeKey: "guest-demo",
        purchasedAt: new Date(2025, 10, 10), // 2025-11-10
        vendorName: "Sigma-Aldrich",
        category: "REAGENT",
        itemName: "Taq DNA Polymerase",
        catalogNumber: "EP0402",
        unit: "ea",
        qty: 2,
        unitPrice: 195000,
        amount: 390000,
        currency: "KRW",
        source: "import",
      },
    }),
    prisma.purchaseRecord.create({
      data: {
        scopeKey: "guest-demo",
        purchasedAt: new Date(2025, 10, 22), // 2025-11-22
        vendorName: "Bio-Rad",
        category: "EQUIPMENT",
        itemName: "Real-time PCR System",
        catalogNumber: "CFX96",
        unit: "ea",
        qty: 1,
        unitPrice: 32500000,
        amount: 32500000,
        currency: "KRW",
        source: "import",
      },
    }),
    // 12월 데이터
    prisma.purchaseRecord.create({
      data: {
        scopeKey: "guest-demo",
        purchasedAt: new Date(2025, 11, 5), // 2025-12-05
        vendorName: "Thermo Fisher Scientific",
        category: "REAGENT",
        itemName: "Fetal Bovine Serum (FBS)",
        catalogNumber: "10270-106",
        unit: "ea",
        qty: 2,
        unitPrice: 546000,
        amount: 1092000,
        currency: "KRW",
        source: "import",
      },
    }),
    prisma.purchaseRecord.create({
      data: {
        scopeKey: "guest-demo",
        purchasedAt: new Date(2025, 11, 18), // 2025-12-18
        vendorName: "한국바이오텍",
        category: "TOOL",
        itemName: "50mL Conical Tube",
        catalogNumber: "50050",
        unit: "case",
        qty: 3,
        unitPrice: 85000,
        amount: 255000,
        currency: "KRW",
        source: "import",
      },
    }),
  ]);

  console.log(`✅ ${purchaseRecords.length}개 구매 기록 생성 완료`);

  // 9. 예산 설정 (2025년 월별)
  const budgets = await Promise.all([
    prisma.budget.upsert({
      where: { scopeKey_yearMonth: { scopeKey: "guest-demo", yearMonth: "2025-07" } },
      update: {},
      create: {
        scopeKey: "guest-demo",
        yearMonth: "2025-07",
        amount: 3000000,
        currency: "KRW",
        description: "7월 연구 예산",
      },
    }),
    prisma.budget.upsert({
      where: { scopeKey_yearMonth: { scopeKey: "guest-demo", yearMonth: "2025-08" } },
      update: {},
      create: {
        scopeKey: "guest-demo",
        yearMonth: "2025-08",
        amount: 3000000,
        currency: "KRW",
        description: "8월 연구 예산",
      },
    }),
    prisma.budget.upsert({
      where: { scopeKey_yearMonth: { scopeKey: "guest-demo", yearMonth: "2025-09" } },
      update: {},
      create: {
        scopeKey: "guest-demo",
        yearMonth: "2025-09",
        amount: 5000000,
        currency: "KRW",
        description: "9월 연구 예산 (증액)",
      },
    }),
    prisma.budget.upsert({
      where: { scopeKey_yearMonth: { scopeKey: "guest-demo", yearMonth: "2025-10" } },
      update: {},
      create: {
        scopeKey: "guest-demo",
        yearMonth: "2025-10",
        amount: 3000000,
        currency: "KRW",
        description: "10월 연구 예산",
      },
    }),
    prisma.budget.upsert({
      where: { scopeKey_yearMonth: { scopeKey: "guest-demo", yearMonth: "2025-11" } },
      update: {},
      create: {
        scopeKey: "guest-demo",
        yearMonth: "2025-11",
        amount: 35000000,
        currency: "KRW",
        description: "11월 연구 예산 (장비 구매)",
      },
    }),
    prisma.budget.upsert({
      where: { scopeKey_yearMonth: { scopeKey: "guest-demo", yearMonth: "2025-12" } },
      update: {},
      create: {
        scopeKey: "guest-demo",
        yearMonth: "2025-12",
        amount: 3000000,
        currency: "KRW",
        description: "12월 연구 예산",
      },
    }),
  ]);

  console.log(`✅ ${budgets.length}개 예산 설정 완료`);

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


