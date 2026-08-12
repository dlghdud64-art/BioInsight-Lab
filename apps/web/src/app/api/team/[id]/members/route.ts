import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TeamRole } from "@prisma/client";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";

/**
 * 팀 멤버 목록 조회
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

    const { id: teamId } = await params;

    // 팀 멤버인지 확인 (Multi-tenancy isolation)
    const userMember = await db.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId,
        },
      },
    });

    if (!userMember) {
      return NextResponse.json(
        { error: "Forbidden: Not a member of this team" },
        { status: 403 }
      );
    }

    // 팀 멤버 목록 조회
    const members = await db.teamMember.findMany({
      where: { teamId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: [
        { role: "asc" }, // OWNER, ADMIN, MEMBER 순서
        { createdAt: "asc" },
      ],
    });

    return NextResponse.json({
      members: members.map((m: any) => ({
        id: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image,
        role: m.role,
        joinedAt: m.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching team members:", error);
    return NextResponse.json(
      { error: "Failed to fetch team members" },
      { status: 500 }
    );
  }
}

/**
 * 팀 멤버 역할 변경
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: teamId } = await params;
    const body = await request.json();
    const { memberId, role } = body;

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'team_manage',
      targetEntityType: 'team',
      targetEntityId: teamId,
      sourceSurface: 'team-api',
      routePath: '/api/team/[id]/members',
    });
    if (!enforcement.allowed) return enforcement.deny();

    // §enum-input-validation — `role` 은 TeamRole **enum** 이다. 검증 없이 넘기면
    //   Prisma 가 런타임에 거부해 사용자가 **원인 불명의 500** 을 본다.
    //   400 으로 바꾸고 허용 값을 함께 알린다(원인을 아는 것이 절반이다).
    if (role !== undefined && !Object.values(TeamRole).includes(role)) {
      return NextResponse.json(
        {
          error: `유효하지 않은 역할입니다. 가능한 역할: ${Object.values(TeamRole).join(", ")}`,
          code: "INVALID_TEAM_ROLE",
        },
        { status: 400 }
      );
    }

    if (!memberId || !role) {
      return NextResponse.json(
        { error: "memberId and role are required" },
        { status: 400 }
      );
    }

    // 권한 확인: ADMIN 또는 OWNER만 역할 변경 가능
    const userMember = await db.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId,
        },
      },
    });

    // ⚠️ 2026-08-10 — 기존 조건은 `!== ADMIN && !== ADMIN` 으로 **같은 값을 두 번** 봤다.
    //   TeamRole 에는 OWNER 가 없다(ADMIN | MEMBER | VIEWER). OWNER 자리가 ADMIN 으로
    //   치환된 흔적이며, 문구만 OWNER 를 말하고 있었다. 동작은 그대로 두고 중복과
    //   거짓 문구를 정리한다 — 사용자가 없는 역할을 근거로 거부당하면 안 된다.
    if (!userMember || userMember.role !== TeamRole.ADMIN) {
      return NextResponse.json(
        { error: "Forbidden: 팀 ADMIN 만 역할을 변경할 수 있습니다." },
        { status: 403 }
      );
    }

    // 대상 멤버 확인
    const targetMember = await db.teamMember.findUnique({
      where: { id: memberId },
    });

    if (!targetMember || targetMember.teamId !== teamId) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    /**
     * §team-org-role-model 작은 안 (호영님 승인 2026-08-12) — **자기 강등 허용**.
     *
     * 이전: 대상이 ADMIN 이면 무조건 400. 강등·제거·자진사퇴·팀 폐기가 전부 0 이라
     *   **되돌리는 방법이 DB 직접 수정뿐**이었다(실측 확정, PLAN §1-A). 고객사가 할 수
     *   없는 일이고 우리에게 지원 요청이 온다.
     *
     * 지금: **ADMIN 이 2명 이상일 때 자기 자신만** 강등할 수 있다.
     *   · 남의 ADMIN 강등은 계속 금지 — 기존 의도(ADMIN 끼리 서로 못 바꾼다) 보존
     *   · 마지막 ADMIN 강등은 계속 금지 — **주인 없는 팀이 더 나쁘다**
     *
     * ⚠️ 완화이지 해결이 아니다. **이미 퇴사한 사람은 로그인하지 않으므로 여전히 회수
     *   불가**다. 큰 안(조직 OWNER 권한)이 필요한 이유가 그것이다.
     */
    if (targetMember.role === TeamRole.ADMIN) {
      const isSelf = targetMember.userId === session.user.id;
      const adminCount = await db.teamMember.count({
        where: { teamId, role: TeamRole.ADMIN },
      });

      if (!isSelf) {
        return NextResponse.json(
          { error: "다른 관리자의 역할은 변경할 수 없습니다. 본인 역할만 변경할 수 있습니다." },
          { status: 400 }
        );
      }
      if (adminCount <= 1) {
        // 출구를 함께 알린다 — "변경할 수 없습니다" 만으로는 사용자가 다음 행동을 모른다.
        return NextResponse.json(
          {
            error: "마지막 관리자는 역할을 변경할 수 없습니다. 다른 관리자를 먼저 지정하세요.",
            code: "LAST_TEAM_ADMIN",
          },
          { status: 400 }
        );
      }
    }

    // 역할 업데이트
    const updatedMember = await db.teamMember.update({
      where: { id: memberId },
      data: { role: role as TeamRole },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    enforcement.complete({});
    return NextResponse.json({
      member: {
        id: updatedMember.id,
        userId: updatedMember.user.id,
        name: updatedMember.user.name,
        email: updatedMember.user.email,
        image: updatedMember.user.image,
        role: updatedMember.role,
        joinedAt: updatedMember.createdAt,
      },
    });
  } catch (error) {
    enforcement?.fail();
    console.error("Error updating team member role:", error);
    return NextResponse.json(
      { error: "Failed to update team member role" },
      { status: 500 }
    );
  }
}

/**
 * 팀 멤버 제거
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: teamId } = await params;
    const body = await request.json();
    const { memberId } = body;

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'team_manage',
      targetEntityType: 'team',
      targetEntityId: teamId,
      sourceSurface: 'team-api',
      routePath: '/api/team/[id]/members',
    });
    if (!enforcement.allowed) return enforcement.deny();

    if (!memberId) {
      return NextResponse.json(
        { error: "memberId is required" },
        { status: 400 }
      );
    }

    // 권한 확인: ADMIN 또는 OWNER만 멤버 제거 가능
    const userMember = await db.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId,
        },
      },
    });

    /**
     * §team-org-role-model 작은 안 — 중복 조건 정리 (2026-08-12).
     *   이전: `!== ADMIN && !== ADMIN` — **같은 값을 두 번** 봤다. PATCH 는 2026-08-10 에
     *   정리됐으나 DELETE 는 누락됐다. OWNER 자리가 ADMIN 으로 치환된 흔적이다.
     *   동작은 우연히 옳았다(ADMIN 만 통과) — **동작 불변으로** 중복만 제거한다.
     *   문구도 고친다: TeamRole 에 OWNER 는 없다(ADMIN | MEMBER | VIEWER).
     *   존재하지 않는 역할을 근거로 거부당하면 안 된다.
     */
    if (!userMember || userMember.role !== TeamRole.ADMIN) {
      return NextResponse.json(
        { error: "Forbidden: 팀 ADMIN 만 멤버를 제거할 수 있습니다." },
        { status: 403 }
      );
    }

    // 대상 멤버 확인
    const targetMember = await db.teamMember.findUnique({
      where: { id: memberId },
    });

    if (!targetMember || targetMember.teamId !== teamId) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    /**
     * §team-org-role-model 작은 안 — **자기 나가기 허용** (호영님 승인 2026-08-12).
     *   "나가기" 가 없으면 강등을 허용해도 여전히 갇힌다.
     *
     *   허용: 자기 자신 제거. 단 ADMIN 이면 **2명 이상일 때만**(마지막 ADMIN 금지).
     *   금지: 남의 ADMIN 제거 — PATCH 와 동일 규율.
     *
     *   문구 정정: 기존 "Cannot remove OWNER" 는 TeamRole 에 없는 역할을 근거로 들었다.
     */
    const isSelfRemoval = targetMember.userId === session.user.id;

    if (targetMember.role === TeamRole.ADMIN) {
      if (!isSelfRemoval) {
        return NextResponse.json(
          { error: "다른 관리자는 제거할 수 없습니다. 본인만 팀에서 나갈 수 있습니다." },
          { status: 400 }
        );
      }
      const adminCount = await db.teamMember.count({
        where: { teamId, role: TeamRole.ADMIN },
      });
      if (adminCount <= 1) {
        return NextResponse.json(
          {
            error: "마지막 관리자는 팀에서 나갈 수 없습니다. 다른 관리자를 먼저 지정하세요.",
            code: "LAST_TEAM_ADMIN",
          },
          { status: 400 }
        );
      }
    }

    // 멤버 제거
    await db.teamMember.delete({
      where: { id: memberId },
    });

    enforcement.complete({});
    return NextResponse.json({ success: true });
  } catch (error) {
    enforcement?.fail();
    console.error("Error removing team member:", error);
    return NextResponse.json(
      { error: "Failed to remove team member" },
      { status: 500 }
    );
  }
}


