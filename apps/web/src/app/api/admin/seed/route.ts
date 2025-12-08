import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Prisma Clientë¥??ì ?¼ë¡ import (?ì±?ì? ?ì? ê²½ì° ?ë¹?
    const { db } = await import("@/lib/db");
    // ë²¤ë ?ì±
    const vendors = await Promise.all([
      db.vendor.upsert({
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
      db.vendor.upsert({
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
      db.vendor.upsert({
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
    ]);

    // ?ì ê²?ì´???í???ì±
    const products = await Promise.all([
      db.product.upsert({
        where: { id: "product-elisa-1" },
        update: {},
        create: {
          id: "product-elisa-1",
          name: "Human IL-6 ELISA Kit",
          nameEn: "Human IL-6 ELISA Kit",
          description: "?¸ê° ?¸í°ë£¨í¨-6 (IL-6) ?ë ë¶ì??ELISA ?¤í¸",
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
        },
      }),
      db.product.upsert({
        where: { id: "product-elisa-2" },
        update: {},
        create: {
          id: "product-elisa-2",
          name: "Human IL-6 ELISA Kit (?ì²´í)",
          nameEn: "Human IL-6 ELISA Kit (Alternative)",
          description: "?¸ê° IL-6 ?ë ë¶ì??ELISA ?¤í¸ ?ì²??í",
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
        },
      }),
      db.product.upsert({
        where: { id: "product-filter-1" },
        update: {},
        create: {
          id: "product-filter-1",
          name: "0.22Î¼m ë©¸ê·  ?í°",
          nameEn: "0.22Î¼m Sterile Filter",
          description: "?¸í¬ ë°°ì??ë°??ì½ ë©¸ê· ??0.22Î¼m ë©¸ê·  ?í°",
          descriptionEn: "0.22Î¼m sterile filter for cell culture media and reagent sterilization",
          category: "TOOL",
          brand: "Millipore",
          modelNumber: "SLGP033RS",
          catalogNumber: "SLGP033RS",
          grade: "Sterile",
          specification: "0.22Î¼m, 33mm",
          specifications: {
            poreSize: "0.22Î¼m",
            diameter: "33mm",
            material: "PVDF",
            sterilization: "Gamma irradiated",
          },
        },
      }),
      db.product.upsert({
        where: { id: "product-filter-2" },
        update: {},
        create: {
          id: "product-filter-2",
          name: "0.22Î¼m ë©¸ê·  ?í° (?ì²´í)",
          nameEn: "0.22Î¼m Sterile Filter (Alternative)",
          description: "0.22Î¼m ë©¸ê·  ?í° ?ì²??í",
          descriptionEn: "Alternative 0.22Î¼m sterile filter",
          category: "TOOL",
          brand: "Sartorius",
          modelNumber: "16532",
          catalogNumber: "16532",
          grade: "Sterile",
          specification: "0.22Î¼m, 33mm",
          specifications: {
            poreSize: "0.22Î¼m",
            diameter: "33mm",
            material: "PES",
            sterilization: "Gamma irradiated",
          },
        },
      }),
      db.product.upsert({
        where: { id: "product-hplc-1" },
        update: {},
        create: {
          id: "product-hplc-1",
          name: "HPLC C18 ì»¬ë¼",
          nameEn: "HPLC C18 Column",
          description: "?? HPLC ë¶ì??C18 ì»¬ë¼",
          descriptionEn: "C18 column for reverse-phase HPLC analysis",
          category: "EQUIPMENT",
          brand: "Waters",
          modelNumber: "186002350",
          catalogNumber: "186002350",
          grade: "HPLC Grade",
          specification: "4.6 x 150mm, 5Î¼m",
          specifications: {
            dimensions: "4.6 x 150mm",
            particleSize: "5Î¼m",
            poreSize: "100Ã",
            phase: "C18",
          },
        },
      }),
      db.product.upsert({
        where: { id: "product-hplc-2" },
        update: {},
        create: {
          id: "product-hplc-2",
          name: "HPLC C18 ì»¬ë¼ (?ì²´í)",
          nameEn: "HPLC C18 Column (Alternative)",
          description: "HPLC C18 ì»¬ë¼ ?ì²??í",
          descriptionEn: "Alternative HPLC C18 column",
          category: "EQUIPMENT",
          brand: "Agilent",
          modelNumber: "959700-902",
          catalogNumber: "959700-902",
          grade: "HPLC Grade",
          specification: "4.6 x 150mm, 5Î¼m",
          specifications: {
            dimensions: "4.6 x 150mm",
            particleSize: "5Î¼m",
            poreSize: "100Ã",
            phase: "C18",
          },
        },
      }),
    ]);

    // ?í-ë²¤ë ?°ê²° ë°?ê°ê²??ë³´
    await Promise.all([
      db.productVendor.upsert({
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
        },
      }),
      db.productVendor.upsert({
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
          leadTime: 10,
          minOrderQty: 1,
        },
      }),
      db.productVendor.upsert({
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
        },
      }),
      db.productVendor.upsert({
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
          leadTime: 3,
          minOrderQty: 10,
        },
      }),
      db.productVendor.upsert({
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
        },
      }),
      db.productVendor.upsert({
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
          leadTime: 14,
          minOrderQty: 1,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "?ë ?°ì´?°ê? ?±ê³µ?ì¼ë¡??ì±?ì?µë??",
      vendors: vendors.length,
      products: products.length,
    });
  } catch (error: any) {
    console.error("Seed error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "?ë ?°ì´???ì± ?¤í¨",
      },
      { status: 500 }
    );
  }
}
