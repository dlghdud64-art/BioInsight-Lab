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

const VALID_INQUIRY_TYPES = ["service", "pricing", "sourcing", "account"];

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

    console.error("[support/inquiry] Error:", error);
    return NextResponse.json(
      { error: "문의 접수 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}
