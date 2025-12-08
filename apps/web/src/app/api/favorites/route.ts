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