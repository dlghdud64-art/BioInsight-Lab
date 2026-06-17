/**
 * POST /api/support/inquiry
 *
 * 퍼블릭 문의 인입 API — 로그인 불필요.
 * ContactInquiry 레코드를 생성하고 referenceId를 반환한다.
 *
 * 운영 티켓이 아니라 리드/문의 인입 폼.
 * dead button / placeholder / no-op 금지 원칙에 따라 실제 DB에 저장한다.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/sender";

const VALID_INQUIRY_TYPES = ["service", "pricing", "sourcing", "account"];

// §support-inquiry-mail — inquiryType → 사람이 읽는 라벨(메일 제목/본문용).
const INQUIRY_TYPE_LABEL: Record<string, string> = {
  service: "서비스·도입",
  pricing: "가격·플랜",
  sourcing: "제품·소싱",
  account: "계정·기타",
};

// 운영 수신함(Zoho). 알림 메일 수신처. 문의자 회신은 reply-to 로 분리.
const SUPPORT_INBOX = "support@labaxis.co.kr";

/** 메일 본문에 사용자 입력을 넣기 전 HTML 이스케이프(인젝션·깨짐 방지). */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 참조번호 생성: INQ-YYYYMMDD-XXXX
 * 사용자에게 노출되는 식별자. DB unique 제약으로 중복 방지.
 */
function generateReferenceId(): string {
  const now = new Date();
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INQ-${datePart}-${randomPart}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ── Validation ──
    const { inquiryType, name, email, message } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "이름 또는 기관명을 입력해 주세요." },
        { status: 400 },
      );
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "올바른 이메일 주소를 입력해 주세요." },
        { status: 400 },
      );
    }

    if (!message || typeof message !== "string" || message.trim().length < 10) {
      return NextResponse.json(
        { error: "문의 내용을 10자 이상 입력해 주세요." },
        { status: 400 },
      );
    }

    const resolvedType =
      inquiryType && VALID_INQUIRY_TYPES.includes(inquiryType)
        ? inquiryType
        : "service";

    // ── Rate limiting (simple: same email, 5분 이내 중복 차단) ──
    const recentInquiry = await db.contactInquiry.findFirst({
      where: {
        email: email.trim().toLowerCase(),
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
      select: { id: true },
    });

    if (recentInquiry) {
      return NextResponse.json(
        { error: "잠시 후 다시 시도해 주세요. 동일 이메일로 5분 이내 중복 문의는 제한됩니다." },
        { status: 429 },
      );
    }

    // ── Create ContactInquiry ──
    const referenceId = generateReferenceId();

    const inquiry = await db.contactInquiry.create({
      data: {
        referenceId,
        inquiryType: resolvedType,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        message: message.trim(),
        ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null,
        userAgent: request.headers.get("user-agent") ?? null,
      },
      select: {
        referenceId: true,
        createdAt: true,
      },
    });

    // ── 알림 메일 2건(best-effort) ──
    // §support-inquiry-mail — DB 인입은 이미 성공(진짜). 메일은 best-effort 알림이므로
    //   실패해도 접수를 막지 않는다(throw 금지, console.error 만). front-only success 해소:
    //   ① 운영 알림(support@, 회신은 문의자에게)  ② 문의자 접수확인(회신은 support@).
    //   from=noreply@labaxis.co.kr(루트 verified, sender 기본값). 정직성: 실시간 SLA 약속 금지.
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanMessage = message.trim();
    const typeLabel = INQUIRY_TYPE_LABEL[resolvedType] ?? "서비스·도입";
    try {
      // ① 운영 알림 — to=support@, replyTo=문의자(회신 시 바로 문의자에게 전달).
      await sendEmail({
        to: SUPPORT_INBOX,
        replyTo: cleanEmail,
        subject: `[LabAxis] 도입문의 · ${typeLabel} — ${cleanName} (${referenceId})`,
        html: `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.7;color:#0f172a">
  <p style="margin:0 0 12px"><strong>새 도입·문의가 접수되었습니다.</strong></p>
  <table style="border-collapse:collapse;font-size:14px">
    <tr><td style="padding:4px 12px 4px 0;color:#64748b">참조번호</td><td><strong>${esc(referenceId)}</strong></td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#64748b">유형</td><td>${esc(typeLabel)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#64748b">이름·기관</td><td>${esc(cleanName)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#64748b">이메일</td><td>${esc(cleanEmail)}</td></tr>
  </table>
  <p style="margin:14px 0 4px;color:#64748b">문의 내용</p>
  <p style="margin:0;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;white-space:pre-wrap">${esc(cleanMessage)}</p>
  <p style="margin:14px 0 0;color:#94a3b8;font-size:12px">이 메일에 회신하면 문의자(${esc(cleanEmail)})에게 바로 전달됩니다.</p>
</div>`,
        text:
          `새 도입·문의\n\n참조번호: ${referenceId}\n유형: ${typeLabel}\n이름·기관: ${cleanName}\n이메일: ${cleanEmail}\n\n문의 내용:\n${cleanMessage}\n\n이 메일에 회신하면 문의자에게 바로 전달됩니다.`,
      });
    } catch (mailError) {
      console.error("[support/inquiry] 운영 알림 메일 발송 실패(접수는 정상):", mailError);
    }
    try {
      // ② 문의자 접수확인 — to=문의자, replyTo=support@(문의자가 회신하면 운영 수신함으로).
      await sendEmail({
        to: cleanEmail,
        replyTo: SUPPORT_INBOX,
        subject: `[LabAxis] 문의가 접수되었습니다 (${referenceId})`,
        html: `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.7;color:#0f172a">
  <p style="margin:0 0 12px"><strong>${esc(cleanName)}</strong>님, 문의가 정상 접수되었습니다.</p>
  <p style="margin:0 0 12px">담당자가 내용을 확인한 뒤, <strong>영업일 기준 1일 이내</strong>에 등록하신 이메일로 회신드리겠습니다.</p>
  <table style="border-collapse:collapse;font-size:14px;margin:0 0 12px">
    <tr><td style="padding:4px 12px 4px 0;color:#64748b">참조번호</td><td><strong>${esc(referenceId)}</strong></td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#64748b">유형</td><td>${esc(typeLabel)}</td></tr>
  </table>
  <p style="margin:14px 0 0;color:#94a3b8;font-size:12px">본 메일은 발신 전용이 아니며, 회신하시면 담당자에게 전달됩니다. LabAxis</p>
</div>`,
        text:
          `${cleanName}님, 문의가 정상 접수되었습니다.\n\n담당자가 내용을 확인한 뒤, 영업일 기준 1일 이내에 등록하신 이메일로 회신드리겠습니다.\n\n참조번호: ${referenceId}\n유형: ${typeLabel}\n\n회신하시면 담당자에게 전달됩니다. — LabAxis`,
      });
    } catch (mailError) {
      console.error("[support/inquiry] 문의자 접수확인 메일 발송 실패(접수는 정상):", mailError);
    }

    return NextResponse.json({
      success: true,
      referenceId: inquiry.referenceId,
      createdAt: inquiry.createdAt,
      message: "문의가 접수되었습니다. 영업일 기준 1일 이내 등록하신 이메일로 안내드립니다.",
    });
  } catch (error: any) {
    // referenceId unique 충돌 시 재시도 (극히 드물지만)
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "일시적 오류가 발생했습니다. 다시 시도해 주세요." },
        { status: 409 },
      );
    }

    // ── 스키마 드리프트 탐지 (운영 관측성) ──
    // Supabase DROP SCHEMA 후 Vercel Redeploy 누락 등으로
    // Prisma client 와 DB 상태가 어긋나면 여기로 떨어진다.
    // 500 으로 뭉뚱그리지 않고 명시적으로 로깅해서 원인을 즉시 식별 가능하게.
    if (error?.code === "P2021") {
      console.error(
        "[support/inquiry][P2021] FATAL schema drift: table missing in DB. Run `prisma migrate deploy` or redeploy Vercel.",
        { code: error.code, meta: error.meta, message: error.message },
      );
      return NextResponse.json(
        { error: "서비스 점검 중입니다. 잠시 후 다시 시도해 주세요." },
        { status: 503 },
      );
    }
    if (error?.code === "P2022") {
      console.error(
        "[support/inquiry][P2022] FATAL schema drift: column missing in DB. Check schema.prisma vs production DB.",
        { code: error.code, meta: error.meta, message: error.message },
      );
      return NextResponse.json(
        { error: "서비스 점검 중입니다. 잠시 후 다시 시도해 주세요." },
        { status: 503 },
      );
    }

    console.error("[support/inquiry] Error:", error);
    return NextResponse.json(
      { error: "문의 접수 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}
