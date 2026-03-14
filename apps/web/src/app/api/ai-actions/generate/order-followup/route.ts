import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Prisma, TeamRole } from "@prisma/client";
import {
  generateVendorEmailDraft,
  AiKeyMissingError,
  type QuoteDraftItem,
} from "@/lib/ai/quote-draft-generator";
import { createFollowupForOrder } from "@/lib/ai/order-followup-detector";
import { createAuditLog, extractRequestMeta, AuditAction, AuditEntityType } from "@/lib/audit";
import { createActivityLog, getActorRole } from "@/lib/activity-log";

/**
 * POST /api/ai-actions/generate/order-followup
 *
 * 주문에 대한 Follow-up 이메일 초안를 생성하고 AiActionItem(FOLLOWUP_DRAFT)로 저장합니다.
 *
 * Body: { orderId }
 *
 * 흐름:
 *   1. 해당 주문에 대해 PENDING FOLLOWUP_DRAFT 존재 여부 확인 (중복 방지)
 *   2. 없으면 createFollowupForOrder → AiActionItem 생성
 *   3. AI 이메일 초안 생성 → payload에 emailSubject/emailBody 업데이트
 *   4. 활동 로그 기록
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: "orderId가 필요합니다" },
        { status: 400 }
      );
    }

    // 주문 조회 + 권한 확인
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        quote: {
          select: {
            id: true,
            title: true,
            vendorRequests: {
              select: {
                vendorName: true,
                vendorEmail: true,
                respondedAt: true,
              },
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다" }, { status: 404 });
    }

    // 본인 소유 또는 같은 조직 멤버만 허용
    if (order.userId !== session.user.id) {
      if (order.organizationId) {
        const membership = await db.organizationMember.findFirst({
          where: { organizationId: order.organizationId, userId: session.user.id },
          select: { role: true },
        });
        if (!membership) {
          return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
      }
    }

    // RBAC: MEMBER 역할은 follow-up 초안 생성 불가 (APPROVER 이상)
    if (order.organizationId) {
      const teamMember = await db.teamMember.findFirst({
        where: { userId: session.user.id },
        select: { role: true },
      });
      if (teamMember?.role === TeamRole.MEMBER) {
        return NextResponse.json(
          { error: "일반 멤버는 Follow-up 초안을 생성할 수 없습니다. 관리자에게 요청하세요." },
          { status: 403 }
        );
      }
    }

    // 1. Follow-up AiActionItem 생성 (중복 방지 포함)
    const { actionItem: existingOrNew, skipped } = await createFollowupForOrder(
      orderId,
      session.user.id
    );

    if (!existingOrNew) {
      return NextResponse.json(
        { error: "Follow-up 작업 항목 생성에 실패했습니다" },
        { status: 500 }
      );
    }

    // 2. AI 이메일 초안 생성
    const vendorName = order.quote?.vendorRequests?.[0]?.vendorName || "공급사";
    const vendorEmail = order.quote?.vendorRequests?.[0]?.vendorEmail || undefined;
    const daysSinceOrder = Math.floor(
      (Date.now() - order.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    const items: QuoteDraftItem[] = order.items.map((item: { name: string; catalogNumber: string | null; brand: string | null; quantity: number }) => ({
      productName: item.name,
      catalogNumber: item.catalogNumber || undefined,
      brand: item.brand || undefined,
      quantity: item.quantity,
      unit: "ea",
    }));

    // 사용자 조직 정보
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

    let emailSubject = `[Follow-up] ${order.orderNumber} 진행 상황 확인 요청`;
    let emailBody = `${vendorName} 담당자님께,\n\n주문번호 ${order.orderNumber} 관련 진행 상황 확인을 요청드립니다.\n\n주문일로부터 ${daysSinceOrder}일이 경과하였습니다.`;
    let aiModel = "fallback-template";
    let promptTokens = 0;
    let completionTokens = 0;

    try {
      const draft = await generateVendorEmailDraft({
        vendorName,
        vendorEmail,
        items,
        organizationName: org?.name,
        requesterName: user?.name || undefined,
        customMessage: `주문번호 ${order.orderNumber} 관련 후속 문의입니다. 주문일로부터 ${daysSinceOrder}일이 경과하였으며, 현재 진행 상황과 예상 납기일 회신을 요청합니다.`,
      });

      emailSubject = draft.emailSubject;
      emailBody = draft.emailBody;
      aiModel = draft.aiModel;
      promptTokens = draft.promptTokens;
      completionTokens = draft.completionTokens;
    } catch (aiErr) {
      if (aiErr instanceof AiKeyMissingError) {
        // AI 키 없으면 템플릿 폴백 사용 (위 기본값)
        console.warn("[OrderFollowup] AI key missing, using fallback template");
      } else {
        console.warn("[OrderFollowup] AI draft generation failed:", aiErr);
      }
    }

    // 3. AiActionItem payload에 이메일 초안 업데이트
    const updatedAction = await db.aiActionItem.update({
      where: { id: existingOrNew.id },
      data: {
        payload: {
          ...(await db.aiActionItem.findUnique({
            where: { id: existingOrNew.id },
            select: { payload: true },
          }).then((r: { payload: unknown } | null) => (r?.payload as Record<string, unknown>) || {})),
          emailSubject,
          emailBody,
          vendorName,
          vendorEmail: vendorEmail || null,
        } as unknown as Prisma.JsonObject,
        aiModel,
        promptTokens,
        completionTokens,
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        payload: true,
      },
    });

    // 4. 감사 + 활동 로그
    const { ipAddress, userAgent } = extractRequestMeta(request);
    const actorRole = await getActorRole(session.user.id, order.organizationId);

    if (!skipped) {
      await createAuditLog({
        userId: session.user.id,
        organizationId: order.organizationId,
        action: AuditAction.CREATE,
        entityType: AuditEntityType.AI_ACTION,
        entityId: existingOrNew.id,
        newData: {
          type: "FOLLOWUP_DRAFT",
          status: "PENDING",
          orderId,
          orderNumber: order.orderNumber,
          vendorName,
        },
        ipAddress,
        userAgent,
      });
    }

    const payload = updatedAction.payload as Record<string, unknown>;

    return NextResponse.json(
      {
        actionId: updatedAction.id,
        skipped,
        preview: {
          title: updatedAction.title,
          emailSubject: payload.emailSubject || emailSubject,
          emailBody: payload.emailBody || emailBody,
          vendorName,
          vendorEmail: vendorEmail || null,
          daysSinceOrder,
          pendingChecks: payload.pendingChecks || [],
        },
      },
      { status: skipped ? 200 : 201 }
    );
  } catch (error) {
    if (error instanceof AiKeyMissingError) {
      return NextResponse.json(
        { error: error.message },
        { status: 503 }
      );
    }
    console.error("Error generating order followup:", error);
    return NextResponse.json(
      { error: "Follow-up 생성에 실패했습니다" },
      { status: 500 }
    );
  }
}
