import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PurchaseRequestStatus, OrderStatus } from "@prisma/client";
// §purchase-request-org-axis (나)-1b — 승인 권한 역할 집합 정본. 사본 금지.
import { isOrgApprover } from "@/lib/billing/approver-routing";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { checkApprovalLimit } from "@/lib/security/approval-limit-guard";
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
// §pocandidate-creation-flow — 결재 통과 시 candidate 자동 생성 + 변환 풀
// 3중 필터 (bulk-po 와 승인통과집합 단일 소스 공유).
import { APPROVAL_PASSED_STATUSES } from "@/lib/orders/approval-passed-statuses";
// §pocandidate-vendor-split — 단수형 → 복수형(vendor 별 N개, 유일-응답 파생 A안).
// 분할 근거 없으면 단수형과 동등(잔여 단일 + selectedReply vendorName 승계).
import { createPOCandidatesFromQuote } from "@/lib/persistence/po-candidate-server";

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
        // §purchase-request-org-axis (나)-1a — 소속 축 직결(2026-08-30).
        //   team 을 경유해 organization 에 닿던 구조를 걷는다. team include 는
        //   organization 에 도달하기 위한 **통로일 뿐**이었고, teamId 가 null 인
        //   생성 경로(work-queue request-approval)에서는 그 통로가 끊겨
        //   orgId·orgTimezone 이 모두 undefined 였다.
        //   🔑 teamId 는 스칼라라 include 없이도 그대로 반환된다(:116 게이트가 계속 쓴다).
        organization: { select: { id: true, timezone: true } },
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

    // §purchase-request-org-axis (나)-1b — 승인 게이트 축 교체 (2026-08-30).
    //
    // 🛑 이전: TeamMember(userId_teamId) 조회 + `teamMember.role !== TeamRole.ADMIN`.
    //   teamId 가 nullable 인데 `teamId || ""` 로 조회해 **팀 없는 요청은 전부 403** 이었다.
    //   quoteId 를 채우는 유일한 생성 지점(work-queue/purchase-conversion
    //   request-approval)이 teamId 를 안 채우므로, 예산 검증이 필요한 경로가
    //   승인 자체에 도달하지 못했다. prod 실측: Team 0 · TeamMember 0 —
    //   TeamRole 게이트로는 **아무도 승인할 수 없었다.**
    //
    // 지금: 소속 축(organizationId, NOT NULL) 위에서 조직 역할로 판정한다.
    //   A축 = APPROVER · ADMIN · OWNER (호영님 판정 2026-08-30 · 정본은
    //   `ORG_APPROVER_ROLES` — 이 파일에 사본을 두지 않는다).
    //   🔑 한도 조회와 **같은 행**이다. 두 번 조회하면 두 판정이 다른 행을 볼 수 있다
    //     (역할은 있는데 한도는 못 읽는 상태). findUnique 하나로 합친다.
    //
    // §S2 #approval-limit-server-enforce — per-user 단일건 승인 한도 서버 강제
    //   (audit S2 HIGH). actor 의 OrganizationMember.approvalLimit(null=무제한)이
    //   PR 금액보다 작으면 직접 승인 차단(403) + 상위 승인자 안내. selectApproverByAmount
    //   의 escalation 설계를 실행시점에 강제 — 라우팅 추천만으론 권한 보유 actor 가
    //   자기 한도 초과 건을 직접 승인하던 우회를 닫는다. 카테고리 예산 게이트(tx 내)와
    //   별 통제축(개인 결재 권한). read-only 비교라 tx 전 pre-validation.
    const actorOrgMembership = await db.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId: purchaseRequest.organizationId,
        },
      },
      select: { role: true, approvalLimit: true },
    });

    if (!isOrgApprover(actorOrgMembership?.role)) {
      enforcement?.fail();
      return NextResponse.json(
        { error: "Forbidden: 조직 승인 권한이 없습니다 (APPROVER · ADMIN · OWNER)" },
        { status: 403 }
      );
    }

    const approvalLimitCheck = checkApprovalLimit(
      actorOrgMembership?.approvalLimit ?? null,
      purchaseRequest.totalAmount ?? 0,
    );
    if (!approvalLimitCheck.allowed) {
      enforcement?.fail();
      return NextResponse.json(
        { error: approvalLimitCheck.reason, requiresHigherApprover: true },
        { status: 403 },
      );
    }

    // ── Org timezone → period_key 결정 ──
    // §purchase-request-org-axis (나)-1a — team 경유 → 직결.
    //   orgTimezone 은 예산 기간 키(periodYearMonth)를 정한다. team 이 끊긴 요청에서
    //   "Asia/Seoul" 로 떨어지면 비서울 조직의 예산 기간이 어긋난다 — 값이 없는 게
    //   아니라 **틀린 값이 조용히 들어가는** 자리라 함께 직결한다.
    const orgTimezone = purchaseRequest.organization?.timezone ?? "Asia/Seoul";
    const orgId = purchaseRequest.organizationId;
    const approvalTimestamp = new Date();
    const periodYearMonth = resolvePeriodYearMonth(orgTimezone, approvalTimestamp);

    // ── SERIALIZABLE 트랜잭션: 예산 검증 + 승인 + Order 생성 ──
    let budgetAuditEvent: BudgetGateAuditEvent | undefined;

    const result = await withSerializableBudgetTx(db, async (tx) => {
      // 0. 카테고리 예산 검증 (SERIALIZABLE tx 안에서 — race condition 방지)
      let budgetWarnings: any[] = [];

      if (orgId && purchaseRequest.quoteId) {
        const quoteForBudget = await tx.quote.findUnique({
          where: { id: purchaseRequest.quoteId },
          include: {
            // §purchase-request-org-axis #카테고리축-부재 (호영님 판정 2026-08-30 · 후보 3).
            //   이전: `product: { select: { category: true, normalizedCategoryId: true } }`
            //   🛑 Product 에 normalizedCategoryId 가 **없다** — schema 에도 두 DB 에도.
            //     (PurchaseRecord · MutationAuditEvent 에만 있다.) 이 select 는 실행되면
            //     Prisma validation 에서 던졌다. tx 가 any 라 tsc 가 못 잡았고, 이 분기가
            //     orgId undefined 로 도달 불가였던 동안 아무도 몰랐다 — 두 결함이
            //     서로를 가린 형태다(§4b ↔ §4c).
            //   판정: 후보 1(Product FK 신설)도 후보 2(ProductCategory 매핑)도 아니다.
            //     prod 실측 SpendingCategory 0 · CategoryBudget 0 — **카테고리 축 자체가
            //     아직 없다.** 없는 축을 없다고 표기하는 것이 정직하다((다) 원칙 승계).
            items: { include: { product: { select: { category: true } } } },
          },
        });

        if (quoteForBudget?.items?.length) {
          // 🛑 카테고리 단위 예산 게이트는 **미강제**다 — 카테고리 축 부재(알려진 상태).
          //   normalizedCategoryId 를 항상 null 로 넘긴다. 게이트는 amountByCategory 가
          //   비어 조기 통과(allowed: true · warnings 0)한다.
          //   ⚠️ 이것은 예산 게이트 전면 무력화가 **아니다.** 조직 단위 축(orgId 로 진입 ·
          //     periodYearMonth · SERIALIZABLE tx · audit event)은 그대로 살아 있고,
          //     CategoryBudget 행이 서는 순간 카테고리 판정만 붙으면 된다.
          //   ⚠️ suggestCategoryMapping() 호출 금지 — fuzzy는 backfill only (기존 조항).
          //   📌 후보 1(Product.normalizedCategoryId FK 신설)은 독립 큐가 아니라
          //     **CategoryBudget 실사용 트랙의 선행 DDL** 로 결박한다. 그 트랙이 열릴 때
          //     축부터 세운다(prod Product 314행 백필 정책이 그때 필요하다).
          const gateItems = quoteForBudget.items.map((item: any) => ({
            normalizedCategoryId: null,
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
          // §pocandidate-creation-flow — 변환 풀 3중 필터 (root-fix 누락 지점
          // 보완, bulk-po 와 동일 계약): 해당 quote(quoteId) + 결재 통과
          // (approvalStatus IN 승인통과집합) + po_conversion_candidate stage.
          const candidates = await tx.pOCandidate.findMany({
            where: {
              userId: purchaseRequest.requesterId,
              organizationId: purchaseRequest.organizationId,
              quoteId: purchaseRequest.quoteId,
              approvalStatus: { in: [...APPROVAL_PASSED_STATUSES] },
              stage: "po_conversion_candidate",
            },
            include: { items: true },
          });

          // §pocandidate-creation-flow — candidate 0건 + items 보유 시 결재
          // 통과 시점 자동 생성 (A안, 호영님 2026-08-04 확정). 같은 tx 안이라
          // 생성 실패 = 승인 전체 롤백 (silent 실패 불가). 멱등 = 위 3중
          // 필터 fetch 가 존재 검사를 겸함. items 0 quote 는 생성 skip →
          // legacy fallback 유지 (기존 동작 보존).
          if (candidates.length === 0 && quote.items.length > 0) {
            const selectedReply = quote.selectedReplyId
              ? await tx.quoteReply.findUnique({
                  where: { id: quote.selectedReplyId },
                  select: { vendorName: true },
                })
              : null;
            // §pocandidate-vendor-split A안 — 품목별 응답 vendor 조립.
            // QuoteVendorResponseItem 실존 = 해당 vendor 가 그 품목에 응답한 truth.
            // 유일-응답 품목만 vendor 확정(그룹핑), 다중/0 은 잔여 "" (의사결정 대행 0).
            const responseItems = await tx.quoteVendorResponseItem.findMany({
              where: { quoteItemId: { in: quote.items.map((it: { id: string }) => it.id) } },
              select: {
                quoteItemId: true,
                vendorRequest: { select: { vendorName: true } },
              },
            });
            const vendorsByItem = new Map<string, Set<string>>();
            for (const r of responseItems) {
              const name = r.vendorRequest?.vendorName?.trim();
              if (!name) continue;
              const set = vendorsByItem.get(r.quoteItemId) ?? new Set<string>();
              set.add(name);
              vendorsByItem.set(r.quoteItemId, set);
            }
            // §quote-item-vendor-selection P4 — 사용자 확정(selectedVendorRequestId)
            //   → vendorName 역참조. 소비 계층 1순위(선택 > 파생 > 잔여).
            //   선택이 없는 품목은 undefined → split 이 파생/잔여로 폴백(회귀 0).
            const selectedIds = Array.from(
              new Set(
                quote.items
                  .map((it: { selectedVendorRequestId?: string | null }) => it.selectedVendorRequestId)
                  .filter((v: string | null | undefined): v is string => !!v),
              ),
            );
            const selectedNameById = new Map<string, string>();
            if (selectedIds.length > 0) {
              const picked = await tx.quoteVendorRequest.findMany({
                where: { id: { in: selectedIds } },
                select: { id: true, vendorName: true },
              });
              for (const p of picked) {
                if (p.vendorName?.trim()) selectedNameById.set(p.id, p.vendorName.trim());
              }
            }
            const createdList = await createPOCandidatesFromQuote(tx, {
              quote: {
                id: quote.id,
                totalAmount: quote.totalAmount ?? null,
                items: quote.items.map((it: any) => ({
                  ...it,
                  respondedVendors: Array.from(vendorsByItem.get(it.id) ?? []),
                  selectedVendor: it.selectedVendorRequestId
                    ? (selectedNameById.get(it.selectedVendorRequestId) ?? null)
                    : null,
                })),
              },
              userId: purchaseRequest.requesterId,
              organizationId: purchaseRequest.organizationId,
              vendorName: selectedReply?.vendorName ?? null,
              totalAmount: purchaseRequest.totalAmount ?? null,
              approvalStatus: "in_app_approved",
            });
            if (createdList) {
              // 변환 서비스는 items 포함 candidate 형태 소비 — 생성 row 그대로 전달.
              // 🛑 `tx: any` 를 걷자 드러난 형태 불일치 (2026-08-30 · §4b 후속).
              //   candidates 는 Prisma POCandidate(+items) 이고 createdList 는
              //   손으로 쓴 POCandidateRow 다. 실제 갈리는 필드는 하나 —
              //     POCandidateRow.expectedDelivery : string | null
              //     Prisma  .expectedDelivery       : Date   | null
              //   소비자(convertPOCandidatesToOrders)가 쓰는 필드는 items · id ·
              //   vendor · totalAmount · expectedDelivery 뿐이고, Prisma 는 DateTime 에
              //   ISO 문자열을 받으므로 **런타임은 통과한다.** 타입만 갈린다.
              //   📌 큐: 두 형태를 한쪽으로 통일한다(POCandidateRow 를 Prisma 파생 타입으로
              //     바꾸는 쪽이 유력). 여기서 고치면 po-candidate-server 소비자 전수가
              //     걸려 이 슬라이스 범위를 넘는다.
              //   🔑 이 캐스트는 `tx: any` 와 다르다 — 그것은 콜백 **전체**를 껐고
              //     이것은 알려진 불일치 **한 지점**만 연다. 범위가 곧 정직성이다.
              candidates.push(...(createdList as unknown as typeof candidates));
            }
          }

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
      // §purchase-request-org-axis — `if (purchaseRequest.organizationId)` 제거
      //   (2026-08-30). 이 분기는 컬럼이 없어 **항상 거짓**이었다 — OWNER+ADMIN
      //   브로드캐스트가 단 한 번도 돌지 않았고 수신자는 요청자 1명뿐이었다.
      //   컬럼이 NOT NULL 이 된 지금 조건은 항상 참이므로 분기를 걷는다.
      //   🔑 "고쳤다" 가 아니라 **이제 돌기 시작한다** — 재측정 대상이다.
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
