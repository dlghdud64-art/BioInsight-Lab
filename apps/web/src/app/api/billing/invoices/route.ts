/**
 * Invoices API - 청구 내역 조회
 *
 * GET: 청구 내역 목록 조회
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { resolveActiveOrganizationId } from "@/lib/organizations/active-org";

/* 🛑 `MOCK_INVOICES` 는 제거했다 (호영님 2026-09-07).
 *   이전 판본: "실제 데이터가 없으면 Mock 데이터 반환" —
 *   청구 내역이 0인 사용자에게 49,000원짜리 `PAID` 인보이스 3건을 보여줬다.
 *   `Invoice` 는 2026-09-07 까지 **전역 0행**이었으므로, 이 화면을 본 사람은 전부
 *   "147,000원 결제 완료" 라는 없는 사실을 봤다. 쓰기 경로에서 걷어낸 위조 PAID 와
 *   같은 병이고(§plan-change-claim), 이쪽은 **읽기 경로**였다.
 *   빈 목록이 사실이다 — 빈 화면이 거짓 숫자보다 낫다. */

// GET: 청구 내역 목록
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    /* 호출자는 `/billing` 과 `/dashboard/settings` 둘뿐이고 **둘 다 인증 게이트 안**이다
     * (§auth-page-gate). 비인증 데모 응답은 제품에서 도달 불가이면서
     * 직접 호출에는 지어낸 청구서를 내주는 자리였다. 401 이 사실이다. */
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    // §invite-flow Phase 2 — 첫 조직이 아니라 **활성 조직**의 청구 이력 (hint 우선).
    const activeOrganizationId = await resolveActiveOrganizationId({
      userId: session.user.id,
      hint: new URL(request.url).searchParams.get("organizationId"),
    });
    const membership = activeOrganizationId ? await db.organizationMember.findFirst({
      where: { userId: session.user.id, organizationId: activeOrganizationId },
      include: {
        organization: {
          include: {
            subscription: {
              include: {
                invoices: {
                  orderBy: { periodStart: "desc" },
                  take: 24, // 최근 2년치
                },
              },
            },
          },
        },
      },
    }) : null;

    const invoices = membership?.organization?.subscription?.invoices || [];

    return NextResponse.json({
      invoices,
      total: invoices.length,
    });
  } catch (error) {
    console.error("[Invoices API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}
