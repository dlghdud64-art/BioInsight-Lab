import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { getProductsByIds } from "@/lib/api/products";
import { dummyProducts } from "@/data/dummy-products";

export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_import',
      targetEntityType: 'product',
      // §enforcement-handle-close-sweep (products) — 'unknown' 유지. 최대 5개 제품을 한 번에
      //   비교하는 다중 대상이라 단일 targetEntityId 가 없다. 억지로 첫 id 를 넣으면
      //   "그 제품에 대한 작업"으로 감사에 남아 부정확하다. 'unknown' 은 전역 공용 키가
      //   아니라 userId 폴백(§11.369-3)이라 같은 사용자의 연타 보호는 유지된다.
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/products/compare',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const body = await request.json();
    const { productIds } = body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      enforcement.fail();
      return NextResponse.json(
        { error: "Product IDs array is required" },
        { status: 400 }
      );
    }

    if (productIds.length > 5) {
      enforcement.fail();
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
      const dummyProductsList = dummyProducts.filter((p: any) => dummyIds.includes(p.id));
      products = products.concat(
        dummyProductsList.map((p: any) => ({
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

    // ⚠️ 정상 완료 경로인데 fail() 이다 — **버그 아님. complete() 로 바꾸지 말 것.**
    //   비교는 조회 전용(DB 쓰기 0). complete() 는 before/after 를 남기므로
    //   아무것도 바꾸지 않은 호출에 "변경 완료" 감사가 생긴다 = 거짓 감사.
    enforcement.fail();
    return NextResponse.json({ products });
  } catch (error) {
    enforcement?.fail();
    console.error("Error comparing products:", error);
    return NextResponse.json(
      { error: "Failed to compare products" },
      { status: 500 }
    );
  }
}
