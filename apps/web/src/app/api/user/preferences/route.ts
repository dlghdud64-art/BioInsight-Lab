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

// §11.230c (a)-3 — quotes/page viewMode + sortState server-persist.
//   viewMode: §11.217 Phase 6 labaxis-quote-view-mode localStorage reuse.
//   sortState: §11.227 #9 (key SortKey | null + direction asc/desc) — localStorage 0 → server-only.
const QuotesViewSchema = z.object({
  mode: z.enum(["card", "table"]).optional(),
  sort: z
    .object({
      key: z
        .enum(["title", "status", "itemCount", "responseCount", "createdAt"])
        .nullable()
        .optional(),
      direction: z.enum(["asc", "desc"]).optional(),
    })
    .optional(),
});

// §11.230c (a)-4 — quotes/page statusFilter + modeChip server-persist.
//   URL search param 우선 (URL > server > default). searchQuery 는 ad-hoc 제외.
//   status: "all" | UserStatusLabel 자유 (정합은 page UI 가드).
//   modeChip: MODE_CHIPS key | null (mutually exclusive with statusFilter 변경).
const QuotesFilterSchema = z.object({
  status: z.string().max(50).optional(),
  modeChip: z.string().max(50).nullable().optional(),
});

// §11.230c (a)-5 — inventory page statusFilter server-persist.
//   URL `?filter` param 우선 (URL > server > default). locationFilter / categoryFilter / searchQuery / lotStatusFilter 제외.
const InventoryFilterSchema = z.object({
  status: z.string().max(50).optional(),
});

// §11.230c (a)-5 — receiving page activeTab server-persist.
//   ModuleBucketKey ("ready" | ... ) 자유 string (정합은 page UI 가드).
const ReceivingFilterSchema = z.object({
  activeTab: z.string().max(50).optional(),
});

// §11.230c (a)-6 — purchases page queueTab server-persist.
//   QueueTab ("all" | ConversionStatus) 자유 string (정합은 page UI 가드).
const PurchasesFilterSchema = z.object({
  queueTab: z.string().max(50).optional(),
});

// §11.230c (a)-6 — purchase-orders page activeTab server-persist.
//   ModuleBucketKey ("ready" | ... ) 자유 string (정합은 page UI 가드).
const PurchaseOrdersFilterSchema = z.object({
  activeTab: z.string().max(50).optional(),
});

const UserPreferencesPatchSchema = z.object({
  columnPrefs: z
    .object({
      quotes: ColumnPrefsSchema.optional(),
    })
    .optional(),
  // §11.230c (a)-2 — briefingCollapsed server-persist. §11.248e-2 localStorage
  // reuse + cross-device sync. boolean 단일 값.
  briefingCollapsed: z.boolean().optional(),
  // §11.230c (a)-3 — quotes view (viewMode + sortState) server-persist.
  quotesView: QuotesViewSchema.optional(),
  // §11.230c (a)-4 — quotes filter (statusFilter + modeChip) server-persist.
  quotesFilter: QuotesFilterSchema.optional(),
  // §11.230c (a)-5 — inventory page statusFilter server-persist.
  inventoryFilter: InventoryFilterSchema.optional(),
  // §11.230c (a)-5 — receiving page activeTab server-persist.
  receivingFilter: ReceivingFilterSchema.optional(),
  // §11.230c (a)-6 — purchases page queueTab server-persist.
  purchasesFilter: PurchasesFilterSchema.optional(),
  // §11.230c (a)-6 — purchase-orders page activeTab server-persist.
  purchaseOrdersFilter: PurchaseOrdersFilterSchema.optional(),
});

interface UserPreferencesJson {
  columnPrefs?: {
    quotes?: {
      widths?: Record<string, number>;
      visibility?: Record<string, boolean>;
      order?: string[];
    };
  };
  // §11.230c (a)-2 — briefingCollapsed nested key.
  briefingCollapsed?: boolean;
  // §11.230c (a)-3 — quotes view (viewMode + sortState) nested key.
  quotesView?: {
    mode?: "card" | "table";
    sort?: {
      key?: "title" | "status" | "itemCount" | "responseCount" | "createdAt" | null;
      direction?: "asc" | "desc";
    };
  };
  // §11.230c (a)-4 — quotes filter (statusFilter + modeChip) nested key.
  quotesFilter?: {
    status?: string;
    modeChip?: string | null;
  };
  // §11.230c (a)-5 — inventory page statusFilter nested key.
  inventoryFilter?: {
    status?: string;
  };
  // §11.230c (a)-5 — receiving page activeTab nested key.
  receivingFilter?: {
    activeTab?: string;
  };
  // §11.230c (a)-6 — purchases page queueTab nested key.
  purchasesFilter?: {
    queueTab?: string;
  };
  // §11.230c (a)-6 — purchase-orders page activeTab nested key.
  purchaseOrdersFilter?: {
    activeTab?: string;
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
      // §11.230c (a)-2 — briefingCollapsed override if present in patch.
      ...(validation.data.briefingCollapsed !== undefined
        ? { briefingCollapsed: validation.data.briefingCollapsed }
        : {}),
      // §11.230c (a)-3 — quotesView nested merge (mode + sort 부분 update).
      ...(validation.data.quotesView
        ? {
            quotesView: {
              ...(currentPrefs.quotesView ?? {}),
              ...(validation.data.quotesView.mode !== undefined
                ? { mode: validation.data.quotesView.mode }
                : {}),
              sort: {
                ...(currentPrefs.quotesView?.sort ?? {}),
                ...(validation.data.quotesView.sort ?? {}),
              },
            },
          }
        : {}),
      // §11.230c (a)-4 — quotesFilter nested merge (status + modeChip 부분 update).
      ...(validation.data.quotesFilter
        ? {
            quotesFilter: {
              ...(currentPrefs.quotesFilter ?? {}),
              ...(validation.data.quotesFilter.status !== undefined
                ? { status: validation.data.quotesFilter.status }
                : {}),
              ...(validation.data.quotesFilter.modeChip !== undefined
                ? { modeChip: validation.data.quotesFilter.modeChip }
                : {}),
            },
          }
        : {}),
      // §11.230c (a)-5 — inventoryFilter nested merge (status 부분 update).
      ...(validation.data.inventoryFilter
        ? {
            inventoryFilter: {
              ...(currentPrefs.inventoryFilter ?? {}),
              ...(validation.data.inventoryFilter.status !== undefined
                ? { status: validation.data.inventoryFilter.status }
                : {}),
            },
          }
        : {}),
      // §11.230c (a)-5 — receivingFilter nested merge (activeTab 부분 update).
      ...(validation.data.receivingFilter
        ? {
            receivingFilter: {
              ...(currentPrefs.receivingFilter ?? {}),
              ...(validation.data.receivingFilter.activeTab !== undefined
                ? { activeTab: validation.data.receivingFilter.activeTab }
                : {}),
            },
          }
        : {}),
      // §11.230c (a)-6 — purchasesFilter nested merge (queueTab 부분 update).
      ...(validation.data.purchasesFilter
        ? {
            purchasesFilter: {
              ...(currentPrefs.purchasesFilter ?? {}),
              ...(validation.data.purchasesFilter.queueTab !== undefined
                ? { queueTab: validation.data.purchasesFilter.queueTab }
                : {}),
            },
          }
        : {}),
      // §11.230c (a)-6 — purchaseOrdersFilter nested merge (activeTab 부분 update).
      ...(validation.data.purchaseOrdersFilter
        ? {
            purchaseOrdersFilter: {
              ...(currentPrefs.purchaseOrdersFilter ?? {}),
              ...(validation.data.purchaseOrdersFilter.activeTab !== undefined
                ? { activeTab: validation.data.purchaseOrdersFilter.activeTab }
                : {}),
            },
          }
        : {}),
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
