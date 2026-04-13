import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  generateVendorEmailDraft,
  AiKeyMissingError,
  type QuoteDraftItem,
} from "@/lib/ai/quote-draft-generator";
import { createAuditLog, extractRequestMeta, AuditAction, AuditEntityType } from "@/lib/audit";
import { createActivityLog, getActorRole } from "@/lib/activity-log";

/**
 * POST /api/ai-actions/generate/vendor-email-draft
 *
 * 특정 벤더에 대한 이메일 초안을 AI로 생성하고
 * AiActionItem(PENDING)으로 저장합니다.
 */
export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_export',
      targetEntityType: 'product',
      targetEntityId: 'unknown',
      sourceSurface: 'vendor_portal',
      routePath: '/ai-actions/generate/vendor-email-draft',
    });
    if (!enforcement.allowed) return enforcement.deny();

        if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { vendorName, vendorEmail, items, deliveryDate, customMessage, quoteId } = body;

    if (!vendorName) {
      return NextResponse.json(
        { error: "vendorName이 필요합니다" },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "items 배열이 필요합니다" },
        { status: 400 }
      );
    }

    // 사용자 조직 정보 조회
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        organizationMembers: {
          take: 1,
          include: { organization: { select: { id: true, name: true } } },
        },
      },
    });

    const org = user?.organizationMembers?.[0]?.organization;

    // AI 벤더 이메일 초안 생성
    const draft = await generateVendorEmailDraft({
      vendorName,
      vendorEmail,
      items: items as QuoteDraftItem[],
      deliveryDate,
      organizationName: org?.name,
      requesterName: user?.name || undefined,
      customMessage,
    });

    // AiActionItem 생성
    const actionItem = await db.aiActionItem.create({
      data: {
        type: "VENDOR_EMAIL_DRAFT",
        status: "PENDING",
        priority: "HIGH",
        // 3-Layer 상태 초기화
        taskStatus: "REVIEW_NEEDED",
        approvalStatus: "PENDING",
        substatus: "vendor_email_generated",
        summary: `${vendorName} · ${items.length}건 품목`,
        userId: session.user.id,
        organizationId: org?.id || null,
        title: `${vendorName} 견적 요청 이메일 초안`,
        description: `품목 ${items.length}건 · ${vendorEmail || "이메일 미지정"}`,
        payload: {
          emailSubject: draft.emailSubject,
          emailBody: draft.emailBody,
          vendorName: draft.vendorName,
          vendorEmail: vendorEmail || null,
          items,
          quoteId: quoteId || null,
        } as unknown as Prisma.JsonObject,
        relatedEntityType: quoteId ? "QUOTE" : null,
        relatedEntityId: quoteId || null,
        aiModel: draft.aiModel,
        promptTokens: draft.promptTokens,
        completionTokens: draft.completionTokens,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // 감사 로그: 벤더 이메일 초안 생성 기록
    const { ipAddress, userAgent } = extractRequestMeta(request);
    const actorRole = await getActorRole(session.user.id, org?.id);

    await createAuditLog({
      userId: session.user.id,
      organizationId: org?.id || null,
      action: AuditAction.CREATE,
      entityType: AuditEntityType.AI_ACTION,
      entityId: actionItem.id,
      newData: {
        type: "VENDOR_EMAIL_DRAFT",
        status: "PENDING",
        vendorName,
        itemCount: items.length,
        aiModel: draft.aiModel,
        relatedQuoteId: quoteId || null,
      },
      ipAddress,
      userAgent,
    });

    // 활동 로그: 벤더 이메일 초안 생성
    await createActivityLog({
      activityType: "EMAIL_DRAFT_GENERATED",
      entityType: "AI_ACTION",
      entityId: actionItem.id,
      taskType: "VENDOR_EMAIL_DRAFT",
      afterStatus: "PENDING",
      userId: session.user.id,
      organizationId: org?.id || null,
      actorRole,
      metadata: {
        vendorName,
        itemCount: items.length,
        relatedQuoteId: quoteId || null,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json(
      {
        actionId: actionItem.id,
        preview: {
          title: actionItem.title,
          emailSubject: draft.emailSubject,
          emailBody: draft.emailBody,
          vendorName: draft.vendorName,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AiKeyMissingError) {
      return NextResponse.json(
        { error: error.message },
        { status: 503 }
      );
    }
    console.error("Error generating vendor email draft:", error);
    return NextResponse.json(
      { error: "Failed to generate vendor email draft" },
      { status: 500 }
    );
  }
}
