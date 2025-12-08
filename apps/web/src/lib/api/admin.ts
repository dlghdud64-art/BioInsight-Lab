import { db } from "@/lib/db";

// 관리자 통계 조회
export async function getAdminStats() {
  const [totalUsers, totalProducts, totalQuotes, totalOrganizations] = await Promise.all([
    db.user.count(),
    db.product.count(),
    db.quote.count(),
    db.organization.count(),
  ]);

  return {
    totalUsers,
    totalProducts,
    totalQuotes,
    totalOrganizations,
  };
}
