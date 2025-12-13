import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getQuoteById } from "@/lib/api/quotes";
import { db, isPrismaAvailable } from "@/lib/db";
import { isDemoMode } from "@/lib/env";
import { createActivityLogServer } from "@/lib/api/activity-logs";
import { ActivityType } from "@prisma/client";

// 특정 견적 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const quote = await getQuoteById(id);

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // 본인의 견적만 조회 가능
    if (quote.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 액티비티 로그 기록 (비동기, 실패해도 조회는 성공)
    const ipAddress = request.headers.get("x-forwarded-for") || 
                     request.headers.get("x-real-ip") || 
                     undefined;
    const userAgent = request.headers.get("user-agent") || undefined;
    
    createActivityLogServer({
      db,
      activityType: ActivityType.QUOTE_VIEWED,
      entityType: "quote",
      entityId: quote.id,
      userId: session.user.id,
      organizationId: quote.organizationId || undefined,
      metadata: {
        title: quote.title,
      },
      ipAddress,
      userAgent,
    }).catch((error) => {
      console.error("Failed to create activity log:", error);
    });

    return NextResponse.json({ quote });
  } catch (error) {
    console.error("Error fetching quote:", error);
    return NextResponse.json(
      { error: "Failed to fetch quote" },
      { status: 500 }
    );
  }
}

// 견적 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { title, description } = body;

    const quote = await db.quote.findUnique({
      where: { id },
    });

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // 본인의 견적만 수정 가능
    if (quote.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 견적 수정
    const updatedQuote = await db.quote.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description && { description }),
      },
    });

    // 액티비티 로그 기록
    const ipAddress = request.headers.get("x-forwarded-for") || 
                     request.headers.get("x-real-ip") || 
                     undefined;
    const userAgent = request.headers.get("user-agent") || undefined;
    
    createActivityLogServer({
      db,
      activityType: ActivityType.QUOTE_UPDATED,
      entityType: "quote",
      entityId: quote.id,
      userId: session.user.id,
      organizationId: quote.organizationId || undefined,
      metadata: {
        title: updatedQuote.title,
        changes: {
          title: title ? { from: quote.title, to: title } : undefined,
          description: description ? { from: quote.description, to: description } : undefined,
        },
      },
      ipAddress,
      userAgent,
    }).catch((error) => {
      console.error("Failed to create activity log:", error);
    });

    return NextResponse.json({ quote: updatedQuote });
  } catch (error) {
    console.error("Error updating quote:", error);
    return NextResponse.json(
      { error: "Failed to update quote" },
      { status: 500 }
    );
  }
}

// 견적 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const quote = await db.quote.findUnique({
      where: { id },
    });

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // 본인의 견적만 삭제 가능
    if (quote.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 액티비티 로그 기록 (삭제 전에 기록)
    const ipAddress = request.headers.get("x-forwarded-for") || 
                     request.headers.get("x-real-ip") || 
                     undefined;
    const userAgent = request.headers.get("user-agent") || undefined;
    
    createActivityLogServer({
      db,
      activityType: ActivityType.QUOTE_DELETED,
      entityType: "quote",
      entityId: quote.id,
      userId: session.user.id,
      organizationId: quote.organizationId || undefined,
      metadata: {
        title: quote.title,
      },
      ipAddress,
      userAgent,
    }).catch((error) => {
      console.error("Failed to create activity log:", error);
    });

    // 견적 삭제
    await db.quote.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting quote:", error);
    return NextResponse.json(
      { error: "Failed to delete quote" },
      { status: 500 }
    );
  }
}

