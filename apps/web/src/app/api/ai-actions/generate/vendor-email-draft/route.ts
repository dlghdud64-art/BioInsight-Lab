import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Prisma, AiActionStatus, AiActionPriority, TaskStatus, ApprovalStatus } from "@prisma/client";
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
      action: 'ai_action_create',
      targetEntityType: 'product',
      // §enforcement-handle-close-sweep (ai-actions) — 'unknown' 유지.
      //   ⚠️ 불일치: targetEntityType 은 'product' 인데 body 가 받는 식별자는 quoteId 다
      //   (vendorName·items 로 벤더 이메일 초안을 만든다. product id 는 받지 않는다).
      //   quoteId 를 'product' 타입에 넣으면 감사 분류가 어긋나고, 타입을 바꾸면
      //   checkServerAuthorization 권한 판정이 달라진다 → §audit-taxonomy-review 상신.
      targetEntityId: 'unknown',
      sourceSurface: 'vendor_portal',
      routePath: '/ai-actions/generate/vendor-email-draft',
    });
    if (!enforcement.allowed) return enforcement.deny();


    const body = await request.json();
    const { vendorName, vendorEmail, items, deliveryDate, customMessage, quoteId } = body;

    if (!vendorName) {
      enforcement.fail();
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
        status: AiActionStatus.PENDING,
        priority: AiActionPriority.HIGH,
        // 3-Layer 상태 초기화
        taskStatus: TaskStatus.REVIEW_NEEDED,
        approvalStatus: ApprovalStatus.PENDING,
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

    // db.aiActionItem.create 로 초안을 실제 생성한다 → complete().
    enforcement.complete({
      beforeState: { actionId: null, vendorName, quoteId: quoteId ?? null },
      afterState: { actionId: actionItem.id, vendorName, quoteId: quoteId ?? null },
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
    enforcement?.fail();
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
