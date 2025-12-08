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

// 관리자용 제품 목록 조회
export async function getProductsForAdmin(params?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  const { page = 1, limit = 20, search } = params || {};
  const skip = (page - 1) * limit;

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { nameEn: { contains: search, mode: "insensitive" } },
      { brand: { contains: search, mode: "insensitive" } },
    ];
  }

  const [products, total] = await Promise.all([
    db.product.findMany({
      where,
      include: {
        vendors: {
          include: {
            vendor: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.product.count({ where }),
  ]);

  return {
    products,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// 사용자 목록 조회
export async function getUsers(params?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  const { page = 1, limit = 20, search } = params || {};
  const skip = (page - 1) * limit;

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.user.count({ where }),
  ]);

  return {
    users,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// 관리자 권한 확인
export async function isAdmin(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role === "ADMIN";
}

// 제품 업데이트
export async function updateProduct(
  productId: string,
  data: {
    name?: string;
    nameEn?: string;
    description?: string;
    descriptionEn?: string;
    category?: string;
    brand?: string;
    modelNumber?: string;
    catalogNumber?: string;
  }
) {
  return await db.product.update({
    where: { id: productId },
    data,
  });
}

// 제품 삭제
export async function deleteProduct(productId: string) {
  return await db.product.delete({
    where: { id: productId },
  });
}

// 제품 생성
export async function createProduct(data: {
  name: string;
  nameEn?: string;
  description?: string;
  descriptionEn?: string;
  category: string;
  brand?: string;
  modelNumber?: string;
  catalogNumber?: string;
}) {
  return await db.product.create({
    data,
  });
}

// 사용자 역할 업데이트
export async function updateUserRole(userId: string, role: string) {
  return await db.user.update({
    where: { id: userId },
    data: { role },
  });
}
