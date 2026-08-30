import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createOrganization, ORGANIZATION_TYPE_OPTIONS } from "@/lib/api/organizations";
import { z } from "zod";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { SubscriptionPlan, PLAN_ORDER, getPlanDisplayName, getPlanLimits } from "@/lib/plans";

const createOrganizationSchema = z.object({
  name: z.string().min(1, "조직 이름을 입력해주세요.").max(200),
  description: z.string().max(1000).optional().nullable(),
  organizationType: z
    .string()
    .max(100)
    .optional()
    .nullable()
    .refine(
      (v) => !v || ORGANIZATION_TYPE_OPTIONS.includes(v as (typeof ORGANIZATION_TYPE_OPTIONS)[number]),
      "유효하지 않은 조직 유형입니다."
    ),
});

// 사용자가 소속된 조직 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 조직 + 멤버 요약 정보 포함 쿼리
    // invites / subscription relation 이 DB 에 없을 수 있으므로
    // members 만 include 하고 나머지는 방어적 처리
    let memberships: any[];
    try {
      memberships = await db.organizationMember.findMany({
        where: { userId: session.user.id },
        include: {
          organization: {
            include: {
              members: {
                select: { id: true, role: true },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });
    } catch (queryErr: any) {
      console.error("[organizations/GET] Prisma query error:", queryErr?.message);
      // 테이블 자체가 없는 경우 빈 배열 반환
      return NextResponse.json({ organizations: [] });
    }

    // 소속 조직이 없는 경우(신규 가입자 등) → 빈 배열로 정상 200 응답
    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ organizations: [] });
    }

    // organization이 null인 경우 필터링 후 role 병합 + 멤버 요약
    // §11.193d Phase 2.3 — workflowCapabilities 도 forward (settings UI multi-badge).
    //   resolver (resolveWorkflowCapabilities) 는 caller side 에서 호출 — DB
    //   값이 빈 배열이면 role 기반 fallback 자동 발동.
    const organizations = memberships
      .filter((m: any) => m.organization != null)
      .map((m: any) => {
        const org = m.organization;
        const allMembers = org.members || [];
        const adminCount = allMembers.filter(
          (mem: any) => mem.role === "ADMIN" || mem.role === "OWNER"
        ).length;
        return {
          ...org,
          members: allMembers,
          memberCount: allMembers.length,
          adminCount,
          pendingCount: 0,
          role: m.role ?? "VIEWER",
          // §11.193d Phase 2.3 — Json column raw value forward.
          //   client 의 resolveWorkflowCapabilities 가 Json 파싱 + role fallback 처리.
          workflowCapabilities: m.workflowCapabilities ?? [],
        };
      });

    return NextResponse.json({ organizations });
  } catch (error: any) {
    console.error("[organizations/GET] Error:", {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    });
    return NextResponse.json(
      {
        error: "조직 목록을 불러오지 못했습니다.",
        _debug: { message: error?.message, code: error?.code },
      },
      { status: 500 }
    );
  }
}

// 새 조직 생성 (RLS 권한 문제 해결)
export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    // 1. 사용자 확인
    const session = await auth();

    console.log("[Organizations API] POST Request - Session:", session ? "Exists" : "None");
    console.log("[Organizations API] User ID:", session?.user?.id);

    if (!session?.user?.id) {
      console.error("[Organizations API] Unauthorized - No user session");
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    // 조직 생성은 로그인한 모든 사용자에게 허용 — DB 초기화 직후
    // 아직 조직/역할이 없는 신규 사용자도 첫 조직을 만들 수 있어야 한다.
    // enforceAction 의 organization_update 는 기존 조직 수정용이므로
    // 생성(POST)에서는 인증만 확인하고 enforcement 를 건너뛴다.
    // 플랜 한도 체크 (아래)가 실질적인 gate 역할.

    const body = await request.json();
    console.log("[Organizations API] Request Body:", JSON.stringify(body, null, 2));

    const parsed = createOrganizationSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.flatten().fieldErrors;
      const msg = firstError.name?.[0] ?? firstError.organizationType?.[0] ?? "입력값을 확인해주세요.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { name, description, organizationType } = parsed.data;
    const trimmedName = name.trim();
    const trimmedDescription = description?.trim() || undefined;
    const trimmedOrgType = organizationType?.trim() || undefined;

    // 2. 요금제별 조직 생성 한도 체크 — §org-create-limit B1b (호영님 판정 2026-08-29)
    //
    // 이전 결함 (2026-08-24 등재 · 겹 1·2 + 축 오염):
    //   · findMany 가 organization 을 include 하지 않아 plan 을 볼 수단 자체가 없었고
    //     map(() => "FREE") 가 전원 FREE 로 취급했다 → 유료 고객도 상한 1.
    //   · hasPro 가 TEAM 을 삼켰다. Pro 는 ORGANIZATION 하나뿐인데 TEAM(Basic)까지
    //     무제한으로 보냈다 — plan 을 읽는 순간 조용히 틀린 답을 내는 쪽이 이것이다.
    //   · hasBasic 이 보던 "BASIC" 은 enum 에 없어(FREE·TEAM·ORGANIZATION) 영원히 false.
    //     둘이 맞물려 3 rung 을 양쪽에서 봉쇄했다.
    //   · 판정 축이 사용자 전체 멤버십이라 남의 조직 상태가 내 한도를 바꿨다:
    //     분자(plan 파생)는 남의 유료 조직이 내 상한을 올리고(entitlement 유출),
    //     분모(계수)는 초대받은 조직이 내 생성 한도를 깎았다.
    //
    // 지금: OWNER(생성자) 멤버십만 계수하고 plan 도 거기서만 파생한다 — 조직 축.
    //   초대 멤버십은 분자에도 분모에도 들어가지 않는다.
    //   ⚠️ OWNER 배선은 §team-org-role-model Phase 2(2026-08-12) 이후다. 그 이전 생성분은
    //     ADMIN 이라 이 필터에 안 잡힌다(= 한도가 느슨해진다).
    //   🛑 prod 인스턴스 1 (T1) — 2026-08-30 소급 대조로 판명.
    //     원 실측(2026-08-29 "OWNER 4 · ADMIN 0 · OWNER 0인 조직 0행 — 해당 인스턴스
    //     없음")은 **tvkl 테스트 DB 오측**이었다. 실 prod(xhid)는 ADMIN 1 · OWNER 0인
    //     조직 2 였고, T1 의 유일 멤버가 06-22 생성분 ADMIN 이라 이 필터에 안 잡혔다.
    //     → FREE 한도 1인데 currentOrgCount 가 0으로 세어져 2번째 조직 생성이 열려 있었다.
    //     오측 이력을 지우지 않는다 — §2b 사례 5 의 현장이다(축은 대상 DB. 두 DB 의
    //     마이그레이션 이력이 같아 이력으로는 안 갈렸다).
    //   🔑 계수는 OWNER-only 를 유지한다. ADMIN 을 포함하도록 넓히면 B1b 가 닫은 초대
    //     오염(남의 조직 ADMIN 초대가 내 한도에 계수)이 되돌아온다 — 축은 맞고 데이터가
    //     틀렸다. 데이터 정정(T1 ADMIN → OWNER 승격)으로 닫고, 재발은 /api/health 의
    //     ownerlessCount 불변식이 런타임에서 감시한다.
    let ownedMemberships: { organization: { plan: SubscriptionPlan } | null }[] = [];
    try {
      ownedMemberships = await db.organizationMember.findMany({
        where: { userId: session.user.id, role: "OWNER" },
        select: { organization: { select: { plan: true } } },
      });
    } catch {
      // 테이블 없는 경우 무시 — 신규 DB
    }

    const currentOrgCount = ownedMemberships.length;

    // 내가 소유한 조직 중 최고 등급이 내 한도를 정한다 (원 의도 유지 · 축만 교정).
    // plan 이 없거나 enum 밖 값이면 FREE 로 떨어뜨린다 — 모르는 값을 올려주지 않는다.
    const effectivePlan = ownedMemberships.reduce<SubscriptionPlan>(
      (best: SubscriptionPlan, m: { organization: { plan: SubscriptionPlan } | null }) => {
        const p = m.organization?.plan;
        if (!p || !(p in PLAN_ORDER)) return best;
        return PLAN_ORDER[p] > PLAN_ORDER[best] ? p : best;
      },
      SubscriptionPlan.FREE
    );

    // §org-create-limit B2 — 한도 정본은 PLAN_LIMITS 다. 이 파일에 인라인 상수를 두지
    //   않는다(세 번째 진실 소멸). null = 무제한.
    const orgLimit = getPlanLimits(effectivePlan).maxOrganizations;

    if (orgLimit !== null && currentOrgCount >= orgLimit) {
      // 라벨은 같은 Record 계열에서 파생한다 — 응답 error 문구가 그대로 토스트에 뜬다
      // (dashboard/organizations/page.tsx 의 실패 토스트). 끊으면 표시 회귀다.
      const planName = getPlanDisplayName(effectivePlan);
      console.warn("[Organizations API] Plan limit exceeded:", {
        currentOrgCount,
        orgLimit,
        planName,
      });
      return NextResponse.json(
        {
          error: `${planName} 요금제에서는 최대 ${orgLimit}개의 조직만 생성할 수 있습니다. 더 많은 조직이 필요하다면 요금제를 업그레이드하세요.`,
          code: "PLAN_LIMIT_EXCEEDED",
        },
        { status: 403 }
      );
    }

    console.log("[Organizations API] Creating organization with data:", {
      userId: session.user.id,
      name: trimmedName,
      description: trimmedDescription,
      organizationType: trimmedOrgType,
    });

    // 3. 조직 생성 및 멤버 등록 (트랜잭션으로 처리)
    const organization = await createOrganization(session.user.id, {
      name: trimmedName,
      description: trimmedDescription,
      organizationType: trimmedOrgType,
    });

    console.log("[Organizations API] Organization created successfully:", organization.id);

    // enforcement 는 조직 생성에서 사용하지 않음 (위 주석 참고)

    // 3. 성공 응답 반환
    return NextResponse.json({ organization }, { status: 201 });
  } catch (error: any) {
    // enforcement 미사용 (조직 생성은 인증 + 플랜 한도만 체크)
    console.error("[Organizations API] ========== ERROR START ==========");
    console.error("[Organizations API] Error Type:", typeof error);
    console.error("[Organizations API] Error Object:", error);
    if (error instanceof Error) {
      console.error("[Organizations API] Error Message:", error.message);
      console.error("[Organizations API] Error Stack:", error.stack);
    }
    console.error("[Organizations API] ========== ERROR END ==========");

    // Prisma 에러 처리
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as { code: string; meta?: any };

      console.error("[Organizations API] Prisma Error Code:", prismaError.code);
      console.error("[Organizations API] Prisma Error Meta:", prismaError.meta);

      if (prismaError.code === 'P2002') {
        return NextResponse.json(
          {
            error: "이미 존재하는 조직 이름입니다.",
            code: prismaError.code
          },
          { status: 409 }
        );
      }

      if (prismaError.code === 'P2003') {
        return NextResponse.json(
          {
            error: "연결된 데이터를 찾을 수 없습니다. 사용자 정보를 확인해주세요.",
            code: prismaError.code,
            meta: prismaError.meta
          },
          { status: 400 }
        );
      }

      // 기타 Prisma 에러
      return NextResponse.json(
        {
          error: "데이터베이스 작업 중 오류가 발생했습니다.",
          details: prismaError.code,
          meta: prismaError.meta
        },
        { status: 500 }
      );
    }

    // 일반 에러 처리
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류";
    const errorStack = error instanceof Error ? error.stack : undefined;

    return NextResponse.json(
      {
        error: "조직 생성에 실패했습니다.",
        details: errorMessage,
        stack: process.env.NODE_ENV === "development" ? errorStack : undefined,
        hint: "입력한 데이터를 확인하고 다시 시도해주세요. 문제가 계속되면 관리자에게 문의하세요."
      },
      { status: 500 }
    );
  }
}
