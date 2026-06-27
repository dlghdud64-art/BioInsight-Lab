import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

/**
 * POST /api/leads — §pricing-launch-manual P3 (도입 신청 접수)
 *
 * 수동 결제 즉시 출시: Basic/Pro "도입 신청" → EnrollmentRequest(status=requested) 저장.
 * PG(포트원)는 트랙2 백로그. 결제수단 등록 0 — 회사·연락처·플랜·주기만. 인증 불필요(공개 폼).
 * 후속: 관리자 운영 화면에서 인보이스→입금 확인→canonical entitlement 부여.
 * (route path 는 /api/leads 유지 — 도입신청 리드. 클린업 시 /api/enrollments 로 rename 가능.)
 */
const enrollmentSchema = z.object({
  contactEmail: z.string().email(),
  company: z.string().max(120).optional(),
  contactName: z.string().max(80).optional(),
  contactPhone: z.string().max(40).optional(),
  planIntent: z.enum(["team", "business"]),
  billingCycle: z.enum(["monthly", "yearly"]),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = enrollmentSchema.parse(body);
    await db.enrollmentRequest.create({
      data: {
        contactEmail: data.contactEmail,
        company: data.company ?? null,
        contactName: data.contactName ?? null,
        contactPhone: data.contactPhone ?? null,
        planIntent: data.planIntent,
        billingCycle: data.billingCycle,
        status: "requested",
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "이메일·플랜·결제주기를 확인해 주세요." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "도입 신청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}
