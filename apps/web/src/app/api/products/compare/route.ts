import { NextRequest, NextResponse } from "next/server";
import { getProductsByIds } from "@/lib/api/products";
import { dummyProducts } from "@/data/dummy-products";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productIds } = body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { error: "Product IDs array is required" },
        { status: 400 }
      );
    }

    if (productIds.length > 5) {
      return NextResponse.json(
        { error: "Maximum 5 products can be compared" },
        { status: 400 }
      );
    }

    // 더미 제품 ID 확인 (p1, p2, p3 등)
    const dummyIds = productIds.filter((id: string) => id.startsWith("p") && /^p\d+$/.test(id));
    const realIds = productIds.filter((id: string) => !id.startsWith("p") || !/^p\d+$/.test(id));

    let products: any[] = [];

    // 더미 제품 처리
    if (dummyIds.length > 0) {
      const dummyProductsList = dummyProducts.filter((p) => dummyIds.includes(p.id));
      products = products.concat(
        dummyProductsList.map((p) => ({
          id: p.id,
          name: p.name,
          brand: p.vendor,
          category: p.category,
          catalogNumber: p.catalogNumber,
          description: p.description,
          specification: p.spec,
          vendors: [
            {
              id: `${p.id}-vendor`,
              vendor: {
                id: p.vendor.toLowerCase().replace(/\s+/g, "-"),
                name: p.vendor,
              },
              priceInKRW: p.price,
              currency: "KRW",
            },
          ],
        }))
      );
    }

    // 실제 제품 처리
    if (realIds.length > 0) {
      try {
        const realProducts = await getProductsByIds(realIds);
        products = products.concat(realProducts);
      } catch (error) {
        console.warn("Failed to fetch real products, using dummy data only:", error);
      }
    }

    return NextResponse.json({ products });
  } catch (error) {
    console.error("Error comparing products:", error);
    return NextResponse.json(
      { error: "Failed to compare products" },
      { status: 500 }
    );
  }
}
