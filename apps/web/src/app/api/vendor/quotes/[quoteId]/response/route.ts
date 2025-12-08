import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createQuoteResponse } from "@/lib/api/vendor-quotes";
import { db } from "@/lib/db";

// 견적 응답 생성/업데이트
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 사용자가 SUPPLIER 역할인지 확인
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "SUPPLIER") {
      return NextResponse.json(
        { error: "Only suppliers can respond to quotes" },
        { status: 403 }
      );
    }

    // 벤더 찾기
    const vendor = await db.vendor.findFirst({
      where: {
        email: session.user.email || undefined,
      },
    });

    if (!vendor) {
      return NextResponse.json(
        { error: "Vendor not found for this user" },
        { status: 404 }
      );
    }

    const { quoteId } = await params;
    const body = await request.json();
    const { totalPrice, currency, message, validUntil } = body;

    const response = await createQuoteResponse(vendor.id, quoteId, {
      totalPrice: totalPrice ? parseFloat(totalPrice) : undefined,
      currency,
      message,
      validUntil: validUntil ? new Date(validUntil) : undefined,
    });

    return NextResponse.json({ response }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating quote response:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create quote response" },
      { status: 500 }
    );
  }
}



import { auth } from "@/auth";
import { createQuoteResponse } from "@/lib/api/vendor-quotes";
import { db } from "@/lib/db";

// 견적 응답 생성/업데이트
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 사용자가 SUPPLIER 역할인지 확인
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "SUPPLIER") {
      return NextResponse.json(
        { error: "Only suppliers can respond to quotes" },
        { status: 403 }
      );
    }

    // 벤더 찾기
    const vendor = await db.vendor.findFirst({
      where: {
        email: session.user.email || undefined,
      },
    });

    if (!vendor) {
      return NextResponse.json(
        { error: "Vendor not found for this user" },
        { status: 404 }
      );
    }

    const { quoteId } = await params;
    const body = await request.json();
    const { totalPrice, currency, message, validUntil } = body;

    const response = await createQuoteResponse(vendor.id, quoteId, {
      totalPrice: totalPrice ? parseFloat(totalPrice) : undefined,
      currency,
      message,
      validUntil: validUntil ? new Date(validUntil) : undefined,
    });

    return NextResponse.json({ response }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating quote response:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create quote response" },
      { status: 500 }
    );
  }
}



import { auth } from "@/auth";
import { createQuoteResponse } from "@/lib/api/vendor-quotes";
import { db } from "@/lib/db";

// 견적 응답 생성/업데이트
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 사용자가 SUPPLIER 역할인지 확인
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "SUPPLIER") {
      return NextResponse.json(
        { error: "Only suppliers can respond to quotes" },
        { status: 403 }
      );
    }

    // 벤더 찾기
    const vendor = await db.vendor.findFirst({
      where: {
        email: session.user.email || undefined,
      },
    });

    if (!vendor) {
      return NextResponse.json(
        { error: "Vendor not found for this user" },
        { status: 404 }
      );
    }

    const { quoteId } = await params;
    const body = await request.json();
    const { totalPrice, currency, message, validUntil } = body;

    const response = await createQuoteResponse(vendor.id, quoteId, {
      totalPrice: totalPrice ? parseFloat(totalPrice) : undefined,
      currency,
      message,
      validUntil: validUntil ? new Date(validUntil) : undefined,
    });

    return NextResponse.json({ response }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating quote response:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create quote response" },
      { status: 500 }
    );
  }
}






