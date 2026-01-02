import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// =====================================================
// 스키마 정의 (Type Safety)
// =====================================================

// PATCH 요청 바디 검증 스키마
const updateSchema = z.object({
  location: z.string().min(1).max(100).optional(),
  quantity: z.number().int().min(0).optional(),
  status: z.enum(["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"]).optional(),
  notes: z.string().max(1000).optional().nullable(),
});

// =====================================================
// GET /api/user-inventory/[id]
// 단일 인벤토리 상세 조회
// =====================================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "인증이 필요합니다.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const inventory = await db.userInventory.findUnique({
      where: { id },
    });

    if (!inventory) {
      return NextResponse.json(
        { error: "인벤토리를 찾을 수 없습니다.", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // 소유권 검증
    if (inventory.userId !== session.user.id) {
      return NextResponse.json(
        { error: "이 인벤토리에 대한 접근 권한이 없습니다.", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...inventory,
        isUnassigned: inventory.location === "미지정",
      },
    });

  } catch (error) {
    console.error("[UserInventory GET by ID] Error:", error);
    return NextResponse.json(
      { error: "인벤토리 조회 중 오류가 발생했습니다.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// =====================================================
// PATCH /api/user-inventory/[id]
// 사용자 인벤토리 수정 API (RESTful)
//
// [Data Integrity Rules]
// - 소유권 검증: 요청자 === inventory.userId
// - 수량 방어: quantity >= 0 (음수 불가)
// - 상태 자동 갱신: 수량에 따라 status 자동 조정
// =====================================================

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. 인증 검증
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "인증이 필요합니다.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const { id } = await params;

    // 2. 요청 바디 파싱
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "유효하지 않은 JSON 형식입니다.", code: "INVALID_JSON" },
        { status: 400 }
      );
    }

    // 3. 업데이트 필드 검증 (Zod)
    const parseResult = updateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "잘못된 업데이트 데이터입니다.",
          code: "INVALID_DATA",
          details: parseResult.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const validatedData = parseResult.data;

    // 업데이트할 필드가 없으면 에러
    if (Object.keys(validatedData).length === 0) {
      return NextResponse.json(
        { error: "업데이트할 필드가 없습니다.", code: "NO_UPDATE_FIELDS" },
        { status: 400 }
      );
    }

    // 4. 소유권 검증 (엄격한 검사)
    const existing = await db.userInventory.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        quantity: true,
        status: true,
        location: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "인벤토리를 찾을 수 없습니다.", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // 소유권 불일치 - 403 Forbidden
    if (existing.userId !== userId) {
      return NextResponse.json(
        { error: "이 인벤토리에 대한 접근 권한이 없습니다.", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // 5. 업데이트 데이터 구성
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};

    // 위치 업데이트 ("미지정" → 특정 위치)
    if (validatedData.location !== undefined) {
      updateData.location = validatedData.location;
    }

    // 수량 업데이트 (0 미만 방어 로직)
    if (validatedData.quantity !== undefined) {
      // 방어 로직: 음수 수량 절대 방지
      const newQuantity = Math.max(0, validatedData.quantity);
      updateData.quantity = newQuantity;

      // 수량에 따라 status 자동 업데이트 (명시적 status 없을 때만)
      if (validatedData.status === undefined) {
        if (newQuantity === 0) {
          updateData.status = "OUT_OF_STOCK";
        } else if (newQuantity < 5) {
          updateData.status = "LOW_STOCK";
        } else {
          updateData.status = "IN_STOCK";
        }
      }
    }

    // 명시적 상태 업데이트
    if (validatedData.status !== undefined) {
      updateData.status = validatedData.status;
    }

    // 메모 업데이트
    if (validatedData.notes !== undefined) {
      updateData.notes = validatedData.notes;
    }

    // 6. 업데이트 실행
    const updated = await db.userInventory.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: "인벤토리가 업데이트되었습니다.",
      data: {
        inventory: {
          ...updated,
          isUnassigned: updated.location === "미지정",
        },
        changes: {
          ...(validatedData.location !== undefined && {
            location: { from: existing.location, to: updated.location }
          }),
          ...(validatedData.quantity !== undefined && {
            quantity: { from: existing.quantity, to: updated.quantity }
          }),
          ...(updateData.status && updateData.status !== existing.status && {
            status: { from: existing.status, to: updated.status }
          }),
        },
      },
    });

  } catch (error) {
    console.error("[UserInventory PATCH] Error:", error);
    return NextResponse.json(
      { error: "인벤토리 업데이트 중 오류가 발생했습니다.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// =====================================================
// DELETE /api/user-inventory/[id]
// 인벤토리 삭제 (소진 완료 품목 정리용)
// =====================================================

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "인증이 필요합니다.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // 소유권 검증
    const existing = await db.userInventory.findUnique({
      where: { id },
      select: { id: true, userId: true, productName: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "인벤토리를 찾을 수 없습니다.", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (existing.userId !== session.user.id) {
      return NextResponse.json(
        { error: "이 인벤토리에 대한 접근 권한이 없습니다.", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    await db.userInventory.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "인벤토리가 삭제되었습니다.",
      data: {
        deletedId: id,
        productName: existing.productName,
      },
    });

  } catch (error) {
    console.error("[UserInventory DELETE] Error:", error);
    return NextResponse.json(
      { error: "인벤토리 삭제 중 오류가 발생했습니다.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
