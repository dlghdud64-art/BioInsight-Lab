import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { resolveBudgetPurchaseScopeKeys } from "@/lib/budget/purchase-scope-keys";
import { resolveBudgetPeriod } from "@/lib/budget/budget-period";
import {
  activeReservedAmount,
  ORDER_RESERVED,
  ORDER_RELEASED,
  ORDER_CONFIRMED,
} from "@/lib/budget/order-reservation";
import { deriveBudgetDetail, seoulToday, ORDER_STATUS_LABEL } from "@/lib/budget/budget-detail-derive";
import { z } from "zod";
import { OrganizationRole } from "@prisma/client";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";

// OWNER/ADMIN 여부 확인 헬퍼
async function isOrgAdminOrOwner(userId: string, organizationId: string): Promise<boolean> {
  const membership = await db.organizationMember.findFirst({
    where: { userId, organizationId },
    select: { role: true },
  });
  if (!membership) return false;
  return (
    membership.role === OrganizationRole.OWNER ||
    membership.role === OrganizationRole.ADMIN
  );
}

// ─── PATCH 요청 Zod 검증 스키마 ───────────────────────────────────────────────
const updateBudgetSchema = z
  .object({
    name: z
      .string()
      .min(1, "예산명은 1자 이상이어야 합니다.")
      .max(100, "예산명은 100자 이하여야 합니다.")
      .trim()
      .optional(),
    amount: z
      .union([
        z.number(),
        z.string().regex(/^\d+(\.\d+)?$/, "금액은 숫자여야 합니다."),
      ])
      .transform((v) => Math.round(Number(v)))
      .pipe(z.number().positive("금액은 0보다 커야 합니다."))
      .optional(),
    currency: z
      .enum(["KRW", "USD", "EUR", "JPY", "CNY"], {
        errorMap: () => ({ message: "지원하지 않는 통화 코드입니다." }),
      })
      .optional(),
    periodStart: z
      .string()
      .optional()
      .refine(
        (v) => !v || !isNaN(new Date(v).getTime()),
        "시작일 형식이 올바르지 않습니다."
      ),
    periodEnd: z
      .string()
      .optional()
      .refine(
        (v) => !v || !isNaN(new Date(v).getTime()),
        "종료일 형식이 올바르지 않습니다."
      ),
    projectName: z
      .string()
      .max(200, "프로젝트명은 200자 이하여야 합니다.")
      .trim()
      .nullable()
      .optional(),
    description: z
      .string()
      .max(1000, "설명은 1000자 이하여야 합니다.")
      .trim()
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    // periodStart <= periodEnd 크로스 필드 검증
    if (data.periodStart && data.periodEnd) {
      if (new Date(data.periodStart) > new Date(data.periodEnd)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["periodEnd"],
          message: "종료일은 시작일 이후여야 합니다.",
        });
      }
    }
  });

// 예산 단건 조회
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const budget = await db.budget.findUnique({ where: { id } });

    if (!budget) {
      return NextResponse.json({ error: "Budget not found" }, { status: 404 });
    }

    // 접근 권한 확인 (organizationId FK 우선, 레거시는 scopeKey 기반)
    const userScopeKey = `user-${session.user.id}`;
    if (budget.scopeKey !== userScopeKey) {
      // organizationId가 있으면 그걸로 멤버십 확인, 없으면 scopeKey로 fallback
      const orgId = budget.organizationId ?? budget.scopeKey;
      const isOrgMember = await db.organizationMember.findFirst({
        where: { userId: session.user.id, organizationId: orgId },
      });
      if (!isOrgMember) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // ⑤ 배선 (P3) — usage 합산 창을 표시 기간과 같은 truth 로: description 명시
    // period 우선, 없으면 yearMonth 월 창 (resolveBudgetPeriod 단일화).
    const { periodStart, periodEnd, endCalendarDate, startCalendarDate } = resolveBudgetPeriod(budget);

    // 집행 — PurchaseRecord (조직 예산인 경우)
    type PurchaseRow = {
      id: string;
      amount: number;
      vendorName: string;
      itemName: string;
      qty: number;
      purchasedAt: Date;
      quoteId: string | null;
    };
    let purchaseRecords: PurchaseRow[] = [];
    if (!budget.scopeKey.startsWith("user-")) {
      // §budget-scope-key-mismatch — 같은 테넌트의 workspace 구매도 함께 집계.
      const purchaseScopeKeys = await resolveBudgetPurchaseScopeKeys(budget);
      purchaseRecords = await db.purchaseRecord.findMany({
        where: {
          scopeKey: { in: purchaseScopeKeys },
          purchasedAt: { gte: periodStart, lte: periodEnd },
        },
        select: { id: true, amount: true, vendorName: true, itemName: true, qty: true, purchasedAt: true, quoteId: true },
        orderBy: { purchasedAt: "desc" },
      });
    }
    const totalSpent = purchaseRecords.reduce((sum, r) => sum + (r.amount || 0), 0);

    // 예약 — BudgetEvent 원장. /api/orders 가 잔액 판정에 쓰는 것과 **같은 원장 · 같은 함수**다.
    //   🛑 §budget-detail-redesign — 구 화면은 예약을 상수 0 으로 두고 사용률을 계산했다.
    type OrderEventRow = { eventType: string; amount: number; sourceEntityId: string; executedAt: Date };
    const orderEvents: OrderEventRow[] = await db.budgetEvent.findMany({
      where: {
        budgetId: budget.id,
        eventType: { in: [ORDER_RESERVED, ORDER_RELEASED, ORDER_CONFIRMED] },
      },
      select: { eventType: true, amount: true, sourceEntityId: true, executedAt: true },
    });
    const reserved = activeReservedAmount(orderEvents);
    // 주문별 활성 예약 — 같은 함수를 주문 단위로 적용한다(상쇄 규칙을 다시 쓰지 않는다).
    const eventsByOrder = new Map<string, OrderEventRow[]>();
    for (const ev of orderEvents) {
      const list = eventsByOrder.get(ev.sourceEntityId) ?? [];
      list.push(ev);
      eventsByOrder.set(ev.sourceEntityId, list);
    }
    const activeOrders = [...eventsByOrder.entries()]
      .map(([orderId, evs]) => ({
        orderId,
        amount: activeReservedAmount(evs),
        reservedAt: evs.filter((e) => e.eventType === ORDER_RESERVED).map((e) => e.executedAt).sort((x, y) => y.getTime() - x.getTime())[0] ?? null,
      }))
      .filter((o) => o.amount > 0);
    type OrderRow = {
      id: string;
      orderNumber: string;
      quoteId: string;
      status: string;
      expectedDelivery: Date | null;
      vendor: { name: string } | null;
    };
    const orders: OrderRow[] = activeOrders.length
      ? await db.order.findMany({
          where: { id: { in: activeOrders.map((o) => o.orderId) } },
          select: {
            id: true,
            orderNumber: true,
            quoteId: true,
            status: true,
            expectedDelivery: true,
            vendor: { select: { name: true } },
          },
        })
      : [];
    const orderById = new Map<string, OrderRow>(orders.map((o) => [o.id, o]));

    const seoulYmd = (d: Date) => {
      const t = seoulToday(d);
      return `${t.y}-${String(t.m).padStart(2, "0")}-${String(t.d).padStart(2, "0")}`;
    };

    // 연결된 활동 — 화면은 이 목록을 그리기만 한다. 단계 문구·다음 전이도 여기서 정한다(영문 enum 노출 0).
    const activities = [
      ...activeOrders.map((o) => {
        const order = orderById.get(o.orderId);
        return {
          id: `order:${o.orderId}`,
          stage: "reserved" as const,
          domain: "발주",
          title: order?.orderNumber ?? "발주",
          mono: true,
          href: order?.quoteId ? `/quotes/${order.quoteId}` : null,
          meta: [
            order?.vendor?.name ?? null,
            order ? ORDER_STATUS_LABEL[order.status] ?? null : null,
            order?.expectedDelivery ? `입고 예정 ${seoulYmd(order.expectedDelivery)}` : null,
          ].filter((x): x is string => !!x),
          date: o.reservedAt ? seoulYmd(o.reservedAt) : null,
          nextTransition: "구매 완료 시 집행",
          amount: o.amount,
        };
      }),
      ...purchaseRecords.map((r) => ({
        id: `purchase:${r.id}`,
        stage: "actual" as const,
        domain: "구매",
        title: r.qty > 1 ? `${r.itemName} ${r.qty}개` : r.itemName,
        mono: false,
        href: r.quoteId ? `/quotes/${r.quoteId}` : null,
        meta: [r.vendorName].filter((x): x is string => !!x),
        date: seoulYmd(r.purchasedAt),
        nextTransition: "완료",
        amount: r.amount || 0,
      })),
    ].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

    const control = deriveBudgetDetail({
      amount: budget.amount,
      reserved,
      actual: totalSpent,
      startDate: startCalendarDate,
      endDate: endCalendarDate,
      today: seoulToday(new Date()),
    });

    const usageRate = budget.amount > 0 ? (totalSpent / budget.amount) * 100 : 0;
    const remaining = budget.amount - totalSpent;

    // description에서 name, projectName, 정확한 period 날짜 추출
    let name = `${budget.yearMonth} Budget`;
    let projectName: string | null = null;
    let note: string | null = null;
    let parsedPeriodStart: Date | null = null;
    let parsedPeriodEnd: Date | null = null;
    if (budget.description) {
      const nameMatch = budget.description.match(/^\[([^\]]+)\]/);
      if (nameMatch) name = nameMatch[1];
      const projectMatch = budget.description.match(/프로젝트: ([^|]+)/);
      if (projectMatch) projectName = projectMatch[1].trim().replace(/\|.*$/, "").trim();
      const periodMatchGet = budget.description.match(/period:(\d{4}-\d{2}-\d{2})~(\d{4}-\d{2}-\d{2})/);
      if (periodMatchGet) {
        parsedPeriodStart = new Date(periodMatchGet[1]);
        parsedPeriodEnd = new Date(periodMatchGet[2] + "T23:59:59");
      }
      // §budget-detail-redesign — 사용자가 쓴 설명만 떼어 낸다. 화면에 원시 합성 문자열(`[…] | period:…`)을 내리지 않는다.
      //   분해 규칙은 PATCH 의 existingDesc 와 같다.
      note =
        budget.description
          .split(" | ")
          .find((p: string) => !p.startsWith("[") && !p.startsWith("프로젝트: ") && !p.startsWith("period:")) ?? null;
    }

    // 🛑 §budget-detail-redesign — 원시 description 은 내리지 않는다(스프레드에서 제외).
    const budgetColumns = { ...budget, description: undefined };

    return NextResponse.json({
      budget: {
        ...budgetColumns,
        name,
        projectName,
        note,
        periodStart: (parsedPeriodStart ?? periodStart).toISOString(),
        periodEnd: (parsedPeriodEnd ?? periodEnd).toISOString(),
        // 🛑 §budget-period-axis — 화면이 표시에 쓸 **달력 날짜**(YYYY-MM-DD).
        //   위 ISO 를 화면에서 `new Date(...).toLocaleDateString()` 하면 하루가 밀린다:
        //   periodEnd 는 로컬 23:59:59 로 만들어져 UTC 로 굳고, KST 에서 다음 날로 읽힌다.
        //   실측 2026-09-22: 원문 12-30 인 예산이 상세 화면에 `2026. 12. 31.` 로 떴다.
        //   대시보드는 이미 이 값(endCalendarDate)을 쓴다 — 두 화면을 같은 축에 올린다.
        periodEndDate: endCalendarDate,
        periodStartDate: startCalendarDate,
        usage: { totalSpent, usageRate, remaining },
        // §budget-detail-redesign — 예약·집행·판정은 서버가 정한다. 화면은 그리기만 한다.
        ledger: {
          reserved,
          actual: totalSpent,
          reservedCount: activeOrders.length,
          actualCount: purchaseRecords.length,
        },
        control,
        activities,
      },
    });
  } catch (error: any) {
    console.error("[Budget API] Error fetching budget:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch budget" },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/budgets/[id] ─────────────────────────────────────────────────
// 예산 수정 (Zod 검증 + 권한 분기: 개인 예산=본인, 조직 예산=ADMIN)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // ── Security enforcement ──
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'budget_update',
      targetEntityType: 'budget',
      targetEntityId: id,
      sourceSurface: 'budget-update-api',
      routePath: '/api/budgets/[id]',
    });
    if (!enforcement.allowed) return enforcement.deny();

    // ── 1. 예산 존재 여부 확인 ──────────────────────────────────────────────────
    const budget = await db.budget.findUnique({ where: { id } });
    if (!budget) {
      return NextResponse.json(
        { error: "예산을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // ── 2. 권한 확인 (RBAC: 조직 예산은 OWNER/ADMIN만 수정 가능) ─────────────
    const userScopeKey = `user-${session.user.id}`;
    const isPersonalBudget = budget.scopeKey === userScopeKey;

    if (!isPersonalBudget) {
      // 조직 예산: OWNER 또는 ADMIN만 수정 가능
      const orgId = budget.organizationId ?? budget.scopeKey; // organizationId 우선, 레거시는 scopeKey
      const canEdit = await isOrgAdminOrOwner(session.user.id, orgId);
      if (!canEdit) {
        return NextResponse.json(
          { error: "예산 수정 권한이 없습니다. 조직의 Owner 또는 Admin만 예산을 수정할 수 있습니다." },
          { status: 403 }
        );
      }
    } else if (budget.scopeKey !== userScopeKey) {
      // 개인 예산인데 본인이 아닌 경우 (비정상)
      return NextResponse.json({ error: "해당 예산을 수정할 권한이 없습니다." }, { status: 403 });
    }

    // ── 3. 요청 바디 파싱 ──────────────────────────────────────────────────────
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: "요청 본문이 올바른 JSON 형식이 아닙니다." },
        { status: 400 }
      );
    }

    // ── 4. Zod 검증 ────────────────────────────────────────────────────────────
    const parsed = updateBudgetSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "입력값이 올바르지 않습니다.",
          details: parsed.error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 422 }
      );
    }

    const { name, amount, currency, periodStart, periodEnd, projectName, description } = parsed.data;

    // ── 5. yearMonth 갱신 (periodStart 변경 시) ────────────────────────────────
    let yearMonth = budget.yearMonth;
    if (periodStart) {
      const startDate = new Date(periodStart);
      yearMonth = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}`;
    }

    // ── 6. description 합성 (name · projectName · period · description → 1개 컬럼) ──────
    // 기존 description에서 이름/프로젝트명/기간/설명 추출 (변경 없는 필드는 유지)
    let existingName: string | null = null;
    let existingProjectName: string | null = null;
    let existingDesc: string | null = null;
    let existingPeriodStart: string | null = null;
    let existingPeriodEnd: string | null = null;
    if (budget.description) {
      const nameMatch = budget.description.match(/^\[([^\]]+)\]/);
      if (nameMatch) existingName = nameMatch[1];
      const projectMatch = budget.description.match(/프로젝트: ([^|]+)/);
      if (projectMatch) existingProjectName = projectMatch[1].trim().replace(/\|.*$/, "").trim();
      const periodMatch = budget.description.match(/period:(\d{4}-\d{2}-\d{2})~(\d{4}-\d{2}-\d{2})/);
      if (periodMatch) {
        existingPeriodStart = periodMatch[1];
        existingPeriodEnd = periodMatch[2];
      }
      const parts = budget.description.split(" | ");
      const rawDesc = parts.find(
        (p: string) => !p.startsWith("[") && !p.startsWith("프로젝트: ") && !p.startsWith("period:")
      );
      existingDesc = rawDesc ?? null;
    }

    const finalName        = name !== undefined        ? name        : existingName;
    const finalProjectName = projectName !== undefined ? projectName : existingProjectName;
    const finalDesc        = description !== undefined ? description : existingDesc;

    // 기간: 요청에서 받은 값 우선, 없으면 기존 저장값, 없으면 yearMonth 파생
    const [updYear, updMonth] = yearMonth.split("-").map(Number);
    const finalPeriodStart = periodStart ?? existingPeriodStart ?? `${yearMonth}-01`;
    const lastDayNum = new Date(updYear, updMonth, 0).getDate();
    const finalPeriodEnd = periodEnd ?? existingPeriodEnd ?? `${yearMonth}-${String(lastDayNum).padStart(2, "0")}`;

    const descParts: string[] = [];
    if (finalName)        descParts.push(`[${finalName}]`);
    if (finalProjectName) descParts.push(`프로젝트: ${finalProjectName}`);
    descParts.push(`period:${finalPeriodStart}~${finalPeriodEnd}`);
    if (finalDesc)        descParts.push(finalDesc);
    const combinedDescription = descParts.join(" | ");

    // ── 7. DB 업데이트 ────────────────────────────────────────────────────────
    const updated = await db.budget.update({
      where: { id },
      data: {
        yearMonth,
        ...(amount !== undefined && { amount }),
        currency: currency ?? budget.currency,
        description: combinedDescription,
      },
    });

    // 캐시 무효화: 예산 및 대시보드 페이지 즉시 갱신
    revalidatePath("/dashboard/budget");
    revalidatePath("/dashboard");

    // ── 8. 응답 변환 ──────────────────────────────────────────────────────────
    enforcement.complete({ organizationId: budget.organizationId ?? null,
      beforeState: { budgetId: budget.id, amount: budget.amount },
      afterState: { budgetId: updated.id, amount: updated.amount },
    });

    return NextResponse.json({
      budget: {
        ...updated,
        name: finalName ?? `${updated.yearMonth} Budget`,
        projectName: finalProjectName,
        periodStart: new Date(finalPeriodStart).toISOString(),
        periodEnd: new Date(finalPeriodEnd + "T23:59:59").toISOString(),
      },
    });
  } catch (error: any) {
    enforcement?.fail();
    console.error("[Budget API] Error updating budget:", error);
    return NextResponse.json(
      { error: error.message || "예산 수정에 실패했습니다." },
      { status: 500 }
    );
  }
}

// 예산 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // ── Security enforcement ──
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'budget_delete',
      targetEntityType: 'budget',
      targetEntityId: id,
      sourceSurface: 'budget-delete-api',
      routePath: '/api/budgets/[id]',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const budget = await db.budget.findUnique({
      where: { id },
    });

    if (!budget) {
      return NextResponse.json(
        { error: "Budget not found" },
        { status: 404 }
      );
    }

    // 권한 확인 (RBAC: 조직 예산은 OWNER/ADMIN만 삭제 가능)
    const userScopeKey = `user-${session.user.id}`;
    if (budget.scopeKey !== userScopeKey) {
      const orgId = budget.organizationId ?? budget.scopeKey;
      const canDelete = await isOrgAdminOrOwner(session.user.id, orgId);
      if (!canDelete) {
        return NextResponse.json(
          { error: "예산 삭제 권한이 없습니다. 조직의 Owner 또는 Admin만 예산을 삭제할 수 있습니다." },
          { status: 403 }
        );
      }
    }

    // 🛑 §budget-detail-redesign (핸드오프 §4) — 활성 발주 예약이 걸린 예산은 지우지 않는다.
    //   BudgetEvent.budgetId 에는 FK 가 없다(원장 보존 우선). 지우면 예약이 **가리킬 예산 없이** 남고,
    //   그 주문이 구매 완료돼도 소멸시킬 대상이 사라진다. 화면도 같은 판정으로 삭제를 막지만 서버가 정본이다.
    const reservationEvents = await db.budgetEvent.findMany({
      where: {
        budgetId: budget.id,
        eventType: { in: [ORDER_RESERVED, ORDER_RELEASED, ORDER_CONFIRMED] },
      },
      select: { eventType: true, amount: true, sourceEntityId: true },
    });
    if (activeReservedAmount(reservationEvents) > 0) {
      return enforcement.reject(409, {
        error: "발주 예약이 걸려 있는 예산은 삭제할 수 없습니다. 예약이 구매 완료되거나 해제된 뒤 삭제할 수 있습니다.",
      });
    }

    await db.budget.delete({
      where: { id },
    });

    enforcement.complete({ organizationId: budget.organizationId ?? null,
      beforeState: { budgetId: budget.id },
      afterState: undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    enforcement?.fail();
    console.error("[Budget API] Error deleting budget:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete budget" },
      { status: 500 }
    );
  }
}
