import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * §11.230c (a) #user-preferences-server-persist — 호영님 §11.230b 백로그 잔재.
 *
 * GET  /api/user/preferences — fetch user.preferences JSON.
 * PATCH /api/user/preferences — partial update (deep merge nested object).
 *
 * Strategy:
 *   - User.preferences Json? generic field — 후속 cluster 통합 정합.
 *   - GET = whole snapshot read.
 *   - PATCH = nested merge (e.g. { columnPrefs: { quotes: {...} } } 만 update,
 *     다른 nested key 보존).
 *   - localStorage backwards compat — server fetch 실패 시 client fallback.
 *
 * canonical truth lock:
 *   - User session-bound (auth.id only). 자신의 preferences 만.
 *   - admin 체크 없음 — 모든 인증 user 가 자신의 preferences 작업 가능.
 *   - schema = User.preferences Json?. shape: { columnPrefs?: { quotes?: ... } }.
 */

// 호영님 spec: column prefs widths/visibility/order. 9 column key 자유.
const ColumnPrefsSchema = z.object({
  widths: z.record(z.string(), z.number()).optional(),
  visibility: z.record(z.string(), z.boolean()).optional(),
  order: z.array(z.string()).optional(),
});

const UserPreferencesPatchSchema = z.object({
  columnPrefs: z
    .object({
      quotes: ColumnPrefsSchema.optional(),
    })
    .optional(),
});

interface UserPreferencesJson {
  columnPrefs?: {
    quotes?: {
      widths?: Record<string, number>;
      visibility?: Record<string, boolean>;
      order?: string[];
    };
  };
  [key: string]: unknown;
}

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    return NextResponse.json(
      { preferences: user?.preferences ?? null },
      { status: 200 },
    );
  } catch (error) {
    console.error("[user/preferences] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch preferences" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const validation = UserPreferencesPatchSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid preferences payload", details: validation.error.errors },
        { status: 400 },
      );
    }

    // §11.230c (a) — deep merge nested object 으로 partial update.
    //   기존 preferences 의 다른 nested key 보존.
    const existing = await db.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    const currentPrefs = (existing?.preferences ?? {}) as UserPreferencesJson;
    const patchedPrefs: UserPreferencesJson = {
      ...currentPrefs,
      columnPrefs: {
        ...(currentPrefs.columnPrefs ?? {}),
        ...(validation.data.columnPrefs ?? {}),
        quotes: {
          ...(currentPrefs.columnPrefs?.quotes ?? {}),
          ...(validation.data.columnPrefs?.quotes ?? {}),
        },
      },
    };

    const updated = await db.user.update({
      where: { id: session.user.id },
      data: { preferences: patchedPrefs as object },
      select: { preferences: true },
    });

    return NextResponse.json(
      { preferences: updated.preferences ?? null },
      { status: 200 },
    );
  } catch (error) {
    console.error("[user/preferences] PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 },
    );
  }
}
