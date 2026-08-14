import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { QuoteStatus, ActivityType } from "@prisma/client";
import { sendQuoteCompletedEmail, sendQuoteRejectedEmail } from "@/lib/email";
import { createActivityLogServer } from "@/lib/api/activity-logs";
import { validateTransition, ALLOWED_QUOTE_TRANSITIONS } from "@/lib/operations/state-machine";
import { logStateTransition } from "@/lib/operations/state-transition-logger";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";

// §O1 #transition-canonical — 전이 규칙은 canonical state-machine.ts(validateTransition)가
//   유일 SoT. 기존 로컬 ALLOWED_STATUS_TRANSITIONS 재정의는 canonical 과 drift(예: 단계 skip
//   PENDING→COMPLETED, 완료→취소 허용)했어 제거. 에러 응답의 allowedTransitions 표시는
//   canonical ALLOWED_QUOTE_TRANSITIONS 에서 재구성. (호영님 확정: 재활성화 a 허용 / b·c 금지.)

/**
 * §tenant-isolation-placeholder A3 #1·#2 — 조직 스코프 검사
 *
 * 이 라우트는 GET·PATCH 양쪽 모두 소유권/조직 검사가 **없었다**. enforceAction 의
 * 조직 게이트는 (a)≡(b) 항등이라 거절하지 못하므로(§tenant-isolation-placeholder §7.1)
 * 격리를 지탱하던 실체가 0이었고, 교차조직 GET 이 200 + 타 조직 데이터를 반환했다(실측).
 *
 * ⚠️ 순서 고정 — **스코프 먼저, 드리프트 나중**(§drift-masks-isolation).
 *   PATCH 아래쪽 findUnique 는 `include: { listItems: true }` 로 상시 500 이다.
 *   그 500 을 먼저 고치면 교차조직 쓰기가 착지한다. 따라서 이 검사는 **깨진 쿼리보다
 *   앞에서** 자체 select 로 org 를 읽어 판정한다 — 드리프트는 건드리지 않는다.
 *
 * 판정 기준은 `api/quotes/[id]/route.ts` GET 과 동일(본인 소유 OR 같은 조직 멤버).
 */
async function assertQuoteScope(
  quoteId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    select: { id: true, userId: true, organizationId: true },
  });

  if (!quote) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Quote not found" }, { status: 404 }),
    };
  }

  const isOwner = quote.userId === userId;
  let isOrgMember = false;

  if (!isOwner && quote.organizationId) {
    const membership = await db.organizationMember.findFirst({
      where: { userId, organizationId: quote.organizationId },
      select: { id: true },
    });
    isOrgMember = !!membership;
  }

  if (!isOwner && !isOrgMember) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true };
}

// 상태 한글 레이블
const STATUS_LABELS: Record<QuoteStatus, string> = {
  [QuoteStatus.PENDING]: "대기 중",
  [QuoteStatus.PARSED]: "파싱 완료",
  [QuoteStatus.SENT]: "발송됨",
  [QuoteStatus.RESPONDED]: "응답 완료",
  [QuoteStatus.COMPLETED]: "완료",
  [QuoteStatus.PURCHASED]: "구매 완료",
  [QuoteStatus.CANCELLED]: "취소됨",
};

/**
 * 견적 상태 업데이트 API
 * PATCH /api/quotes/[id]/status
 *
 * Body: { status: "COMPLETED" | "REJECTED" | ... , reason?: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();

    // §audit 주석 정정 — 인증 확인 + 아래 enforceAction(quote_status_change)이
    //   role(buyer/approver/ops_admin)을 서버에서 강제(클라 hide 무관). "인증되면 허용"은 stale.
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // ── Security enforcement ──
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'quote_status_change',
      targetEntityType: 'quote',
      targetEntityId: id,
      sourceSurface: 'quote-status-api',
      routePath: '/api/quotes/[id]/status',
    });
    if (!enforcement.allowed) return enforcement.deny();

    // ── 조직 스코프 (§tenant-isolation-placeholder A3 #2) ──
    //   enforceAction 의 조직 게이트는 판정하지 못한다. 실제 격리는 여기서 한다.
    //   ⚠️ 아래 findUnique(listItems 드리프트, 상시 500)보다 **앞**에 둔다 —
    //      순서가 뒤집히면 500 이 유일한 정지선이던 상태로 되돌아간다.
    //   lock 을 쥔 채 반환하지 않도록 fail() 로 닫는다(DB 쓰기 0 → complete 아님).
    const scope = await assertQuoteScope(id, session.user.id);
    if (!scope.ok) {
      enforcement.fail();
      return scope.response;
    }

    const body = await request.json();
    const { status, reason } = body;

    // 유효한 상태인지 확인
    if (!status || !Object.values(QuoteStatus).includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Allowed values: " + Object.values(QuoteStatus).join(", ") },
        { status: 400 }
      );
    }

    // 기존 견적 조회
    const quote = await db.quote.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        items: true,
        listItems: true,
      },
    });

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // §O1 — canonical state-machine 으로 전이 검증(SoT 단일).
    const currentStatus = quote.status as QuoteStatus;
    const transition = validateTransition("QUOTE", currentStatus, status);

    if (!transition.valid) {
      const allowedTransitions = ALLOWED_QUOTE_TRANSITIONS[currentStatus] || [];
      return NextResponse.json(
        {
          error: `Cannot transition from ${STATUS_LABELS[currentStatus]} to ${STATUS_LABELS[status as QuoteStatus]}`,
          allowedTransitions: allowedTransitions.map((s) => ({ status: s, label: STATUS_LABELS[s as QuoteStatus] })),
        },
        { status: 400 }
      );
    }

    // 이전 상태 저장 (로그용)
    const previousStatus = quote.status;

    // 상태 업데이트
    const updatedQuote = await db.quote.update({
      where: { id },
      data: {
        status,
        updatedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        items: true,
        listItems: true,
      },
    });

    // 액티비티 로그 기록
    const ipAddress = request.headers.get("x-forwarded-for") ||
                     request.headers.get("x-real-ip") ||
                     undefined;
    const userAgent = request.headers.get("user-agent") || undefined;

    createActivityLogServer({
      db,
      activityType: ActivityType.QUOTE_STATUS_CHANGED,
      entityType: "quote",
      entityId: id,
      userId: session.user.id,
      organizationId: quote.organizationId || undefined,
      metadata: {
        previousStatus,
        newStatus: status,
        reason,
        changedBy: session.user.name || session.user.email,
      },
      ipAddress,
      userAgent,
    }).catch((error) => {
      console.error("Failed to create activity log:", error);
    });

    // P7-1: 중앙화된 상태 전이 로그
    logStateTransition({
      domain: "QUOTE",
      entityId: id,
      fromStatus: previousStatus,
      toStatus: status,
      actorId: session.user.id,
      organizationId: quote.organizationId,
      reason,
    }).catch((error) => {
      console.error("Failed to log state transition:", error);
    });

    // 이메일 알림 발송 (비동기)
    const userEmail = quote.user?.email;
    const userName = quote.user?.name || "고객";
    const quoteNumber = quote.id.slice(-8).toUpperCase();
    const itemCount = (quote.listItems?.length || 0) + (quote.items?.length || 0);
    const totalAmount = quote.totalAmount
      ? `₩${quote.totalAmount.toLocaleString("ko-KR")}`
      : undefined;

    if (userEmail) {
      // 상태별 이메일 발송
      if (status === QuoteStatus.COMPLETED) {
        sendQuoteCompletedEmail({
          to: userEmail,
          customerName: userName,
          quoteNumber,
          completedDate: new Date().toLocaleDateString("ko-KR"),
          itemCount,
          totalAmount,
        }).catch((error) => {
          console.error("Failed to send quote completed email:", error);
        });
      } else if (status === QuoteStatus.CANCELLED && reason) {
        // 취소 시 거절 이메일 발송 (사유가 있는 경우)
        sendQuoteRejectedEmail({
          to: userEmail,
          customerName: userName,
          quoteNumber,
          reason,
        }).catch((error) => {
          console.error("Failed to send quote rejected email:", error);
        });
      }
    }

    enforcement.complete({
      beforeState: { status: previousStatus, id },
      afterState: { status, id },
    });

    return NextResponse.json({
      success: true,
      quote: updatedQuote,
      message: `견적 상태가 "${STATUS_LABELS[status as QuoteStatus]}"(으)로 변경되었습니다.`,
      transition: {
        from: { status: previousStatus, label: STATUS_LABELS[previousStatus as QuoteStatus] },
        to: { status, label: STATUS_LABELS[status as QuoteStatus] },
      },
    });
  } catch (error) {
    enforcement?.fail();
    console.error("Error updating quote status:", error);
    return NextResponse.json(
      { error: "Failed to update quote status" },
      { status: 500 }
    );
  }
}

/**
 * 견적 상태 조회 API
 * GET /api/quotes/[id]/status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // ── 조직 스코프 (§tenant-isolation-placeholder A3 #1) ──
    //   이 GET 은 enforceAction 조차 호출하지 않아 검사가 0 이었고,
    //   교차조직 요청이 200 + 타 조직 견적 데이터를 반환했다(실측 확인).
    const scope = await assertQuoteScope(id, session.user.id);
    if (!scope.ok) return scope.response;

    const quote = await db.quote.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    const currentStatus = quote.status as QuoteStatus;
    const allowedTransitions = ALLOWED_QUOTE_TRANSITIONS[currentStatus] || [];

    return NextResponse.json({
      id: quote.id,
      status: quote.status,
      label: STATUS_LABELS[currentStatus],
      allowedTransitions: allowedTransitions.map(s => ({
        status: s,
        label: STATUS_LABELS[s]
      })),
      createdAt: quote.createdAt,
      updatedAt: quote.updatedAt,
    });
  } catch (error) {
    console.error("Error fetching quote status:", error);
    return NextResponse.json(
      { error: "Failed to fetch quote status" },
      { status: 500 }
    );
  }
}
