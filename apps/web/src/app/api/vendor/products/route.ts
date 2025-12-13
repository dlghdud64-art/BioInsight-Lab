import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * 벤더의 제품 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: {
        vendor: true,
      },
    });

    if (!user?.vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const products = await db.productVendor.findMany({
      where: { vendorId: user.vendor.id },
      include: {
        product: {
          include: {
            vendors: {
              where: { vendorId: user.vendor.id },
            },
          },
        },
      },
      skip,
      take: limit,
      orderBy: { updatedAt: "desc" },
    });

    const total = await db.productVendor.count({
      where: { vendorId: user.vendor.id },
    });

    return NextResponse.json({
      products: products.map((pv: any) => ({
        id: pv.id,
        product: pv.product,
        price: pv.price,
        priceInKRW: pv.priceInKRW,
        currency: pv.currency,
        stockStatus: pv.stockStatus,
        leadTime: pv.leadTime,
        minOrderQty: pv.minOrderQty,
        url: pv.url,
        lastUpdated: pv.lastUpdated,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error("Error fetching vendor products:", error);
    return NextResponse.json(
      { error: "Failed to fetch vendor products" },
      { status: 500 }
    );
  }
}

/**
 * 벤더 제품 등록/수정
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: {
        vendor: true,
      },
    });

    if (!user?.vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      productId,
      price,
      priceInKRW,
      currency,
      stockStatus,
      leadTime,
      minOrderQty,
      url,
    } = body;

    if (!productId) {
      return NextResponse.json(
        { error: "productId is required" },
        { status: 400 }
      );
    }

    // 제품이 존재하는지 확인
    const product = await db.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    // ProductVendor 업데이트 또는 생성
    const productVendor = await db.productVendor.upsert({
      where: {
        productId_vendorId: {
          productId,
          vendorId: user.vendor.id,
        },
      },
      update: {
        ...(price !== undefined && { price }),
        ...(priceInKRW !== undefined && { priceInKRW }),
        ...(currency !== undefined && { currency }),
        ...(stockStatus !== undefined && { stockStatus }),
        ...(leadTime !== undefined && { leadTime }),
        ...(minOrderQty !== undefined && { minOrderQty }),
        ...(url !== undefined && { url }),
        lastUpdated: new Date(),
      },
      create: {
        productId,
        vendorId: user.vendor.id,
        price: price || null,
        priceInKRW: priceInKRW || null,
        currency: currency || "KRW",
        stockStatus: stockStatus || null,
        leadTime: leadTime || null,
        minOrderQty: minOrderQty || null,
        url: url || null,
      },
      include: {
        product: true,
      },
    });

    return NextResponse.json({ productVendor }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating/updating vendor product:", error);
    return NextResponse.json(
      { error: "Failed to create/update vendor product" },
      { status: 500 }
    );
  }
}

