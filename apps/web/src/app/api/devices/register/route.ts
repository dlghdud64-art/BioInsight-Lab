/**
 * #mobile-push-notification Phase 1 server — POST /api/devices/register
 *
 * mobile (Expo) 가 registerForPushNotifications 후 호출. 동일 pushToken 은
 * upsert (last seen update — 동일 device 재실행 시 token 재등록).
 *
 * Lock:
 *   - auth (인증된 사용자만)
 *   - zod validation (pushToken required)
 *   - upsert by pushToken (unique constraint) — userId 변경 시 device 재할당
 *   - platform optional ("ios" / "android" / "web", default "unknown")
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const registerDeviceSchema = z.object({
  pushToken: z.string().min(1).max(500),
  platform: z.enum(["ios", "android", "web"]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = registerDeviceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const { pushToken, platform } = parsed.data;

    // upsert by pushToken — 동일 token 재등록 시 userId/platform 갱신
    const device = await db.device.upsert({
      where: { pushToken },
      create: {
        userId: session.user.id,
        pushToken,
        platform: platform ?? "unknown",
      },
      update: {
        userId: session.user.id,
        platform: platform ?? "unknown",
      },
    });

    return NextResponse.json({ device: { id: device.id } }, { status: 200 });
  } catch (error) {
    console.error("[/api/devices/register] error:", error);
    return NextResponse.json(
      { error: "Failed to register device" },
      { status: 500 },
    );
  }
}
