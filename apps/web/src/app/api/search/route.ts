import { NextResponse } from "next/server";
import { dummyProducts } from "@/data/dummy-products";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.toLowerCase() || "";

  const results = dummyProducts.filter((p) =>
    p.name.toLowerCase().includes(q) ||
    p.vendor.toLowerCase().includes(q) ||
    p.category.toLowerCase().includes(q) ||
    (p.description?.toLowerCase().includes(q))
  );

  return NextResponse.json(results);
}

