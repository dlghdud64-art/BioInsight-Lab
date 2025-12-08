import { db } from "@/lib/db";
import type { UserRole } from "@/types";

// 관리자 권한 확인
export async function isAdmin(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role === "ADMIN";
}

// 사용자 목록 조회