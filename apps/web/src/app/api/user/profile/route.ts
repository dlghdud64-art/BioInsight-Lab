import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";

/**
 * §11.69 #user-profile-settings-save-404
 * ──────────────────────────────────────────────────────────────────
 * /dashboard/settings 의 운영자 정보 저장이 404 (route 부재)로 실패하던
 * orphan caller 회귀 fix. caller (settings page L270/304) 는 처음부터
 * 이 endpoint 가정하고 호출했지만 route handler 부재 + Prisma User.phone
 * field 도 부재. 본 트랙: schema migration (User.phone) + endpoint 신규.
 *
 * Operations:
 *   GET  — 현재 세션 user 의 profile (name/email/phone/role/image) 반환
 *   PATCH — name/email/phone update. password 변경은 별도 보안 절차
 *           (운영 지원 센터)로 분리 — 본 endpoint 거부.
 *
 * Production migration 의존성:
 *   migrations/20260428120000_add_user_phone — `prisma migrate deploy`
 *   manual 적용 필요. 미적용 시 PATCH phone update 가 P2022 throw —
 *   본 endpoint 가 P2022 catch + 친절 message 로 안내.
 */

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        phone: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error: any) {
    console.error("[user/profile/GET] error:", error);
    // P2022: Unknown column — migration 미적용 (phone column 부재)
    if (error?.code === "P2022" && /phone/i.test(error?.message ?? "")) {
      return NextResponse.json(
        {
          error:
            "스키마 마이그레이션이 아직 적용되지 않았습니다. 운영 지원 센터로 문의하시면 phone 컬럼 추가 후 다시 시도하실 수 있습니다.",
          _debug: { code: "P2022", missing: "phone" },
        },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: "프로필 조회에 실패했습니다." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: "user_profile_update",
      targetEntityType: "user",
      targetEntityId: session.user.id,
      sourceSurface: "settings-page",
      routePath: "/api/user/profile",
    });
    if (!enforcement.allowed) return enforcement.deny();

    const body = await request.json().catch(() => ({}));
    const { name, email, phone, password } = body as {
      name?: string;
      email?: string;
      phone?: string;
      password?: string;
      currentPassword?: string;
    };

    // §11.69: password 변경은 본 endpoint scope 외 — 별도 보안 절차 (next track).
    // settings page profileMutation 가 password 도 PATCH 로 보내므로 명시적 거부.
    if (password !== undefined && password !== "") {
      enforcement.fail();
      return NextResponse.json(
        {
          error:
            "비밀번호 변경은 별도 보안 절차를 통해 진행됩니다. 운영 지원 센터로 문의해 주세요.",
        },
        { status: 400 },
      );
    }

    const updates: Record<string, string | null> = {};

    if (typeof name === "string" && name.trim()) {
      updates.name = name.trim();
    }

    if (typeof phone === "string") {
      // empty string → null (운영자가 phone 지움)
      updates.phone = phone.trim() || null;
    }

    // email change — unique check
    if (typeof email === "string" && email.trim() && email.trim() !== session.user.email) {
      const trimmed = email.trim();
      const existing = await db.user.findUnique({
        where: { email: trimmed },
        select: { id: true },
      });
      if (existing && existing.id !== session.user.id) {
        enforcement.fail();
        return NextResponse.json(
          { error: "이미 사용 중인 이메일입니다." },
          { status: 409 },
        );
      }
      updates.email = trimmed;
    }

    if (Object.keys(updates).length === 0) {
      enforcement.complete({
        beforeState: { action: "user_profile_update" },
        afterState: { noChange: true },
      });
      return NextResponse.json({ message: "변경 사항이 없습니다." });
    }

    const updated = await db.user.update({
      where: { id: session.user.id },
      data: updates,
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        phone: true,
      },
    });

    enforcement.complete({
      beforeState: { action: "user_profile_update" },
      afterState: { fields: Object.keys(updates) },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    enforcement?.fail();
    console.error("[user/profile/PATCH] error:", {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
    });

    // P2022: Unknown column — migration 미적용 (phone column 부재)
    if (error?.code === "P2022" && /phone/i.test(error?.message ?? "")) {
      return NextResponse.json(
        {
          error:
            "스키마 마이그레이션이 아직 적용되지 않았습니다. 운영 지원 센터로 문의하시면 phone 컬럼 추가 후 다시 시도하실 수 있습니다.",
          _debug: { code: "P2022", missing: "phone" },
        },
        { status: 500 },
      );
    }
    // P2002: Unique constraint (email)
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "이미 사용 중인 이메일입니다." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "프로필 업데이트에 실패했습니다." },
      { status: 500 },
    );
  }
}
