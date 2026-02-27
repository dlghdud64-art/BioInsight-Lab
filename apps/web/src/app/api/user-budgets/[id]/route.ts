import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// ─── PATCH 요청 Zod 검증 스키마 ───────────────────────────────────────────────
const updateUserBudgetSchema = z
  .object({
    name: z
      .string()
      .min(1, "예산명은 1자 이상이어야 합니다.")
      .max(100, "예산명은 100자 이하여야 합니다.")
      .trim()
      .optional(),
    totalAmount: z
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
    fiscalYear: z
      .number()
      .int("회계연도는 정수여야 합니다.")
      .min(2000, "회계연도는 2000 이상이어야 합니다.")
      .max(2100, "회계연도는 2100 이하여야 합니다.")
      .nullable()
      .optional(),
    startDate: z
      .string()
      .optional()
      .nullable()
      .refine(
        (v) => !v || !isNaN(new Date(v).getTime()),
        "시작일 형식이 올바르지 않습니다."
      ),
    endDate: z
      .string()
      .optional()
      .nullable()
      .refine(
        (v) => !v || !isNaN(new Date(v).getTime()),
        "종료일 형식이 올바르지 않습니다."
      ),
    isActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    // startDate <= endDate 크로스 필드 검증
    if (data.startDate && data.endDate) {
      if (new Date(data.startDate) > new Date(data.endDate)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endDate"],
          message: "종료일은 시작일 이후여야 합니다.",
        });
      }
    }
  });

// ─── 권한 확인 헬퍼 ────────────────────────────────────────────────────────────
// 반환: "owner" | "org_admin" | "forbidden"
async function checkUserBudgetPermission(
  userId: string,
  budget: { userId: string; organizationId: string | null }
): Promise<"owner" | "org_admin" | "forbidden"> {
  // 본인 소유 예산
  if (budget.userId === userId) return "owner";

  // 조직 예산: ADMIN만 접근 허용
  if (budget.organizationId) {
    const adminMembership = await db.organizationMember.findFirst({
      where: {
        userId,
        organizationId: budget.organizationId,
        role: "ADMIN",
      },
    });
    if (adminMembership) return "org_admin";
  }

  return "forbidden";
}

// ─── GET /api/user-budgets/[id] ───────────────────────────────────────────────
// 단건 조회 + 잔여일 계산
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

    const budget = await db.userBudget.findUnique({
      where: { id },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!budget) {
      return NextResponse.json(
        { error: "예산을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const permission = await checkUserBudgetPermission(session.user.id, budget);
    if (permission === "forbidden") {
      return NextResponse.json(
        { error: "접근 권한이 없습니다." },
        { status: 403 }
      );
    }

    // 잔여일 계산
    let daysRemaining: number | null = null;
    if (budget.endDate) {
      const diffTime = new Date(budget.endDate).getTime() - Date.now();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    return NextResponse.json({ budget: { ...budget, daysRemaining } });
  } catch (error: any) {
    console.error("[UserBudget API] Error fetching budget:", error);
    return NextResponse.json(
      { error: error.message || "예산 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/user-budgets/[id] ────────────────────────────────────────────
// 예산 정보 수정
// - 본인 소유 예산: 본인만 수정 가능
// - 조직 예산: 해당 조직의 ADMIN만 수정 가능
// - totalAmount 변경 시 remainingAmount 자동 재계산
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
    const budget = await db.userBudget.findUnique({ where: { id } });
    if (!budget) {
      return NextResponse.json(
        { error: "예산을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // ── 2. 권한 확인 ──────────────────────────────────────────────────────────
    const permission = await checkUserBudgetPermission(session.user.id, budget);
    if (permission === "forbidden") {
      return NextResponse.json(
        { error: "해당 예산을 수정할 권한이 없습니다." },
        { status: 403 }
      );
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
    const parsed = updateUserBudgetSchema.safeParse(rawBody);
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

    const { name, totalAmount, currency, fiscalYear, startDate, endDate, isActive } =
      parsed.data;

    // ── 5. remainingAmount 재계산 (totalAmount 변경 시) ───────────────────────
    let remainingAmount = budget.remainingAmount;
    if (totalAmount !== undefined) {
      // 잔액 = 새 총예산 - 기존 사용액 (음수 방지)
      remainingAmount = Math.max(0, totalAmount - budget.usedAmount);
    }

    // ── 6. DB 업데이트 ────────────────────────────────────────────────────────
    const updated = await db.userBudget.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(totalAmount !== undefined && { totalAmount, remainingAmount }),
        ...(currency !== undefined && { currency }),
        ...(fiscalYear !== undefined && { fiscalYear }),
        ...(startDate !== undefined && {
          startDate: startDate ? new Date(startDate) : null,
        }),
        ...(endDate !== undefined && {
          endDate: endDate ? new Date(endDate) : null,
        }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    // 잔여일 계산
    let daysRemaining: number | null = null;
    if (updated.endDate) {
      const diffTime = new Date(updated.endDate).getTime() - Date.now();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    return NextResponse.json({ budget: { ...updated, daysRemaining } });
  } catch (error: any) {
    console.error("[UserBudget API] Error updating budget:", error);
    return NextResponse.json(
      { error: error.message || "예산 수정에 실패했습니다." },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/user-budgets/[id] ───────────────────────────────────────────
// 예산 삭제 (soft delete: isActive=false 처리)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const budget = await db.userBudget.findUnique({ where: { id } });
    if (!budget) {
      return NextResponse.json(
        { error: "예산을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const permission = await checkUserBudgetPermission(session.user.id, budget);
    if (permission === "forbidden") {
      return NextResponse.json(
        { error: "해당 예산을 삭제할 권한이 없습니다." },
        { status: 403 }
      );
    }

    // 소프트 삭제 (isActive=false) — 거래 내역 보존
    await db.userBudget.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[UserBudget API] Error deleting budget:", error);
    return NextResponse.json(
      { error: error.message || "예산 삭제에 실패했습니다." },
      { status: 500 }
    );
  }
}
