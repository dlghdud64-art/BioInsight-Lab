import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { generateVendorRequestToken } from "@/lib/api/vendor-request-token";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { createActivityLog, getActorRole } from "@/lib/activity-log";
import { extractRequestMeta } from "@/lib/audit";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";

// 빈 문자열 → undefined 변환 헬퍼
const emptyToUndefined = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.number().int().nonnegative().optional()
);
const emptyToUndefinedPositive = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.number().int().positive().optional()
);
const emptyStringToUndefined = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.string().optional()
);

const ReplyItemSchema = z.object({
  quoteItemId: z.string(),
  unitPrice: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 0 : Number(v)),
    z.number().nonnegative()
  ),
  currency: z.string().min(1).default("KRW"),
  leadTimeDays: emptyToUndefined,
  moq: emptyToUndefinedPositive,
  vendorSku: emptyStringToUndefined,
  notes: emptyStringToUndefined,
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
  let enforcement: InlineEnforcementHandle | undefined;
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

    // ── Security enforcement ──
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'quote_vendor_reply',
      targetEntityType: 'quote',
      targetEntityId: quoteId,
      sourceSurface: 'vendor-replies-api',
      routePath: '/api/quotes/[id]/vendor-replies',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const body = await request.json();
    const validation = SaveVendorReplySchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      const fieldPath = firstError?.path?.join(".") ?? "";
      const message = firstError?.message ?? "입력값을 확인하세요.";
      return NextResponse.json(
        { error: fieldPath ? `${fieldPath}: ${message}` : message, details: validation.error.errors },
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

    // 동일 벤더명의 수동 회신 요청이 이미 있는지 확인
    // vendorEmail null 또는 "" 모두 수동 입력으로 처리
    const existingRequest = await db.quoteVendorRequest.findFirst({
      where: {
        quoteId,
        vendorName,
        OR: [{ vendorEmail: null }, { vendorEmail: "" }],
      },
    });

    const resolvedVendorRequestId = await db.$transaction(async (tx: Prisma.TransactionClient) => {
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
            // vendorEmail: null 대신 빈 문자열로 fallback (DB NOT NULL 제약 대비)
            // schema.prisma String? (nullable) 이지만 migrate deploy 미적용 환경 방어
            vendorEmail: "" as any, // "" = 수동 입력 식별자
            token: generateVendorRequestToken(),
            status: "RESPONDED",
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1년
            respondedAt: new Date(),
            snapshot,
          },
        });
        txVendorRequestId = newRequest.id;
      }

      // 각 항목별 회신 가격 upsert (unitPrice float→Int 반올림)
      for (const item of items) {
        const unitPriceInt = Math.round(item.unitPrice);
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
            unitPrice: unitPriceInt,
            currency: item.currency,
            leadTimeDays: item.leadTimeDays ?? null,
            moq: item.moq ?? null,
            vendorSku: item.vendorSku ?? null,
            notes: item.notes ?? null,
          },
          update: {
            unitPrice: unitPriceInt,
            currency: item.currency,
            leadTimeDays: item.leadTimeDays ?? null,
            moq: item.moq ?? null,
            vendorSku: item.vendorSku ?? null,
            notes: item.notes ?? null,
            updatedAt: new Date(),
          },
        });
      }

      return txVendorRequestId;
    });

    // 활동 로그: 벤더 회신 수동 기록
    const { ipAddress, userAgent } = extractRequestMeta(request);
    const actorRole = await getActorRole(session.user.id, quote.organizationId);
    await createActivityLog({
      activityType: "VENDOR_REPLY_LOGGED",
      entityType: "QUOTE",
      entityId: quoteId,
      beforeStatus: existingRequest ? "SENT" : undefined,
      afterStatus: "RESPONDED",
      userId: session.user.id,
      organizationId: quote.organizationId,
      actorRole,
      metadata: {
        vendorName,
        itemCount: items.length,
        vendorRequestId: resolvedVendorRequestId!,
        isEdit: !!existingRequest,
      },
      ipAddress,
      userAgent,
    });

    enforcement.complete({
      beforeState: { vendorName: existingRequest?.vendorName ?? null },
      afterState: { vendorName, itemCount: items.length, vendorRequestId: resolvedVendorRequestId },
    });

    return NextResponse.json({ success: true, vendorRequestId: resolvedVendorRequestId! });
  } catch (error) {
    enforcement?.fail();
    console.error("[VendorReplies/POST] ERROR:", error);
    const message = error instanceof Error ? error.message : "알 수 없는 에러";
    return NextResponse.json(
      { error: message, details: String(error) },
      { status: 500 }
    );
  }
}
