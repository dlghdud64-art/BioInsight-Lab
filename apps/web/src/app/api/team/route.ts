import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TeamRole } from "@prisma/client";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";

/**
 * 팀 목록 조회 및 팀 생성
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // 사용자가 속한 팀 조회
    const teamMembers = await db.teamMember.findMany({
      where: { userId },
      include: {
        team: {
          include: {
            members: {
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
            },
          },
        },
      },
    });

    const teams = teamMembers.map((tm: any) => ({
      id: tm.team.id,
      name: tm.team.name,
      description: tm.team.description,
      role: tm.role,
      members: tm.team.members.map((m: any) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image,
        role: m.role,
      })),
      createdAt: tm.team.createdAt,
    }));

    return NextResponse.json({ teams });
  } catch (error) {
    console.error("Error fetching teams:", error);
    return NextResponse.json(
      { error: "Failed to fetch teams" },
      { status: 500 }
    );
  }
}

/**
 * 팀 생성
 */
export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description } = body;

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'team_manage',
      targetEntityType: 'team',
      targetEntityId: 'new',
      sourceSurface: 'team-api',
      routePath: '/api/team',
    });
    if (!enforcement.allowed) return enforcement.deny();

    if (!name) {
      return NextResponse.json(
        { error: "Team name is required" },
        { status: 400 }
      );
    }

    /**
     * §team-org-role-model 3b — 팀의 **소속 조직을 기록한다** (2026-08-12).
     *
     * 이전: `organizationId` 를 아예 채우지 않았다. 그래서 API 로 만든 팀은 전부
     *   standalone(null) 이었고, 그 결과 **팀 예산이 구조적으로 죽어 있었다** —
     *   `api/budgets/route.ts` 가 `{ id: teamId, organizationId }` 일치를 요구하므로
     *   standalone 팀은 예산에 연결될 수 없다(조용한 실패: teamId 만 사라진다).
     *
     * 도출은 **자동**이다 — 조직 선택 UI 를 만들지 않는다(3b 실측 판정).
     *   초대 경로가 끊겨 있어(§onboarding-blocker #7) **다중 소속이 도달 불가**이고,
     *   3a 로 모든 사용자가 조직을 최소 1개 갖는다. 즉 후보가 실질적으로 1개다.
     *   ⚠️ 초대가 살아나면 이 도출은 §org-scope-ambiguity 의 "선택의 거처" 를 읽도록
     *      바꿔야 한다. 그때까지는 `orgs[0]` 이 아니라 **가장 먼저 가입한 조직**으로
     *      결정론적으로 고른다(정렬 없는 findFirst 를 새로 만들지 않는다).
     *
     * 조직이 0 이면 **거부한다.** 팀은 조직의 하위 단위이고, 예산·권한 회수가 모두
     * 조직을 전제한다. 조용히 standalone 을 만들면 3c(required)에서 다시 깨진다.
     */
    const membership = await db.organizationMember.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
      select: { organizationId: true },
    });

    if (!membership) {
      enforcement.fail();
      return NextResponse.json(
        {
          error: "소속 조직이 없어 팀을 만들 수 없습니다. 조직을 먼저 만들어 주세요.",
          code: "NO_ORGANIZATION",
        },
        { status: 400 }
      );
    }

    // 팀 생성 및 생성자를 OWNER로 추가
    const team = await db.team.create({
      data: {
        name,
        description,
        organizationId: membership.organizationId,
        members: {
          create: {
            userId: session.user.id,
            role: TeamRole.ADMIN,
          },
        },
      },
      include: {
        members: {
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
        },
      },
    });

    enforcement.complete({});
    return NextResponse.json({ team }, { status: 201 });
  } catch (error) {
    enforcement?.fail();
    console.error("Error creating team:", error);
    return NextResponse.json(
      { error: "Failed to create team" },
      { status: 500 }
    );
  }
}


