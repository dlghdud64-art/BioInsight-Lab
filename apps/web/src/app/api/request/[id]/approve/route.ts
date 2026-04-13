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
      let order = null;
      if (purchaseRequest.quoteId) {
        const quote = await tx.quote.findUnique({
          where: { id: purchaseRequest.quoteId },
          include: { items: true },
        });

        if (quote) {
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
