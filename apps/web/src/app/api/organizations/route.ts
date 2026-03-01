import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createOrganization, ORGANIZATION_TYPE_OPTIONS } from "@/lib/api/organizations";
import { z } from "zod";

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

    // userId로 소속된 OrganizationMember 조회 (organization + 멤버 수)
    const memberships = await db.organizationMember.findMany({
      where: { userId: session.user.id },
      include: {
        organization: {
          include: {
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // 소속 조직이 없는 경우(신규 가입자 등) → 빈 배열로 정상 200 응답
    if (memberships.length === 0) {
      return NextResponse.json({ organizations: [] });
    }

    // organization이 null인 경우(데이터 불일치) 필터링 후 role 병합
    const organizations = memberships
      .filter((m: any) => m.organization != null)
      .map((m: any) => ({
        ...m.organization,
        // 프론트엔드에서 org.members.length를 사용하므로 _count로 대체
        members: Array.from({ length: m.organization._count?.members ?? 0 }),
        role: m.role ?? "VIEWER",
      }));

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
  try {
    // 1. 사용자 확인
    const session = await auth();

    console.log("[Organizations API] POST Request - Session:", session ? "Exists" : "None");
    console.log("[Organizations API] User ID:", session?.user?.id);

    if (!session?.user?.id) {
      console.error("[Organizations API] Unauthorized - No user session");
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

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

    // 2. 요금제별 조직 생성 한도 체크 (Free/Starter: 1개, Basic: 3개, Pro 이상: 무제한)
    const existingMemberships = await db.organizationMember.findMany({
      where: { userId: session.user.id },
      include: {
        organization: {
          include: { subscription: true },
        },
      },
    });

    const currentOrgCount = existingMemberships.length;
    const plans = existingMemberships.map((m: any) =>
      (m.organization?.subscription?.plan as string | undefined) ?? "FREE"
    );
    const hasPro = plans.some((p: string) => p === "TEAM" || p === "ORGANIZATION");
    const hasBasic = !hasPro && plans.some((p: string) => p === "BASIC");
    const orgLimit = hasPro ? Infinity : hasBasic ? 3 : 1; // Free/Starter: 1개, Basic: 3개

    if (currentOrgCount >= orgLimit) {
      const planName = hasPro ? "Pro" : hasBasic ? "Basic" : "Free/Starter";
      const limitLabel = hasPro ? "무제한" : hasBasic ? "3개" : "1개";
      console.warn("[Organizations API] Plan limit exceeded:", { currentOrgCount, orgLimit, planName });
      return NextResponse.json(
        {
          error: `${planName} 요금제에서는 최대 ${limitLabel}의 조직만 생성할 수 있습니다. 더 많은 조직이 필요하다면 요금제를 업그레이드하세요.`,
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

    // 3. 성공 응답 반환
    return NextResponse.json({ organization }, { status: 201 });
  } catch (error: any) {
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
