import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  generateQuoteDraft,
  AiKeyMissingError,
  type QuoteDraftItem,
} from "@/lib/ai/quote-draft-generator";
import { createAuditLog, extractRequestMeta, AuditAction, AuditEntityType } from "@/lib/audit";
import { createActivityLog, getActorRole } from "@/lib/activity-log";

/**
 * POST /api/ai-actions/generate/quote-draft
 *
 * 선택 품목 기반 RFQ 이메일 초안을 AI로 생성하고
 * AiActionItem(PENDING)으로 저장합니다.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { items, vendorNames, deliveryDate, additionalNotes } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "items 배열이 필요합니다 (최소 1개)" },
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

    // AI 초안 생성
    const draft = await generateQuoteDraft({
      items: items as QuoteDraftItem[],
      vendorNames,
      deliveryDate,
      organizationName: org?.name,
      requesterName: user?.name || undefined,
      additionalNotes,
    });

    // AiActionItem 생성
    const representative = items[0]?.productName || "품목";
    const otherCount = Math.max(0, items.length - 1);
    const title = otherCount > 0
      ? `${representative} 외 ${otherCount}건 견적 초안 완성`
      : `${representative} 견적 초안 완성`;

    const actionItem = await db.aiActionItem.create({
      data: {
        type: "QUOTE_DRAFT",
        status: "PENDING",
        priority: "HIGH",
        userId: session.user.id,
        organizationId: org?.id || null,
        title,
        description: `${vendorNames?.length || 0}개 벤더 대상 · 품목 ${items.length}건 · 희망 납기 ${draft.suggestedDeliveryDate}`,
        payload: {
          emailSubject: draft.emailSubject,
          emailBody: draft.emailBody,
          items: draft.items,
          vendorNames: draft.vendorNames,
          suggestedDeliveryDate: draft.suggestedDeliveryDate,
        } as unknown as Prisma.JsonObject,
        aiModel: draft.aiModel,
        promptTokens: draft.promptTokens,
        completionTokens: draft.completionTokens,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7일 후 자동 만료
      },
    });

    // 감사 로그: AI 초안 생성 기록
    const { ipAddress, userAgent } = extractRequestMeta(request);
    const actorRole = await getActorRole(session.user.id, org?.id);

    await createAuditLog({
      userId: session.user.id,
      organizationId: org?.id || null,
      action: AuditAction.CREATE,
      entityType: AuditEntityType.AI_ACTION,
      entityId: actionItem.id,
      newData: {
        type: "QUOTE_DRAFT",
        status: "PENDING",
        title,
        itemCount: items.length,
        aiModel: draft.aiModel,
        promptTokens: draft.promptTokens,
        completionTokens: draft.completionTokens,
      },
      ipAddress,
      userAgent,
    });

    // 활동 로그: 견적 초안 생성
    await createActivityLog({
      activityType: "QUOTE_DRAFT_GENERATED",
      entityType: "AI_ACTION",
      entityId: actionItem.id,
      taskType: "QUOTE_DRAFT",
      afterStatus: "PENDING",
      userId: session.user.id,
      organizationId: org?.id || null,
      actorRole,
      metadata: {
        title,
        itemCount: items.length,
        vendorCount: vendorNames?.length || 0,
        aiModel: draft.aiModel,
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
          suggestedDeliveryDate: draft.suggestedDeliveryDate,
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
    console.error("Error generating quote draft:", error);
    return NextResponse.json(
      { error: "Failed to generate quote draft" },
      { status: 500 }
    );
  }
}
