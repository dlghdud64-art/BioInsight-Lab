/**
 * Invoices API - 청구 내역 조회
 *
 * GET: 청구 내역 목록 조회
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 데모용 Mock 인보이스 데이터
const MOCK_INVOICES = [
  {
    id: "inv_demo_1",
    number: "INV-2024-12-001",
    status: "PAID",
    amountDue: 49000,
    amountPaid: 49000,
    currency: "KRW",
    periodStart: new Date("2024-12-01").toISOString(),
    periodEnd: new Date("2024-12-31").toISOString(),
    paidAt: new Date("2024-12-01").toISOString(),
    description: "팀 플랜 구독 (12월)",
    invoicePdfUrl: null,
  },
  {
    id: "inv_demo_2",
    number: "INV-2024-11-001",
    status: "PAID",
    amountDue: 49000,
    amountPaid: 49000,
    currency: "KRW",
    periodStart: new Date("2024-11-01").toISOString(),
    periodEnd: new Date("2024-11-30").toISOString(),
    paidAt: new Date("2024-11-01").toISOString(),
    description: "팀 플랜 구독 (11월)",
    invoicePdfUrl: null,
  },
  {
    id: "inv_demo_3",
    number: "INV-2024-10-001",
    status: "PAID",
    amountDue: 49000,
    amountPaid: 49000,
    currency: "KRW",
    periodStart: new Date("2024-10-01").toISOString(),
    periodEnd: new Date("2024-10-31").toISOString(),
    paidAt: new Date("2024-10-02").toISOString(),
    description: "팀 플랜 구독 (10월)",
    invoicePdfUrl: null,
  },
];

// GET: 청구 내역 목록
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    // 데모 모드: 세션이 없어도 Mock 데이터 반환
    if (!session?.user?.id) {
      return NextResponse.json({
        invoices: MOCK_INVOICES,
        total: MOCK_INVOICES.length,
      });
    }

    const membership = await db.organizationMember.findFirst({
      where: { userId: session.user.id },
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
    });

    const invoices = membership?.organization?.subscription?.invoices || [];

    // 실제 데이터가 없으면 Mock 데이터 반환
    if (invoices.length === 0) {
      return NextResponse.json({
        invoices: MOCK_INVOICES,
        total: MOCK_INVOICES.length,
      });
    }

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
