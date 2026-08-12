import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 벤더 정보 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 사용자 정보 확인
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, email: true },
    });

    if (user?.role !== "SUPPLIER") {
      return NextResponse.json({ error: "Not a supplier" }, { status: 403 });
    }

    // 이메일로 벤더 찾기 (임시: 실제로는 User-Vendor 관계 테이블이 필요)
    const vendor = await db.vendor.findFirst({
      where: {
        email: user.email || "",
      },
    });

    return NextResponse.json({ vendor });
  } catch (error: any) {
    console.error("Error fetching vendor info:", error);
    return NextResponse.json(
      { error: "Failed to fetch vendor info" },
      { status: 500 }
    );
  }
}

