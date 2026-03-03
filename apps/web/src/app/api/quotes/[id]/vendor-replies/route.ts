import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { generateVendorRequestToken } from "@/lib/api/vendor-request-token";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const ReplyItemSchema = z.object({
  quoteItemId: z.string(),
  unitPrice: z.number().int().nonnegative(),
  currency: z.string().default("KRW"),
  leadTimeDays: z.number().int().nonnegative().optional(),
  moq: z.number().int().positive().optional(),
  vendorSku: z.string().optional(),
  notes: z.string().optional(),
});

const SaveVendorReplySchema = z.object({
  vendorName: z.string().min(1, "벤더명을 입력하세요."),
  items: z.array(ReplyItemSchema).min(1),
});

/**
 * POST /api/quotes/[id]/vendor-replies
 * 수동 벤더 회신 저장 (회신 입력 탭)
 * — 기존 QuoteVendorRequest/QuoteVendorResponseItem 모델 재활용
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: quoteId } = await params;

    // 견적 접근 권한 확인
    const quote = await db.quote.findUnique({
      where: { id: quoteId },
      include: {
        items: { orderBy: { lineNumber: "asc" } },
      },
    });

    if (!quote) {
      return NextResponse.json({ error: "견적을 찾을 수 없습니다." }, { status: 404 });
    }

    const isOwner = quote.userId === session.user.id;
    let isOrgMember = false;
    if (!isOwner && quote.organizationId) {
      const membership = await db.organizationMember.findFirst({
        where: { userId: session.user.id, organizationId: quote.organizationId },
      });
      isOrgMember = !!membership;
    }
    if (!isOwner && !isOrgMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validation = SaveVendorReplySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "입력값 오류", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { vendorName, items } = validation.data;

    // 전달된 quoteItemId 가 실제 이 견적의 항목인지 검증
    const validItemIds = new Set(quote.items.map((i: { id: string }) => i.id));
    const invalidItems = items.filter((i) => !validItemIds.has(i.quoteItemId));
    if (invalidItems.length > 0) {
      return NextResponse.json(
        { error: "잘못된 quoteItemId가 포함되어 있습니다." },
        { status: 400 }
      );
    }

    // 스냅샷: 현재 시점의 견적 항목 정보 동결
    const snapshot = {
      quoteId,
      items: quote.items.map((item: { id: string; name: string; brand: string | null; catalogNumber: string | null; quantity: number; unit: string | null }) => ({
        quoteItemId: item.id,
        name: item.name,
        brand: item.brand,
        catalogNumber: item.catalogNumber,
        quantity: item.quantity,
        unit: item.unit,
      })),
    };

    // 동일 벤더명의 수동 회신 요청이 이미 있는지 확인 (vendorEmail null = 수동 입력)
    const existingRequest = await db.quoteVendorRequest.findFirst({
      where: {
        quoteId,
        vendorName,
        vendorEmail: null,
      },
    });

    let resolvedVendorRequestId: string;

    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      let txVendorRequestId: string;

      if (existingRequest) {
        // 기존 수동 요청 업데이트 (edit 카운트 증가)
        await tx.quoteVendorRequest.update({
          where: { id: existingRequest.id },
          data: {
            responseEditCount: { increment: 1 },
            respondedAt: new Date(),
          },
        });
        txVendorRequestId = existingRequest.id;
      } else {
        // 새 수동 요청 생성 (token 필드는 unique 제약이 있으므로 생성)
        const newRequest = await tx.quoteVendorRequest.create({
          data: {
            quoteId,
            vendorName,
            vendorEmail: null as any, // 수동 입력: 이메일 없음
            token: generateVendorRequestToken(),
            status: "RESPONDED",
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1년
            respondedAt: new Date(),
            snapshot,
          },
        });
        txVendorRequestId = newRequest.id;
      }

      // 각 항목별 회신 가격 upsert
      for (const item of items) {
        await tx.quoteVendorResponseItem.upsert({
          where: {
            vendorRequestId_quoteItemId: {
              vendorRequestId: txVendorRequestId,
              quoteItemId: item.quoteItemId,
            },
          },
          create: {
            vendorRequestId: txVendorRequestId,
            quoteItemId: item.quoteItemId,
            unitPrice: item.unitPrice,
            currency: item.currency,
            leadTimeDays: item.leadTimeDays,
            moq: item.moq,
            vendorSku: item.vendorSku,
            notes: item.notes,
          },
          update: {
            unitPrice: item.unitPrice,
            currency: item.currency,
            leadTimeDays: item.leadTimeDays,
            moq: item.moq,
            vendorSku: item.vendorSku,
            notes: item.notes,
            updatedAt: new Date(),
          },
        });
      }

      resolvedVendorRequestId = txVendorRequestId;
    });

    return NextResponse.json({ success: true, vendorRequestId: resolvedVendorRequestId! });
  } catch (error) {
    console.error("[VendorReplies/POST]", error);
    return NextResponse.json({ error: "회신 저장에 실패했습니다." }, { status: 500 });
  }
}
