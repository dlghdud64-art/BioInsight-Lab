import { NextResponse } from "next/server";
import { dummyProducts } from "@/data/dummy-products";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.toLowerCase() || "";

    const results = dummyProducts.filter((p: any) =>
      p.name.toLowerCase().includes(q) ||
      p.vendor.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.description?.toLowerCase().includes(q))
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error("[api/search] Error:", error);
    return NextResponse.json(
      {
        error:
          "데이터베이스 연결에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
      },
      { status: 500 }
    );
  }
}

