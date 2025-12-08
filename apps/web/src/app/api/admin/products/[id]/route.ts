import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateProduct, deleteProduct, isAdmin } from "@/lib/api/admin";

// ì í ìì  - ì¤ë³µ ì ì ì ê±°
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const product = await updateProduct(id, body);
    return NextResponse.json({ product });
  } catch (error) {
    console.error("Error updating product:", error);
    return NextResponse.json(
      { error: "Failed to update product" },
      { status: 500 }
    );
  }
}

// ì í ì­ì  - ì¤ë³µ ì ì ì ê±°