import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TeamRole } from "@prisma/client";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { resolveOrganizationIdForMutation } from "@/lib/organizations/active-org";

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
      // §team-create-bootstrap — 생성은 team_create(부트스트랩 예외), 관리는 team_manage.
      action: 'team_create',
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
     *   ✅ 위 ⚠️ 예고가 실행됐다(§invite-flow Phase 2-5, 2026-09-02): "초대가 살아나면
     *      §org-scope-ambiguity 의 **선택의 거처**를 읽도록 바꿔야 한다" — 이제 그 거처
     *      (User.activeOrganizationId)를 읽는다. 활성값이 없으면 resolver 가 createdAt asc
     *      첫 멤버십으로 떨어져 옛 규칙과 같은 값이라 무변경 사용자 행동 변화는 0 이다.
     *
     * 조직이 0 이면 **거부한다.** 팀은 조직의 하위 단위이고, 예산·권한 회수가 모두
     * 조직을 전제한다. 조용히 standalone 을 만들면 3c(required)에서 다시 깨진다.
     */
    /* §invite-flow Phase 2-5 — 팀이 붙을 조직은 "가장 먼저 가입한 조직" 이 아니라 **활성 조직**.
     * 쓰기라 mutation resolver 를 쓴다. 이 라우트는 body 로 조직을 받지 않으므로 hint 는 없다
     * (팀 생성 요청은 이름·설명만 싣는다) — 조직 0 이면 아래 기존 거부 경로 그대로다. */
    const orgResolution = await resolveOrganizationIdForMutation({
      userId: session.user.id,
    });
    const membership = orgResolution.ok
      ? { organizationId: orgResolution.organizationId }
      : null;

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


