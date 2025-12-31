import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createActivityLogServer } from "@/lib/api/activity-logs";
import { ActivityType } from "@prisma/client";

// 리스트 버전 생성 (스냅샷 저장)
export async function POST(
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
    const { snapshotNote } = body;

    // 원본 리스트 조회
    const originalQuote = await db.quote.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
          orderBy: {
            lineNumber: "asc",
          },
        },
        versions: {
          orderBy: {
            version: "desc",
          },
          take: 1,
        },
      },
    });

    if (!originalQuote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // 본인의 리스트만 버전 생성 가능
    if (originalQuote.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 다음 버전 번호 계산
    const latestVersion = originalQuote.versions[0]?.version || originalQuote.version || 0;
    const nextVersion = latestVersion + 1;

    // 버전 리스트 생성 (스냅샷)
    const versionQuote = await db.quote.create({
      data: {
        userId: originalQuote.userId,
        organizationId: originalQuote.organizationId,
        title: `${originalQuote.title} (v${nextVersion})`,
        description: originalQuote.description,
        status: originalQuote.status,
        templateId: originalQuote.templateId,
        templateType: originalQuote.templateType,
        version: nextVersion,
        parentQuoteId: originalQuote.parentQuoteId || originalQuote.id, // 원본 리스트 ID
        isSnapshot: true,
        snapshotNote: snapshotNote || null,
        items: {
          create: originalQuote.items.map((item: any) => ({
            productId: item.productId,
            lineNumber: item.lineNumber,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            currency: item.currency,
            lineTotal: item.lineTotal,
            notes: item.notes,
          })),
        },
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
            lineNumber: "asc",
          },
        },
        user: {
          select: {
            email: true,
            name: true,
          },
        },
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
      entityId: originalQuote.id,
      userId: session.user.id,
      organizationId: originalQuote.organizationId || undefined,
      metadata: {
        title: originalQuote.title,
        version: nextVersion,
        action: "version_created",
      },
      ipAddress,
      userAgent,
    }).catch((error) => {
      console.error("Failed to create activity log:", error);
    });

    return NextResponse.json({ quote: versionQuote }, { status: 201 });
  } catch (error) {
    console.error("Error creating quote version:", error);
    return NextResponse.json(
      { error: "Failed to create quote version" },
      { status: 500 }
    );
  }
}

// 리스트 버전 목록 조회
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

    // 원본 리스트 조회
    const originalQuote = await db.quote.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        parentQuoteId: true,
      },
    });

    if (!originalQuote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // 본인의 리스트만 조회 가능
    if (originalQuote.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 원본 리스트 ID 결정 (parentQuoteId가 있으면 그것을, 없으면 현재 ID를 사용)
    const rootQuoteId = originalQuote.parentQuoteId || originalQuote.id;

    // 모든 버전 조회 (원본 포함)
    const versions = await db.quote.findMany({
      where: {
        OR: [
          { id: rootQuoteId },
          { parentQuoteId: rootQuoteId },
        ],
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                catalogNumber: true,
                brand: true,
                category: true,
              },
            },
          },
          orderBy: {
            lineNumber: "asc",
          },
        },
      },
      orderBy: {
        version: "asc",
      },
    });

    return NextResponse.json({ versions });
  } catch (error) {
    console.error("Error fetching quote versions:", error);
    return NextResponse.json(
      { error: "Failed to fetch quote versions" },
      { status: 500 }
    );
  }
}
























