import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUsers, updateUserRole, isAdmin } from "@/lib/api/admin";

// ì¬ì©ì ëª©ë¡ ì¡°í - ì¤ë³µ ì ì ì ê±°
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const params = {
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!) : 1,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 20,
      role: searchParams.get("role") as any,
      search: searchParams.get("search") || undefined,
    };

    const result = await getUsers(params);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// ì¬ì©ì ì­í  ë³ê²½ - ì¤ë³µ ì ì ì ê±°
