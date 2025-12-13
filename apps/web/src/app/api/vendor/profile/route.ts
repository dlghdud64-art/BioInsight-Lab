import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * 벤더 프로필 조회
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: {
        vendor: true,
      },
    });

    if (!user?.vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    return NextResponse.json({ vendor: user.vendor });
  } catch (error: any) {
    console.error("Error fetching vendor profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch vendor profile" },
      { status: 500 }
    );
  }
}

/**
 * 벤더 프로필 업데이트
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, nameEn, email, phone, website, country, currency } = body;

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: {
        vendor: true,
      },
    });

    if (!user?.vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    const updatedVendor = await db.vendor.update({
      where: { id: user.vendor.id },
      data: {
        ...(name && { name }),
        ...(nameEn !== undefined && { nameEn }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(website !== undefined && { website }),
        ...(country !== undefined && { country }),
        ...(currency !== undefined && { currency }),
      },
    });

    return NextResponse.json({ vendor: updatedVendor });
  } catch (error: any) {
    console.error("Error updating vendor profile:", error);
    return NextResponse.json(
      { error: "Failed to update vendor profile" },
      { status: 500 }
    );
  }
}

