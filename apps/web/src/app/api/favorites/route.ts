import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFavoritesByUser, addFavorite, removeFavorite } from "@/lib/api/favorites";

// 즐겨찾기 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const favorites = await getFavoritesByUser(session.user.id);
    return NextResponse.json({ favorites });
  } catch (error) {
    console.error("Error fetching favorites:", error);
    return NextResponse.json(
      { error: "Failed to fetch favorites" },
      { status: 500 }
    );
  }
}

// 즐겨찾기 추가/제거
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { productId, action } = body; // action: "add" | "remove"

    if (!productId || !action) {
      return NextResponse.json(
        { error: "productId and action are required" },
        { status: 400 }
      );
    }

    if (action === "add") {
      const favorite = await addFavorite(session.user.id, productId);
      return NextResponse.json({ favorite });
    } else if (action === "remove") {
      await removeFavorite(session.user.id, productId);
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'add' or 'remove'" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error managing favorite:", error);
    return NextResponse.json(
      { error: "Failed to manage favorite" },
      { status: 500 }
    );
  }
}



