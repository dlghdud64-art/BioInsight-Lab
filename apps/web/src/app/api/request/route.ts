import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PurchaseRequestStatus, TeamRole } from "@prisma/client";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
/* §quote-approval-request-removed (2026-09-26 · 호영님 판정) — 결재 요청은 **결재가 열려 있을 때만** 받는다.
 *   견적 상세의 「승인 요청」 버튼이 이 라우트를 부르면서 canRequestApproval 을 거치지 않았다 —
 *   prod capability 는 enabled:false(policy_not_enabled)인데 이 경로만 열려 있었다(호영님 실측).
 *   🔑 라우트는 지우지 않는다 — 재입고 요청 쪽과 PurchaseRequest 모델을 공유한다. **막기만** 한다.
 *   판정은 request-approval 라우트의 400 두 개와 **같은 함수**가 한다(§approval-gate-single-source). */
import { resolveApprovalCapability } from "@/lib/approval/approval-capability.server";
import { APPROVAL_BLOCK_MESSAGE } from "@/lib/approval/approval-capability";

/**
 * 구매 요청 생성 (MEMBER만 가능)
 */
export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { teamId, title, message, items, quoteId, totalAmount } = body;

    // ── Security enforcement ──
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'purchase_request_create',
      targetEntityType: 'purchase_request',
      targetEntityId: 'new',
      sourceSurface: 'purchase-request-api',
      routePath: '/api/request',
    });
    if (!enforcement.allowed) return enforcement.deny();

    // §quote-approval-request-removed (2026-09-26 · 호영님 판정) — 결재 게이트. 호출자가 0이어도 라우트가 스스로 막는다.
    const capability = await resolveApprovalCapability(session.user.id);
    if (!capability.enabled) {
      /* 🔑 raw NextResponse 가 아니라 enforcement.reject() 를 쓴다(§audit-reject-raw-4xx 래칫).
         lock 을 먼저 풀고 응답을 만든다 — 내보내고 정리하면 실패 시 흔적이 없다. */
      return enforcement.reject(400, {
        error: "APPROVAL_NOT_AVAILABLE",
        reason: capability.reason,
        message: capability.reason ? APPROVAL_BLOCK_MESSAGE[capability.reason] : "결재 요청을 사용할 수 없습니다.",
      });
    }

    if (!teamId || !title || !items || !Array.isArray(items) || items.length === 0) {
      /* §quote-approval-request-removed (2026-09-26 · 호영님 판정) — 핸들러 판정 거부는 reject() 로 낸다(§audit-reject-raw-4xx).
         🔑 이 지점은 **원래 있던** raw 4xx 다. 위에 게이트 블록이 들어가면서
            래칫 스캐너의 260자 창 밖으로 deny() 가 밀려 드러났다 —
            래칫이 올라간 게 아니라 **가려져 있던 것이 보인 것**이다(§4원칙 ⑤ 고정 폭 창).
            그 자리에서 정본 형태로 바꾼다. */
      return enforcement.reject(400, {
        error: "Team ID, title, and items are required",
      });
    }

    // 팀 멤버인지 확인
    const teamMember = await db.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId,
        },
      },
    });

    if (!teamMember) {
      return NextResponse.json(
        { error: "Forbidden: Not a member of this team" },
        { status: 403 }
      );
    }

    /* §purchase-request-org-axis (2026-08-30) — 소속 축.
     * 파생은 team 축, **판정은 organizationMember 축** (호영님 지시 2026-08-30).
     *   파생  organizationId = team.organizationId — 같은 행에서 오므로
     *         "teamId 와 organizationId 가 어긋난다" 가 정의상 불가능하다.
     *         런타임 검증을 추가하는 파생보다 검증할 것을 줄이는 파생이 낫다.
     *   판정  요청자가 그 조직의 organizationMember 인지 게이트.
     * 🛑 귀속 정확 != 행위 허용. team 멤버십만 보면 A 조직 멤버가 B 조직 산하 팀의
     *    teamId 로 남의 조직에 예산 요청을 만들 수 있다 — 귀속은 정확해지지만 그 행위
     *    자체가 막히지 않는다. (protocol/bom 격리 감사와 같은 축) */
    const team = await db.team.findUnique({
      where: { id: teamId },
      select: { organizationId: true },
    });
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }
    const orgMembership = await db.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId: team.organizationId,
        },
      },
      select: { id: true },
    });
    if (!orgMembership) {
      return NextResponse.json(
        { error: "Forbidden: Not a member of this organization" },
        { status: 403 }
      );
    }

    // MEMBER만 요청 가능 (OWNER/ADMIN은 직접 결제)
    if (teamMember.role === TeamRole.ADMIN || teamMember.role === TeamRole.ADMIN) {
      return NextResponse.json(
        { error: "OWNER and ADMIN cannot create purchase requests. Please checkout directly." },
        { status: 400 }
      );
    }

    // 구매 요청 생성
    const purchaseRequest = await db.purchaseRequest.create({
      data: {
        requesterId: session.user.id,
        organizationId: team.organizationId,
        teamId,
        title,
        message,
        items: items as any, // JSON 필드
        totalAmount: totalAmount || null,
        quoteId: quoteId || null,
        status: PurchaseRequestStatus.PENDING,
      },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    enforcement.complete({ organizationId: team.organizationId,
      beforeState: { teamId },
      afterState: { purchaseRequestId: purchaseRequest.id, status: purchaseRequest.status },
    });

    return NextResponse.json({ purchaseRequest }, { status: 201 });
  } catch (error) {
    enforcement?.fail();
    console.error("Error creating purchase request:", error);
    return NextResponse.json(
      { error: "Failed to create purchase request" },
      { status: 500 }
    );
  }
}

/**
 * 구매 요청 목록 조회
 * - MEMBER: 자신이 요청한 것만
 * - ADMIN/OWNER: 팀의 모든 요청
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId");
    const status = searchParams.get("status") as PurchaseRequestStatus | null;

    if (!teamId) {
      return NextResponse.json(
        { error: "Team ID is required" },
        { status: 400 }
      );
    }

    // 팀 멤버인지 확인
    const teamMember = await db.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId,
        },
      },
    });

    if (!teamMember) {
      return NextResponse.json(
        { error: "Forbidden: Not a member of this team" },
        { status: 403 }
      );
    }

    // 권한에 따라 필터링
    const where: any = { teamId };
    if (status) {
      where.status = status;
    }

    // MEMBER는 자신이 요청한 것만 조회
    if (teamMember.role === TeamRole.MEMBER) {
      where.requesterId = session.user.id;
    }
    // ADMIN/OWNER는 팀의 모든 요청 조회

    const purchaseRequests = await db.purchaseRequest.findMany({
      where,
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        approver: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ purchaseRequests });
  } catch (error) {
    console.error("Error fetching purchase requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch purchase requests" },
      { status: 500 }
    );
  }
}


