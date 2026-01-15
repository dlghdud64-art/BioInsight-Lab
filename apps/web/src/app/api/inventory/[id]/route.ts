import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 개별 재고 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const inventory = await db.productInventory.findUnique({
      where: { id: params.id },
      include: {
        product: {
          include: {
            vendors: {
              include: {
                vendor: true,
              },
            },
          },
        },
      },
    });

    if (!inventory) {
      return NextResponse.json({ error: "Inventory not found" }, { status: 404 });
    }

    // 권한 확인: 자신의 재고 또는 같은 조직의 재고인지 확인
    if (inventory.userId !== session.user.id && !inventory.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ inventory });
  } catch (error) {
    console.error("Error fetching inventory:", error);
    return NextResponse.json(
      { error: "Failed to fetch inventory" },
      { status: 500 }
    );
  }
}

// 재고 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 기존 재고 확인
    const existingInventory = await db.productInventory.findUnique({
      where: { id: params.id },
    });

    if (!existingInventory) {
      return NextResponse.json({ error: "Inventory not found" }, { status: 404 });
    }

    // 권한 확인
    if (existingInventory.userId !== session.user.id && !existingInventory.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      quantity,
      location,
      notes,
      expiryDate,
      date, // 새로 추가된 날짜 필드
      minOrderQty,
      autoReorderEnabled,
      autoReorderThreshold,
    } = body;

    // 업데이트할 데이터 준비
    const updateData: any = {};

    // quantity를 숫자로 변환
    if (quantity !== undefined) {
      const parsedQuantity = typeof quantity === 'string'
        ? Number(quantity.replace(/,/g, ''))
        : Number(quantity);

      if (isNaN(parsedQuantity)) {
        return NextResponse.json(
          { error: "Invalid quantity value" },
          { status: 400 }
        );
      }
      updateData.currentQuantity = parsedQuantity;
    }

    // location 업데이트
    if (location !== undefined) {
      updateData.location = location || null;
    }

    // notes 업데이트 (date 정보를 notes에 포함시킬 수도 있음)
    if (notes !== undefined || date !== undefined) {
      let updatedNotes = notes || existingInventory.notes || '';

      // date가 제공되면 notes에 추가하거나 별도 처리
      if (date) {
        const dateNote = `\n[입고일: ${date}]`;
        if (!updatedNotes.includes(dateNote)) {
          updatedNotes = updatedNotes + dateNote;
        }
      }

      updateData.notes = updatedNotes || null;
    }

    // expiryDate 업데이트
    if (expiryDate !== undefined) {
      updateData.expiryDate = expiryDate ? new Date(expiryDate) : null;
    }

    // minOrderQty 업데이트
    if (minOrderQty !== undefined) {
      const parsedMinOrderQty = typeof minOrderQty === 'string'
        ? Number(minOrderQty.replace(/,/g, ''))
        : Number(minOrderQty);

      if (isNaN(parsedMinOrderQty)) {
        return NextResponse.json(
          { error: "Invalid minOrderQty value" },
          { status: 400 }
        );
      }
      updateData.minOrderQty = parsedMinOrderQty;
    }

    // autoReorder 설정 업데이트
    if (autoReorderEnabled !== undefined) {
      updateData.autoReorderEnabled = Boolean(autoReorderEnabled);
    }

    if (autoReorderThreshold !== undefined) {
      const parsedThreshold = typeof autoReorderThreshold === 'string'
        ? Number(autoReorderThreshold.replace(/,/g, ''))
        : Number(autoReorderThreshold);

      if (isNaN(parsedThreshold)) {
        return NextResponse.json(
          { error: "Invalid autoReorderThreshold value" },
          { status: 400 }
        );
      }
      updateData.autoReorderThreshold = parsedThreshold;
    }

    // 업데이트 실행
    const updatedInventory = await db.productInventory.update({
      where: { id: params.id },
      data: updateData,
      include: {
        product: {
          include: {
            vendors: {
              include: {
                vendor: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedInventory,
    });
  } catch (error: any) {
    console.error("Error updating inventory:", error);
    return NextResponse.json(
      {
        error: "Failed to update inventory",
        details: error.message
      },
      { status: 500 }
    );
  }
}

// 재고 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 기존 재고 확인
    const existingInventory = await db.productInventory.findUnique({
      where: { id: params.id },
    });

    if (!existingInventory) {
      return NextResponse.json({ error: "Inventory not found" }, { status: 404 });
    }

    // 권한 확인
    if (existingInventory.userId !== session.user.id && !existingInventory.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 삭제 실행
    await db.productInventory.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
      message: "Inventory deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting inventory:", error);
    return NextResponse.json(
      {
        error: "Failed to delete inventory",
        details: error.message
      },
      { status: 500 }
    );
  }
}
