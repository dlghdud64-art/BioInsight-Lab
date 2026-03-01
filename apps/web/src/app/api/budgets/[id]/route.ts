import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";

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

    // 접근 권한 확인
    const userScopeKey = `user-${session.user.id}`;
    if (budget.scopeKey !== userScopeKey) {
      const isOrgMember = await db.organizationMember.findFirst({
        where: { userId: session.user.id, organizationId: budget.scopeKey },
      });
      if (!isOrgMember) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const [year, month] = budget.yearMonth.split("-").map(Number);
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0, 23, 59, 59);

    // 사용액 계산 (조직 예산인 경우)
    let totalSpent = 0;
    if (!budget.scopeKey.startsWith("user-")) {
      const purchaseRecords = await db.purchaseRecord.findMany({
        where: {
          scopeKey: budget.scopeKey,
          purchasedAt: { gte: periodStart, lte: periodEnd },
        },
      });
      totalSpent = purchaseRecords.reduce(
        (sum: number, r: any) => sum + (r.amount || 0),
        0
      );
    }

    const usageRate = budget.amount > 0 ? (totalSpent / budget.amount) * 100 : 0;
    const remaining = budget.amount - totalSpent;

    // description에서 name, projectName 추출
    let name = `${budget.yearMonth} Budget`;
    let projectName: string | null = null;
    if (budget.description) {
      const nameMatch = budget.description.match(/^\[([^\]]+)\]/);
      if (nameMatch) name = nameMatch[1];
      const projectMatch = budget.description.match(/프로젝트: ([^|]+)/);
      if (projectMatch) projectName = projectMatch[1].trim();
    }

    return NextResponse.json({
      budget: {
        ...budget,
        name,
        projectName,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        usage: { totalSpent, usageRate, remaining },
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
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // ── 1. 예산 존재 여부 확인 ──────────────────────────────────────────────────
    const budget = await db.budget.findUnique({ where: { id } });
    if (!budget) {
      return NextResponse.json(
        { error: "예산을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // ── 2. 권한 확인 ──────────────────────────────────────────────────────────
    const userScopeKey = `user-${session.user.id}`;
    if (budget.scopeKey !== userScopeKey) {
      // 조직 예산: 해당 조직 멤버면 수정 가능 (VIEWER, REQUESTER, APPROVER, ADMIN 모두)
      const membership = await db.organizationMember.findFirst({
        where: {
          userId: session.user.id,
          organizationId: budget.scopeKey,
        },
      });
      if (!membership) {
        // 멤버가 아닌 경우에도 scopeKey가 다른 형식일 수 있음 → user-{id}로 재확인
        const altCheck = budget.scopeKey.startsWith("user-")
          ? budget.scopeKey === userScopeKey
          : false;
        if (!altCheck) {
          return NextResponse.json(
            { error: "해당 예산을 수정할 권한이 없습니다." },
            { status: 403 }
          );
        }
      }
    }
    // 개인 예산: scopeKey === userScopeKey 이면 본인만 가능 (위에서 이미 확인)

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

    // ── 6. description 합성 (name · projectName · description → 1개 컬럼) ──────
    // 기존 description에서 이름/프로젝트명 추출 (변경 없는 필드는 유지)
    let existingName: string | null = null;
    let existingProjectName: string | null = null;
    let existingDesc: string | null = null;
    if (budget.description) {
      const nameMatch = budget.description.match(/^\[([^\]]+)\]/);
      if (nameMatch) existingName = nameMatch[1];
      const projectMatch = budget.description.match(/프로젝트: ([^|]+)/);
      if (projectMatch) existingProjectName = projectMatch[1].trim();
      const parts = budget.description.split(" | ");
      const rawDesc = parts.find(
        (p: string) => !p.startsWith("[") && !p.startsWith("프로젝트: ")
      );
      existingDesc = rawDesc ?? null;
    }

    const finalName        = name !== undefined        ? name        : existingName;
    const finalProjectName = projectName !== undefined ? projectName : existingProjectName;
    const finalDesc        = description !== undefined ? description : existingDesc;

    const descParts: string[] = [];
    if (finalName)        descParts.push(`[${finalName}]`);
    if (finalProjectName) descParts.push(`프로젝트: ${finalProjectName}`);
    if (finalDesc)        descParts.push(finalDesc);
    const combinedDescription =
      descParts.length > 0 ? descParts.join(" | ") : budget.description;

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

    // ── 8. 응답 변환 ──────────────────────────────────────────────────────────
    const [updYear, updMonth] = updated.yearMonth.split("-").map(Number);
    return NextResponse.json({
      budget: {
        ...updated,
        name: finalName ?? `${updated.yearMonth} Budget`,
        projectName: finalProjectName,
        periodStart: new Date(updYear, updMonth - 1, 1).toISOString(),
        periodEnd: new Date(updYear, updMonth, 0, 23, 59, 59).toISOString(),
      },
    });
  } catch (error: any) {
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
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const budget = await db.budget.findUnique({
      where: { id },
    });

    if (!budget) {
      return NextResponse.json(
        { error: "Budget not found" },
        { status: 404 }
      );
    }

    // 권한 확인: scopeKey가 사용자 ID 기반이거나, 조직 멤버인 경우만 허용
    const userScopeKey = `user-${session.user.id}`;
    if (budget.scopeKey !== userScopeKey) {
      // 조직 예산인 경우 조직 멤버인지 확인
      const isOrgMember = await db.organizationMember.findFirst({
        where: {
          userId: session.user.id,
          organizationId: budget.scopeKey,
        },
      });

      if (!isOrgMember) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    await db.budget.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Budget API] Error deleting budget:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete budget" },
      { status: 500 }
    );
  }
}
