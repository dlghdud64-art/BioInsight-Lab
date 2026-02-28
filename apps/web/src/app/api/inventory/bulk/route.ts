import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// 입력 스키마
// ---------------------------------------------------------------------------

const bulkItemSchema = z.object({
  // 시약명 (Product 식별/생성에 사용)
  productName: z
    .string({ required_error: "productName은 필수입니다." })
    .min(1, "productName은 1자 이상이어야 합니다.")
    .max(500, "productName은 500자 이하여야 합니다.")
    .trim(),

  // 카탈로그 번호 (optional, 제품 중복 방지 키)
  catalogNumber: z.string().trim().optional(),

  // 현재 재고 수량
  currentQuantity: z
    .union([
      z.number({ required_error: "currentQuantity는 필수입니다." }),
      z
        .string()
        .regex(/^\d+(\.\d+)?$/, "currentQuantity는 숫자여야 합니다.")
        .transform((v) => parseFloat(v)),
    ])
    .pipe(z.number().nonnegative("수량은 0 이상이어야 합니다.")),

  // 단위 (기본값: ea)
  unit: z.string().trim().optional(),

  // 카테고리 (Product.category; 없으면 "REAGENT")
  category: z.string().trim().optional(),

  // 안전 재고
  safetyStock: z
    .union([
      z.number().nonnegative("safetyStock은 0 이상이어야 합니다."),
      z
        .string()
        .regex(/^\d+(\.\d+)?$/, "safetyStock은 숫자여야 합니다.")
        .transform((v) => parseFloat(v)),
    ])
    .pipe(z.number().nonnegative())
    .optional(),

  // 최소 주문 수량
  minOrderQty: z
    .union([
      z.number().nonnegative("minOrderQty는 0 이상이어야 합니다."),
      z
        .string()
        .regex(/^\d+(\.\d+)?$/, "minOrderQty는 숫자여야 합니다.")
        .transform((v) => parseFloat(v)),
    ])
    .pipe(z.number().nonnegative())
    .optional(),

  // 보관 위치
  location: z.string().trim().max(255).optional(),

  // 유통기한 (ISO 8601 날짜 문자열)
  expiryDate: z
    .string()
    .refine(
      (v) => !isNaN(Date.parse(v)),
      "expiryDate는 유효한 날짜 형식이어야 합니다."
    )
    .optional(),

  // 비고
  notes: z.string().trim().max(2000).optional(),
});

const bulkRequestSchema = z.object({
  organizationId: z
    .string({ required_error: "organizationId는 필수입니다." })
    .min(1, "organizationId는 필수입니다."),
  items: z
    .array(bulkItemSchema, { required_error: "items 배열은 필수입니다." })
    .min(1, "items는 1개 이상이어야 합니다.")
    .max(500, "한 번에 최대 500개까지 등록할 수 있습니다."),
});

// ---------------------------------------------------------------------------
// 유틸: 제품 upsert (카탈로그 번호 or 이름으로 조회, 없으면 생성)
// ---------------------------------------------------------------------------

async function resolveProductId(
  productName: string,
  catalogNumber?: string,
  category?: string
): Promise<string> {
  // 카탈로그 번호가 있으면 우선 검색
  if (catalogNumber) {
    const byCatalog = await db.product.findFirst({
      where: { catalogNumber: { equals: catalogNumber, mode: "insensitive" } },
      select: { id: true },
    });
    if (byCatalog) return byCatalog.id;
  }

  // 이름으로 검색
  const byName = await db.product.findFirst({
    where: { name: { equals: productName, mode: "insensitive" } },
    select: { id: true },
  });
  if (byName) return byName.id;

  // 신규 생성
  const created = await db.product.create({
    data: {
      name: productName,
      catalogNumber: catalogNumber ?? null,
      category: category ?? "REAGENT",
    },
    select: { id: true },
  });
  return created.id;
}

// ---------------------------------------------------------------------------
// POST /api/inventory/bulk
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // 1. 인증
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. JSON 파싱
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: "요청 본문이 유효한 JSON 형식이 아닙니다." },
        { status: 400 }
      );
    }

    // 3. 전체 요청 구조 검증
    const parsed = bulkRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "요청 데이터 유효성 검사에 실패했습니다.",
          details: parsed.error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 422 }
      );
    }

    const { organizationId, items } = parsed.data;

    // 4. 조직 멤버 권한 확인 (ADMIN만 대량 등록 허용)
    const membership = await db.organizationMember.findFirst({
      where: {
        organizationId,
        userId: session.user.id,
      },
      select: { role: true },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "해당 조직에 접근 권한이 없습니다." },
        { status: 403 }
      );
    }

    if (membership.role !== "ADMIN") {
      return NextResponse.json(
        { error: "대량 재고 등록은 조직 관리자(ADMIN)만 수행할 수 있습니다." },
        { status: 403 }
      );
    }

    // 5. 각 항목별 productId 사전 해결 (루프 - DB IO 최소화 불가 부분)
    //    createMany는 relations 생성 불가이므로 product 해결은 별도 수행
    const resolvedItems: Array<{
      productId: string;
      currentQuantity: number;
      unit: string;
      safetyStock: number | null;
      minOrderQty: number | null;
      location: string | null;
      expiryDate: Date | null;
      notes: string | null;
      organizationId: string;
    }> = [];

    // 행 단위 검증 오류 수집 (트랜잭션 롤백 없이 사전 체크)
    const itemErrors: Array<{ index: number; field: string; message: string }> = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // 개별 항목 productId 해결
      let productId: string;
      try {
        productId = await resolveProductId(
          item.productName,
          item.catalogNumber,
          item.category
        );
      } catch {
        itemErrors.push({
          index: i,
          field: "productName",
          message: `제품 처리 중 오류가 발생했습니다: ${item.productName}`,
        });
        continue;
      }

      // 같은 조직 + 제품으로 이미 존재하는 재고가 있으면 오류로 수집
      const duplicate = await db.productInventory.findFirst({
        where: { organizationId, productId },
        select: { id: true },
      });
      if (duplicate) {
        itemErrors.push({
          index: i,
          field: "productName",
          message: `이미 등록된 재고입니다: ${item.productName} (수정 기능을 이용해 주세요.)`,
        });
        continue;
      }

      resolvedItems.push({
        productId,
        currentQuantity: item.currentQuantity,
        unit: item.unit ?? "ea",
        safetyStock: item.safetyStock ?? null,
        minOrderQty: item.minOrderQty ?? null,
        location: item.location ?? null,
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
        notes: item.notes ?? null,
        organizationId,
      });
    }

    // 6. 검증 오류가 하나라도 있으면 전체 중단 (트랜잭션 롤백과 동일 효과)
    if (itemErrors.length > 0) {
      return NextResponse.json(
        {
          error: "일부 항목의 유효성 검사에 실패했습니다. 수정 후 다시 시도해 주세요.",
          details: itemErrors,
        },
        { status: 422 }
      );
    }

    // 7. 트랜잭션으로 createMany 실행
    const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.productInventory.createMany({
        data: resolvedItems,
        skipDuplicates: false, // 중복은 위 단계에서 이미 차단
      });
      return created;
    });

    // 8. 성공 응답
    return NextResponse.json(
      {
        message: `재고 ${result.count}개가 성공적으로 등록되었습니다.`,
        count: result.count,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[inventory/bulk] Error:", error);
    return NextResponse.json(
      { error: error?.message ?? "대량 재고 등록에 실패했습니다." },
      { status: 500 }
    );
  }
}
