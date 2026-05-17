import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PurchaseRequestStatus, TeamRole, OrderStatus } from "@prisma/client";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import {
  validateCategoryBudgetInTransaction,
  resolvePeriodYearMonth,
  type BudgetGateAuditEvent,
} from "@/lib/budget/category-budget-gate";
import {
  withSerializableBudgetTx,
  BudgetBlockedError,
  buildBudgetEventKey,
  recordBudgetEventIdempotent,
} from "@/lib/budget/budget-concurrency";
import {
  recordMutationAudit,
  buildAuditEventKey,
} from "@/lib/audit/durable-mutation-audit";
// §11.209d-notification — requester 에게 결재 승인 email (best effort).
import { sendEmail } from "@/lib/email/sender";
import { generatePurchaseApprovedEmail } from "@/lib/email/templates";
// §11.209d-notification-inapp-server-wiring — requester 에게 in-app 알림
// (best effort). NotificationEvent + IN_APP NotificationAction 자동 생성.
import { dispatchNotificationEvent } from "@/lib/notifications";
// #mobile-push-notification Phase 2 — requester 에게 push (best effort).
import { sendPushNotification } from "@/lib/notifications/push-sender";
// #post-approval-purchase-order-flow Phase 1.3-wiring-D — 결재 통과 자동
// vendor PO 생성 service. POCandidate[] (vendor 별) 가 있으면 vendor 별
// Order N개 생성, 0개 시 legacy quote.items 기반 1 Order fallback.
import { convertPOCandidatesToOrders } from "@/lib/orders/convert-pocandidate-to-orders";

/**
 * 구매 요청 승인 (ADMIN/OWNER만 가능)
 * 승인 시 Order로 변환
 *
 * Security: enforceAction (purchase_request_approve)
 * Budget: SERIALIZABLE tx + category budget gate
 * Audit: budget gate decision → durable audit event shape (Batch 6)
 *
 * ⚠️ suggestCategoryMapping()은 이 경로에서 호출하지 않는다.
 *    normalizedCategoryId가 없으면 미분류(null)로 gate에 전달.
 *    fuzzy 매핑은 backfill/proposal only — 승인 truth에 사용 금지.
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

    const { id: requestId } = await params;

    // ── Security enforcement ──
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'purchase_request_approve',
      targetEntityType: 'approval',
      targetEntityId: requestId,
      sourceSurface: 'request-approval-api',
      routePath: '/api/request/[id]/approve',
    });

    if (!enforcement.allowed) {
      return enforcement.deny();
    }

    // ── Pre-tx 조회 (트랜잭션 밖에서 — validation only) ──
    const purchaseRequest = await db.purchaseRequest.findUnique({
      where: { id: requestId },
      include: {
        team: {
          include: {
            organization: { select: { id: true, timezone: true } },
          },
        },
        requester: true,
        quote: true,
      },
    });

    if (!purchaseRequest) {
      enforcement.fail();
      return NextResponse.json(
        { error: "Purchase request not found" },
        { status: 404 }
      );
    }

    if (purchaseRequest.status !== PurchaseRequestStatus.PENDING) {
      enforcement.fail();
      return NextResponse.json(
        { error: "Purchase request is not pending" },
        { status: 400 }
      );
    }

    // 권한 확인: ADMIN 또는 OWNER만 승인 가능
    const teamMember = await db.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId: purchaseRequest.teamId || "",
        },
      },
    });

    if (!teamMember || teamMember.role !== TeamRole.ADMIN) {
      enforcement?.fail();
      return NextResponse.json(
        { error: "Forbidden: Only ADMIN can approve requests" },
        { status: 403 }
      );
    }

    // ── Org timezone → period_key 결정 ──
    const orgTimezone = purchaseRequest.team?.organization?.timezone ?? "Asia/Seoul";
    const orgId = purchaseRequest.team?.organizationId;
    const approvalTimestamp = new Date();
    const periodYearMonth = resolvePeriodYearMonth(orgTimezone, approvalTimestamp);

    // ── SERIALIZABLE 트랜잭션: 예산 검증 + 승인 + Order 생성 ──
    let budgetAuditEvent: BudgetGateAuditEvent | undefined;

    const result = await withSerializableBudgetTx(db, async (tx: any) => {
      // 0. 카테고리 예산 검증 (SERIALIZABLE tx 안에서 — race condition 방지)
      let budgetWarnings: any[] = [];

      if (orgId && purchaseRequest.quoteId) {
        const quoteForBudget = await tx.quote.findUnique({
          where: { id: purchaseRequest.quoteId },
          include: {
            items: {
              include: { product: { select: { category: true, normalizedCategoryId: true } } },
            },
          },
        });

        if (quoteForBudget?.items?.length) {
          // normalizedCategoryId가 있으면 사용. 없으면 null(미분류).
          // ⚠️ suggestCategoryMapping() 호출 금지 — fuzzy는 backfill only.
          const gateItems = quoteForBudget.items.map((item: any) => ({
            normalizedCategoryId: item.product?.normalizedCategoryId ?? null,
            amount: item.lineTotal ?? (item.unitPrice ?? 0) * (item.quantity ?? 1),
          }));

          const budgetValidation = await validateCategoryBudgetInTransaction(
            tx,
            orgId,
            gateItems,
            periodYearMonth,
          );

          // Audit event 수집 (Batch 6 durable shape)
          budgetAuditEvent = {
            ...budgetValidation.auditEvent,
            targetEntityType: "purchase_request",
            targetEntityId: requestId,
          };

          // hard_stop 위반 → BudgetBlockedError → SERIALIZABLE tx rollback
          if (!budgetValidation.allowed) {
            throw new BudgetBlockedError(budgetValidation);
          }

          budgetWarnings = budgetValidation.warnings;
        }
      }

      // 1. 구매 요청 승인
      const approvedRequest = await tx.purchaseRequest.update({
        where: { id: requestId },
        data: {
          status: PurchaseRequestStatus.APPROVED,
          approverId: session.user.id,
          approvedAt: approvalTimestamp,
        },
      });

      // 2. Order 생성 (견적이 있는 경우)
      //
      // #post-approval-purchase-order-flow Phase 1.3-wiring-D — vendor-aware
      // 결재 통과 자동 vendor PO 생성. POCandidate (vendor 별 1개씩) 가
      // 있으면 service 호출 → vendor 별 N Order. 없으면 legacy quote.items
      // 기반 1 NULL-vendor Order (backward compat).
      //
      // PurchaseRequest.orderId 는 단수 FK 라 multi-Order 시 첫 Order id 매핑
      // (canonical 매핑은 by-quote API 가 다룸 — Phase 4.3 + 1.2 정합).
      let order: any = null;
      if (purchaseRequest.quoteId) {
        const quote = await tx.quote.findUnique({
          where: { id: purchaseRequest.quoteId },
          include: { items: true },
        });

        if (quote) {
          // 결재 통과 POCandidate fetch — quote 의 user / org 기준 (createPoCandidate
          // wiring 이 quote.id 가 아닌 user/org 단위로 candidate 생성).
          const candidates = await tx.pOCandidate.findMany({
            where: {
              userId: purchaseRequest.requesterId,
              organizationId: purchaseRequest.organizationId,
            },
            include: { items: true },
          });

          if (candidates.length > 0) {
            // vendor-aware path — service 호출 (outer SERIALIZABLE tx 전달,
            // nested transaction 회피).
            const result = await convertPOCandidatesToOrders(
              {
                quoteId: purchaseRequest.quoteId,
                userId: purchaseRequest.requesterId,
                organizationId: purchaseRequest.organizationId,
                candidates,
              },
              { client: tx },
            );
            if (result.created.length > 0) {
              const firstOrderId = result.created[0].orderId;
              // notification 변수 정합 — order = 첫 Order (multi-Order 시 by-quote API 사용)
              order = await tx.order.findUnique({
                where: { id: firstOrderId },
                include: { items: true },
              });
              await tx.purchaseRequest.update({
                where: { id: requestId },
                data: { orderId: firstOrderId },
              });
            }
          } else {
            // legacy fallback — POCandidate 0개 시 quote.items 기반 1 NULL-vendor
            // Order. multi-vendor RFQ 가 아닌 단순 1 quote 1 Order 흐름 호환.
            const orderNumber = `ORD-${approvalTimestamp.toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
            order = await tx.order.create({
              data: {
                userId: purchaseRequest.requesterId,
                quoteId: purchaseRequest.quoteId,
                orderNumber,
                totalAmount: purchaseRequest.totalAmount || quote.totalAmount || 0,
                status: OrderStatus.ORDERED,
                notes: purchaseRequest.message || null,
                items: {
                  create: quote.items.map((item: any) => ({
                    productId: item.productId,
                    name: item.name || "Unknown Product",
                    brand: item.brand,
                    catalogNumber: item.catalogNumber,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice || 0,
                    lineTotal: item.lineTotal || 0,
                    notes: item.notes,
                  })),
                },
              },
              include: { items: true },
            });
            await tx.purchaseRequest.update({
              where: { id: requestId },
              data: { orderId: order.id },
            });
          }
        }
      }

      // 3. Reserve BudgetEvent 기록 (카테고리별)
      // release 시 이 레코드를 참조하여 정확히 같은 amount/categoryId/yearMonth로 되돌림
      if (orgId && budgetAuditEvent?.decisions) {
        for (const decision of budgetAuditEvent.decisions) {
          if (decision.requestedAmount > 0) {
            await recordBudgetEventIdempotent(tx, {
              organizationId: orgId,
              budgetEventKey: buildBudgetEventKey(
                orgId,
                requestId,
                "approval_reserved",
                decision.categoryId,
              ),
              eventType: "approval_reserved",
              sourceEntityType: "purchase_request",
              sourceEntityId: requestId,
              categoryId: decision.categoryId,
              yearMonth: decision.yearMonth,
              amount: decision.requestedAmount,
              preCommitted: decision.preCommitCommitted,
              postCommitted: decision.postCommitCommitted,
              decisionPayload: decision,
              executedBy: session.user.id,
            });
          }
        }
      }

      // 4. Durable audit event — 같은 SERIALIZABLE tx 안에서 기록
      await recordMutationAudit(tx, {
        auditEventKey: buildAuditEventKey(
          orgId || 'no-org', requestId, 'purchase_request_approve',
        ),
        orgId: orgId || 'no-org',
        actorId: session.user.id,
        route: '/api/request/[id]/approve',
        action: 'purchase_request_approve',
        entityType: 'purchase_request',
        entityId: requestId,
        result: 'success',
        correlationId: enforcement!.correlationId,
        requestId,
        orderId: order?.id,
        periodKey: budgetAuditEvent?.decisions?.[0]?.periodKey,
        normalizedCategoryId: budgetAuditEvent?.decisions?.[0]?.categoryId,
        amount: purchaseRequest.totalAmount ?? undefined,
        thresholds: budgetAuditEvent?.decisions?.[0]?.thresholds,
        decisionBasis: budgetAuditEvent?.decisions,
        budgetEventKey: budgetAuditEvent?.decisions?.[0]
          ? buildBudgetEventKey(orgId!, requestId, 'approval_reserved', budgetAuditEvent.decisions[0].categoryId)
          : undefined,
      });

      return { purchaseRequest: approvedRequest, order, budgetWarnings };
    });

    // ── Enforcement: 성공 시 audit 기록 (budget gate decision 포함) ──
    enforcement.complete({
      beforeState: { status: 'PENDING', requestId },
      afterState: {
        status: 'APPROVED',
        requestId,
        orderId: result.order?.id,
        periodYearMonth,
        budgetGateDecision: budgetAuditEvent ?? null,
        budgetWarnings: result.budgetWarnings.length > 0
          ? result.budgetWarnings
          : undefined,
      },
    });

    // §11.209d-notification — requester 에게 결재 승인 email (best effort).
    // mutation 성공 후 호출 — email fail 시 mutation 결과 영향 0.
    if (purchaseRequest.requester?.email) {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        const quoteId = purchaseRequest.quoteId;
        const quoteUrl = quoteId
          ? `${appUrl}/dashboard/quotes?focus=${encodeURIComponent(quoteId)}`
          : `${appUrl}/dashboard/quotes`;
        const template = generatePurchaseApprovedEmail({
          requesterName: purchaseRequest.requester.name ?? purchaseRequest.requester.email,
          approverName: session.user.name ?? session.user.email ?? "결재자",
          quoteTitle: purchaseRequest.title,
          totalAmount: purchaseRequest.totalAmount,
          currency: "KRW",
          quoteUrl,
        });
        await sendEmail({
          to: purchaseRequest.requester.email,
          subject: template.subject,
          html: template.html,
          text: template.text,
        });
      } catch (emailErr) {
        // graceful — mutation 성공 유지
        console.error("[request/approve] requester email 발송 실패 (mutation 정합 유지):", emailErr);
      }
    }

    // §11.209d-notification-inapp-server-wiring — requester 에게 in-app 알림.
    // mutation 성공 후 호출 — fail 시 mutation 결과 영향 0.
    if (purchaseRequest.requesterId) {
      try {
        await dispatchNotificationEvent({
          eventType: "PURCHASE_APPROVED",
          entityType: "PURCHASE_REQUEST",
          entityId: requestId,
          triggeredBy: session.user.id,
          recipients: [
            {
              userId: purchaseRequest.requesterId,
              email: purchaseRequest.requester?.email ?? undefined,
            },
          ],
          metadata: {
            quoteId: purchaseRequest.quoteId,
            quoteTitle: purchaseRequest.title,
            totalAmount: purchaseRequest.totalAmount,
            approverId: session.user.id,
            orderId: result.order?.id ?? null,
          },
        });
      } catch (notifErr) {
        // graceful — mutation 정합 유지
        console.error("[request/approve] in-app notification 발송 실패 (mutation 정합 유지):", notifErr);
      }
    }

    // #mobile-push-notification Phase 2 — requester 에게 push (best effort).
    if (purchaseRequest.requesterId) {
      try {
        await sendPushNotification(purchaseRequest.requesterId, {
          title: "결재 승인 완료",
          body: `${purchaseRequest.title} 결재가 승인되었습니다.`,
          data: {
            type: "purchase_approved",
            quoteId: purchaseRequest.quoteId,
            requestId: requestId,
            orderId: result.order?.id ?? null,
          },
        }, "PURCHASE_APPROVED");
      } catch (pushErr) {
        console.error("[request/approve] push notification 실패 (mutation 정합 유지):", pushErr);
      }
    }

    // §11.250f #budget-warning-notification-dispatch — P1 마지막 cluster.
    //   validateCategoryBudgetInTransaction warning/soft_limit level 발생 시
    //   BUDGET_WARNING dispatch + push. hard_stop 은 BudgetBlockedError 로 이미 차단됨.
    //   §11.229b-5/-6 + §11.250a/cd/b/g/e 패턴 정확 reuse.
    // §11.250f-org #budget-warning-org-broadcast — organizationMember OWNER+ADMIN
    //   다중 recipient. 관리자가 예산 임박/소프트 리밋 초과 즉시 인지.
    //   §11.250acd-2 패턴 정확 reuse (Set dedup + recipients array + push for-of).
    if (result.budgetWarnings.length > 0) {
      const budgetWarnings = result.budgetWarnings;
      const topWarning = budgetWarnings[0];
      const summary = budgetWarnings
        .map((w: any) => `${w.categoryDisplayName} ${w.projectedUsagePercent}%`)
        .join(", ");

      // §11.250f-org — recipients dedup (requester + org broadcast).
      const recipientUserIds = new Set<string>();
      if (purchaseRequest.requesterId) recipientUserIds.add(purchaseRequest.requesterId);
      if (purchaseRequest.organizationId) {
        try {
          const orgMembers = await db.organizationMember.findMany({
            where: {
              organizationId: purchaseRequest.organizationId,
              role: { in: ["OWNER", "ADMIN"] },
            },
            select: { userId: true },
          });
          for (const m of orgMembers as Array<{ userId: string }>) {
            if (m.userId) recipientUserIds.add(m.userId);
          }
        } catch (orgErr) {
          // graceful — requester single fallback
          console.error("[request/approve] BUDGET_WARNING org broadcast member 조회 실패 (single fallback):", orgErr);
        }
      }

      if (recipientUserIds.size === 0) return NextResponse.json({
        purchaseRequest: result.purchaseRequest,
        order: result.order,
        ...(result.budgetWarnings.length > 0 && {
          budgetWarnings: result.budgetWarnings.map((w: any) =>
            `${w.categoryDisplayName}: 예상 사용률 ${w.projectedUsagePercent}% (${w.level === "soft_limit" ? "소프트 리밋 초과" : "주의"})`,
          ),
        }),
      });

      const recipients = Array.from(recipientUserIds).map((uid) => ({ userId: uid }));

      // inApp dispatch
      try {
        await dispatchNotificationEvent({
          eventType: "BUDGET_WARNING",
          entityType: "BUDGET",
          entityId: requestId,
          triggeredBy: session.user.id,
          recipients,
          metadata: {
            warnings: budgetWarnings.map((w: any) => ({
              categoryDisplayName: w.categoryDisplayName,
              projectedUsagePercent: w.projectedUsagePercent,
              level: w.level,
              budgetAmount: w.budgetAmount,
              projectedCommitted: w.projectedCommitted,
            })),
            warningCount: budgetWarnings.length,
            requestTitle: purchaseRequest.title,
            recipientCount: recipients.length,
          },
        });
      } catch (notifErr) {
        // graceful — mutation 정합 유지
        console.error("[request/approve] BUDGET_WARNING notification 발송 실패 (mutation 정합 유지):", notifErr);
      }

      // §11.250f-org — Expo OS-level push for-of multi-recipient.
      const titleKo = topWarning.level === "soft_limit"
        ? "예산 소프트 리밋 초과 경고"
        : "예산 사용률 경고";
      for (const recipientUserId of recipientUserIds) {
        try {
          await sendPushNotification(recipientUserId, {
            title: titleKo,
            body: `${purchaseRequest.title} — ${summary}`,
            data: {
              type: "system",
              id: requestId,
              warningCount: budgetWarnings.length,
              level: topWarning.level,
            },
          }, "BUDGET_WARNING");
        } catch (pushErr) {
          // graceful — mutation 정합 유지
          console.error("[request/approve] BUDGET_WARNING push notification 실패 (mutation 정합 유지):", pushErr);
        }
      }
    }

    return NextResponse.json({
      purchaseRequest: result.purchaseRequest,
      order: result.order,
      ...(result.budgetWarnings.length > 0 && {
        budgetWarnings: result.budgetWarnings.map((w: any) =>
          `${w.categoryDisplayName}: 예상 사용률 ${w.projectedUsagePercent}% (${w.level === "soft_limit" ? "소프트 리밋 초과" : "주의"})`,
        ),
      }),
    });
  } catch (error: any) {
    // BudgetBlockedError → SERIALIZABLE tx rollback으로 도달
    if (error instanceof BudgetBlockedError || error?.__budgetBlocked) {
      enforcement?.fail();
      const blockers = error.blockers ?? [];
      const warnings = error.warnings ?? [];
      const blockerMessages = blockers.map(
        (b: any) =>
          `${b.categoryDisplayName}: 예상 사용률 ${b.projectedUsagePercent}% (한도 ${b.budgetAmount.toLocaleString()}원, 초과)`,
      );
      return NextResponse.json(
        {
          error: "카테고리 예산 한도를 초과하여 승인할 수 없습니다.",
          blockers: blockerMessages,
          budgetValidation: {
            allowed: false,
            blockers,
            warnings,
          },
        },
        { status: 403 },
      );
    }

    enforcement?.fail();
    console.error("Error approving purchase request:", error);
    return NextResponse.json(
      { error: "Failed to approve purchase request" },
      { status: 500 }
    );
  }
}
