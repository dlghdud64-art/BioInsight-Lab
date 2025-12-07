import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 견적 응답 목록 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const quote = await db.quote.findUnique({
      where: { id: params.id },
      include: {
        responses: {
          include: {
            vendor: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    return NextResponse.json({ responses: quote.responses });
  } catch (error: any) {
    console.error("Error fetching quote responses:", error);
    return NextResponse.json(
      { error: "Failed to fetch responses" },
      { status: 500 }
    );
  }
}

// 견적 응답 생성
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 벤더 정보 확인 (사용자가 벤더인지 확인)
    // TODO: 실제로는 Vendor와 User를 연결하는 관계가 필요할 수 있음
    // 여기서는 간단히 vendorId를 body에서 받도록 함
    const body = await request.json();
    const { vendorId, totalPrice, currency = "KRW", message, validUntil } = body;

    if (!vendorId) {
      return NextResponse.json(
        { error: "vendorId is required" },
        { status: 400 }
      );
    }

    // Quote 존재 확인
    const quote = await db.quote.findUnique({
      where: { id: params.id },
    });

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // 견적 응답 생성
    const response = await db.quoteResponse.create({
      data: {
        quoteId: params.id,
        vendorId,
        totalPrice,
        currency,
        message,
        validUntil: validUntil ? new Date(validUntil) : null,
      },
      include: {
        vendor: true,
      },
    });

    return NextResponse.json({ response });
  } catch (error: any) {
    console.error("Error creating quote response:", error);
    return NextResponse.json(
      { error: "Failed to create response" },
      { status: 500 }
    );
  }
}


