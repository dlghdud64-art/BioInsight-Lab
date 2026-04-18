import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";

const BillingInfoSchema = z.object({
  companyName: z.string().min(1, "회사명은 필수입니다"),
  businessNumber: z.string().optional(),
  representativeName: z.string().optional(),
  contactName: z.string().min(1, "담당자명은 필수입니다"),
  contactEmail: z.string().email("올바른 이메일 형식이 아닙니다"),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  taxInvoiceEmail: z.string().email().optional().or(z.literal("")),
  notes: z.string().optional(),
});

async function checkAdminOrOwner(userId: string, organizationId: string) {
  return db.organizationMember.findFirst({
    where: {
      userId,
      organizationId,
      role: { in: ["ADMIN", "OWNER"] },
    },
  });
}

// 청구 정보 조회
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

    const membership = await checkAdminOrOwner(session.user.id, id);
    if (!membership) {
      return NextResponse.json(
        { error: "플랜 변경 권한이 없습니다. 조직 관리자에게 문의하세요." },
        { status: 403 }
      );
    }

    const billingInfo = await db.billingInfo.findUnique({
      where: { organizationId: id },
    });

    // null 반환 (404 아님 — 아직 입력 안 한 상태)
    return NextResponse.json({ billingInfo });
  } catch (error: unknown) {
    console.error("[BillingInfo API] GET Error:", error);
    return NextResponse.json(
      { error: "청구 정보 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// 청구 정보 생성/수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'organization_update',
      targetEntityType: 'organization',
      targetEntityId: id,
      sourceSurface: 'organization-billing-api',
      routePath: '/api/organizations/[id]/billing-info',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const membership = await checkAdminOrOwner(session.user.id, id);
    if (!membership) {
      return NextResponse.json(
        { error: "플랜 변경 권한이 없습니다. 조직 관리자에게 문의하세요." },
        { status: 403 }
      );
    }

    // 조직 존재 확인
    const org = await db.organization.findUnique({ where: { id } });
    if (!org) {
      return NextResponse.json(
        { error: "조직을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = BillingInfoSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return NextResponse.json(
        { error: "청구 정보가 누락되었습니다. 필수 항목을 모두 입력해 주세요.", fieldErrors },
        { status: 400 }
      );
    }

    // taxInvoiceEmail이 빈 문자열이면 null로 변환
    const data = {
      ...parsed.data,
      taxInvoiceEmail: parsed.data.taxInvoiceEmail || null,
    };

    const billingInfo = await db.billingInfo.upsert({
      where: { organizationId: id },
      create: {
        organizationId: id,
        ...data,
      },
      update: data,
    });

    enforcement.complete({});

    return NextResponse.json({ billingInfo });
  } catch (error: unknown) {
    enforcement?.fail();
    console.error("[BillingInfo API] PUT Error:", error);
    return NextResponse.json(
      { error: "청구 정보 저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
