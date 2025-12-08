import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAdminStats, isAdmin } from "@/lib/api/admin";

// ê´ë¦¬ì íµê³ ì¡°í - ì¤ë³µ ì ì ì ê±°
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const stats = await getAdminStats();
    return NextResponse.json({ stats });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin stats" },
      { status: 500 }
    );
  }
}
