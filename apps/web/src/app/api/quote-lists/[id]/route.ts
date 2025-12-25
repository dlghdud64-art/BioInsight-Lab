import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateGuestKey } from "@/lib/api/guest-key";
import { handleApiError } from "@/lib/api/utils";

/**
 * GET /api/quote-lists/[id]
 * 견적요청서 리스트 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const guestKey = await getOrCreateGuestKey();

    // QuoteList 조회 (guestKey 일치 OR userId 일치)
    const quoteList = await db.quoteList.findFirst({
      where: {
        id,
        OR: [
          { guestKey },
          // TODO: userId는 추후 로그인 연결 시 추가
        ],
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                vendors: {
                  include: {
                    vendor: true,
                  },
                  take: 1,
                },
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!quoteList) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    return NextResponse.json(quoteList);
  } catch (error) {
    return handleApiError(error, "GET /api/quote-lists/[id]");
  }
}

/**
 * PUT /api/quote-lists/[id]
 * 견적요청서 리스트 헤더 업데이트
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const guestKey = await getOrCreateGuestKey();

    const body = await request.json();
    const { title, message, status } = body;

    // 권한 확인
    const existing = await db.quoteList.findFirst({
      where: {
        id,
        OR: [
          { guestKey },
          // TODO: userId는 추후 로그인 연결 시 추가
        ],
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    // 업데이트
    const updated = await db.quoteList.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(message !== undefined && { message }),
        ...(status !== undefined && { status }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, "PUT /api/quote-lists/[id]");
  }
}
