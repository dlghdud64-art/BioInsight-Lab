import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { sendEmail } from "@/lib/email/sender";

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

    // §pricing-launch-manual (b) — 영업 알림(best-effort, 실패해도 신청은 성공: non-blocking).
    try {
      const opsTo =
        process.env.ENROLLMENT_NOTIFY_EMAIL ||
        process.env.EMAIL_FROM ||
        "support@labaxis.co.kr";
      const planLabel = data.planIntent === "business" ? "Pro" : "Basic";
      const cycleLabel = data.billingCycle === "yearly" ? "연간" : "월간";
      const lines = [
        `새 도입 신청이 접수되었습니다.`,
        `플랜: ${planLabel} (${cycleLabel})`,
        `회사·기관: ${data.company ?? "-"}`,
        `담당자: ${data.contactName ?? "-"}`,
        `이메일: ${data.contactEmail}`,
        `연락처: ${data.contactPhone ?? "-"}`,
      ];
      await sendEmail({
        to: opsTo,
        subject: `[도입 신청] ${planLabel} · ${data.company ?? data.contactEmail}`,
        text: lines.join("\n"),
        html: lines.join("<br/>"),
      });
    } catch (e) {
      console.error("[leads] 영업 알림 발송 실패(non-blocking):", e);
    }

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
