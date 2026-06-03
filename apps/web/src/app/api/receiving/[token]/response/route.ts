import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isValidVendorRequestToken } from "@/lib/api/vendor-request-token";
import { checkRateLimit, getClientIp } from "@/lib/api/rate-limit";
import { z } from "zod";
// §11.348-A-2-notify — 회신 도착 시 연구소 알림(견적 vendor-reply 패턴 재사용).
import { dispatchNotificationEvent } from "@/lib/notifications/event-dispatcher";
import { sendPushNotification } from "@/lib/notifications/push-sender";

/**
 * POST /api/receiving/:token/response  (§11.348-A-2)
 * 공급사 입고 회신 제출 (public). LOT·실수량·유효기간을 우리 스키마로 수신.
 *
 * 핵심 불변 (§11.336): 회신 = "검증 대기 입고안" 갱신뿐. 재고·LOT mutation 0.
 *   ProductInventory / InventoryRestock 절대 미변경 — 입고 확정은 A-4 사람 승인.
 * status: AWAITING_REPLY → PENDING_REVIEW. 재제출(검토 전)은 항목 교체(deleteMany+create).
 */
const ReceivingItemSchema = z.object({
  orderItemId: z.string(),
  receivedQuantity: z.number().nonnegative().optional(),
  lotNumber: z.string().optional(),
  expiryDate: z.string().optional(), // ISO date
  vendorNote: z.string().optional(),
});
const SubmitSchema = z.object({
  items: z.array(ReceivingItemSchema).min(1),
  vendorNote: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    if (!isValidVendorRequestToken(token)) {
      return NextResponse.json({ error: "Invalid token format" }, { status: 400 });
    }

    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`receiving-response:${clientIp}`, {
      interval: 60 * 1000,
      maxRequests: 10, // 제출은 엄격
    });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const draft = await db.receivingDraft.findUnique({ where: { token } });
    if (!draft) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    if (draft.expiresAt < new Date()) {
      return NextResponse.json({ error: "This request has expired" }, { status: 410 });
    }
    // 사람 검증 후(승인/반려/만료)에는 회신 불가 — canonical 보호.
    if (draft.status === "APPROVED" || draft.status === "REJECTED" || draft.status === "EXPIRED") {
      return NextResponse.json(
        { error: "This request is closed and can no longer be edited.", status: draft.status },
        { status: 403 },
      );
    }

    const body = await request.json();
    const validation = SubmitSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.errors },
        { status: 400 },
      );
    }
    const { items, vendorNote } = validation.data;

    // snapshot orderItemId 검증 (live order 아님 — freeze 기준)
    const snapshot = (draft.snapshot ?? {}) as {
      items?: Array<{ orderItemId: string; productId: string | null; name: string }>;
    };
    const snapItems = snapshot.items ?? [];
    const snapIds = snapItems.map((it) => it.orderItemId);
    const invalid = items.filter((it) => !snapIds.includes(it.orderItemId));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: "Invalid order item IDs. Items do not match the original request.", invalid },
        { status: 400 },
      );
    }

    // 회신 항목 교체 + status 전이. 재고 mutation 절대 없음(§11.336).
    await db.$transaction(async (tx: any) => {
      await tx.receivingDraftItem.deleteMany({ where: { receivingDraftId: draft.id } });
      for (const it of items) {
        const snap = snapItems.find((s) => s.orderItemId === it.orderItemId);
        await tx.receivingDraftItem.create({
          data: {
            receivingDraftId: draft.id,
            orderItemId: it.orderItemId,
            productId: snap?.productId ?? null,
            name: snap?.name ?? "",
            receivedQuantity: it.receivedQuantity ?? null,
            lotNumber: it.lotNumber ?? null,
            expiryDate: it.expiryDate ? new Date(it.expiryDate) : null,
            vendorNote: it.vendorNote ?? null,
          },
        });
      }
      await tx.receivingDraft.update({
        where: { id: draft.id },
        data: {
          status: "PENDING_REVIEW",
          submittedAt: draft.submittedAt ?? new Date(),
          ...(vendorNote !== undefined ? { vendorNote } : {}),
        },
      });
    });

    // §11.348-A-2-notify — 회신 도착 → 연구소(소유자 + 조직 OWNER/ADMIN) 알림.
    //   public 라우트라 세션 없음 → draft 의 userId/organizationId 기준 수신자 산정.
    //   알림 실패가 vendor 제출(이미 커밋)을 막지 않도록 try/catch graceful.
    try {
      const recipientUserIds = new Set<string>();
      if (draft.userId) recipientUserIds.add(draft.userId);
      if (draft.organizationId) {
        const orgMembers = await db.organizationMember.findMany({
          where: { organizationId: draft.organizationId, role: { in: ["OWNER", "ADMIN"] } },
          select: { userId: true },
        });
        for (const m of orgMembers) if (m.userId) recipientUserIds.add(m.userId);
      }
      if (recipientUserIds.size > 0) {
        const recipients = Array.from(recipientUserIds).map((uid) => ({ userId: uid }));
        // VENDOR_REPLIED 재사용(공급사 응답 도착). entityType=ORDER (입고 회신 맥락).
        await dispatchNotificationEvent({
          eventType: "VENDOR_REPLIED",
          entityType: "ORDER",
          entityId: draft.orderId,
          triggeredBy: undefined,
          recipients,
          metadata: {
            kind: "receiving_reply_received",
            receivingDraftId: draft.id,
            orderId: draft.orderId,
            itemCount: items.length,
          },
        }).catch(() => {});
        for (const uid of recipientUserIds) {
          await sendPushNotification(
            uid,
            {
              title: "입고 회신 도착",
              body: "공급사가 입고 정보를 회신했습니다. 검토 후 승인하세요.",
              data: { type: "purchase", id: draft.orderId },
            },
            "VENDOR_REPLIED",
          ).catch(() => {});
        }
      }
    } catch {
      // 알림 실패는 응답 영향 0 (vendor 제출은 이미 커밋됨)
    }

    return NextResponse.json({
      ok: true,
      status: "PENDING_REVIEW",
      message: "입고 정보가 접수되었습니다. 연구소 검토 후 입고가 확정됩니다.",
      itemCount: items.length,
    });
  } catch (error) {
    console.error("Error submitting receiving response:", error);
    return NextResponse.json({ error: "Failed to submit response" }, { status: 500 });
  }
}
