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
export async function getUsers(params: {
  page?: number;
  limit?: number;
  role?: UserRole;
  search?: string;
}) {
  const { page = 1, limit = 20, role, search } = params;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (role) {
    where.role = role;
  }
  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
    ];
  }

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            quotes: true,
            favorites: true,
            comparisons: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    }),
    db.user.count({ where }),
  ]);

  return {
    users,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

// 사용자 역할 변경
export async function updateUserRole(userId: string, role: UserRole) {
  return db.user.update({
    where: { id: userId },
    data: { role },
  });
}

// 제품 목록 조회 (관리자용)
export async function getProductsForAdmin(params: {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
}) {
  const { page = 1, limit = 20, category, search } = params;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (category) {
    where.category = category;
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { nameEn: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
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
        _count: {
          select: {
            favorites: true,
            comparisons: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    }),
    db.product.count({ where }),
  ]);

  return {
    products,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
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
  specifications?: any;
  datasheetUrl?: string;
  imageUrl?: string;
}) {
  return db.product.create({
    data,
  });
}

// 제품 수정
export async function updateProduct(
  id: string,
  data: {
    name?: string;
    nameEn?: string;
    description?: string;
    descriptionEn?: string;
    category?: string;
    brand?: string;
    modelNumber?: string;
    catalogNumber?: string;
    specifications?: any;
    datasheetUrl?: string;
    imageUrl?: string;
  }
) {
  return db.product.update({
    where: { id },
    data,
  });
}

// 제품 삭제
export async function deleteProduct(id: string) {
  return db.product.delete({
    where: { id },
  });
}

// 벤더 목록 조회
export async function getVendors(params: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  const { page = 1, limit = 20, search } = params;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { nameEn: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const [vendors, total] = await Promise.all([
    db.vendor.findMany({
      where,
      include: {
        _count: {
          select: {
            products: true,
            quoteResponses: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    }),
    db.vendor.count({ where }),
  ]);

  return {
    vendors,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

// 벤더 생성
export async function createVendor(data: {
  name: string;
  nameEn?: string;
  email?: string;
  phone?: string;
  website?: string;
  country?: string;
  currency?: string;
}) {
  return db.vendor.create({
    data,
  });
}

// 벤더 수정
export async function updateVendor(
  id: string,
  data: {
    name?: string;
    nameEn?: string;
    email?: string;
    phone?: string;
    website?: string;
    country?: string;
    currency?: string;
  }
) {
  return db.vendor.update({
    where: { id },
    data,
  });
}

// 벤더 삭제
export async function deleteVendor(id: string) {
  return db.vendor.delete({
    where: { id },
  });
}

// 통계 조회
export async function getAdminStats() {
  const [users, products, vendors, quotes] = await Promise.all([
    db.user.count(),
    db.product.count(),
    db.vendor.count(),
    db.quote.count(),
  ]);

  const recentUsers = await db.user.count({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 최근 30일
      },
    },
  });

  const recentQuotes = await db.quote.count({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    },
  });

  return {
    users: {
      total: users,
      recent: recentUsers,
    },
    products: {
      total: products,
    },
    vendors: {
      total: vendors,
    },
    quotes: {
      total: quotes,
      recent: recentQuotes,
    },
  };
}



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
export async function getUsers(params: {
  page?: number;
  limit?: number;
  role?: UserRole;
  search?: string;
}) {
  const { page = 1, limit = 20, role, search } = params;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (role) {
    where.role = role;
  }
  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
    ];
  }

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            quotes: true,
            favorites: true,
            comparisons: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    }),
    db.user.count({ where }),
  ]);

  return {
    users,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

// 사용자 역할 변경
export async function updateUserRole(userId: string, role: UserRole) {
  return db.user.update({
    where: { id: userId },
    data: { role },
  });
}

// 제품 목록 조회 (관리자용)
export async function getProductsForAdmin(params: {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
}) {
  const { page = 1, limit = 20, category, search } = params;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (category) {
    where.category = category;
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { nameEn: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
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
        _count: {
          select: {
            favorites: true,
            comparisons: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    }),
    db.product.count({ where }),
  ]);

  return {
    products,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
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
  specifications?: any;
  datasheetUrl?: string;
  imageUrl?: string;
}) {
  return db.product.create({
    data,
  });
}

// 제품 수정
export async function updateProduct(
  id: string,
  data: {
    name?: string;
    nameEn?: string;
    description?: string;
    descriptionEn?: string;
    category?: string;
    brand?: string;
    modelNumber?: string;
    catalogNumber?: string;
    specifications?: any;
    datasheetUrl?: string;
    imageUrl?: string;
  }
) {
  return db.product.update({
    where: { id },
    data,
  });
}

// 제품 삭제
export async function deleteProduct(id: string) {
  return db.product.delete({
    where: { id },
  });
}

// 벤더 목록 조회
export async function getVendors(params: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  const { page = 1, limit = 20, search } = params;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { nameEn: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const [vendors, total] = await Promise.all([
    db.vendor.findMany({
      where,
      include: {
        _count: {
          select: {
            products: true,
            quoteResponses: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    }),
    db.vendor.count({ where }),
  ]);

  return {
    vendors,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

// 벤더 생성
export async function createVendor(data: {
  name: string;
  nameEn?: string;
  email?: string;
  phone?: string;
  website?: string;
  country?: string;
  currency?: string;
}) {
  return db.vendor.create({
    data,
  });
}

// 벤더 수정
export async function updateVendor(
  id: string,
  data: {
    name?: string;
    nameEn?: string;
    email?: string;
    phone?: string;
    website?: string;
    country?: string;
    currency?: string;
  }
) {
  return db.vendor.update({
    where: { id },
    data,
  });
}

// 벤더 삭제
export async function deleteVendor(id: string) {
  return db.vendor.delete({
    where: { id },
  });
}

// 통계 조회
export async function getAdminStats() {
  const [users, products, vendors, quotes] = await Promise.all([
    db.user.count(),
    db.product.count(),
    db.vendor.count(),
    db.quote.count(),
  ]);

  const recentUsers = await db.user.count({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 최근 30일
      },
    },
  });

  const recentQuotes = await db.quote.count({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    },
  });

  return {
    users: {
      total: users,
      recent: recentUsers,
    },
    products: {
      total: products,
    },
    vendors: {
      total: vendors,
    },
    quotes: {
      total: quotes,
      recent: recentQuotes,
    },
  };
}



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
export async function getUsers(params: {
  page?: number;
  limit?: number;
  role?: UserRole;
  search?: string;
}) {
  const { page = 1, limit = 20, role, search } = params;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (role) {
    where.role = role;
  }
  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
    ];
  }

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            quotes: true,
            favorites: true,
            comparisons: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    }),
    db.user.count({ where }),
  ]);

  return {
    users,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

// 사용자 역할 변경
export async function updateUserRole(userId: string, role: UserRole) {
  return db.user.update({
    where: { id: userId },
    data: { role },
  });
}

// 제품 목록 조회 (관리자용)
export async function getProductsForAdmin(params: {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
}) {
  const { page = 1, limit = 20, category, search } = params;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (category) {
    where.category = category;
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { nameEn: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
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
        _count: {
          select: {
            favorites: true,
            comparisons: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    }),
    db.product.count({ where }),
  ]);

  return {
    products,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
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
  specifications?: any;
  datasheetUrl?: string;
  imageUrl?: string;
}) {
  return db.product.create({
    data,
  });
}

// 제품 수정
export async function updateProduct(
  id: string,
  data: {
    name?: string;
    nameEn?: string;
    description?: string;
    descriptionEn?: string;
    category?: string;
    brand?: string;
    modelNumber?: string;
    catalogNumber?: string;
    specifications?: any;
    datasheetUrl?: string;
    imageUrl?: string;
  }
) {
  return db.product.update({
    where: { id },
    data,
  });
}

// 제품 삭제
export async function deleteProduct(id: string) {
  return db.product.delete({
    where: { id },
  });
}

// 벤더 목록 조회
export async function getVendors(params: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  const { page = 1, limit = 20, search } = params;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { nameEn: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const [vendors, total] = await Promise.all([
    db.vendor.findMany({
      where,
      include: {
        _count: {
          select: {
            products: true,
            quoteResponses: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    }),
    db.vendor.count({ where }),
  ]);

  return {
    vendors,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

// 벤더 생성
export async function createVendor(data: {
  name: string;
  nameEn?: string;
  email?: string;
  phone?: string;
  website?: string;
  country?: string;
  currency?: string;
}) {
  return db.vendor.create({
    data,
  });
}

// 벤더 수정
export async function updateVendor(
  id: string,
  data: {
    name?: string;
    nameEn?: string;
    email?: string;
    phone?: string;
    website?: string;
    country?: string;
    currency?: string;
  }
) {
  return db.vendor.update({
    where: { id },
    data,
  });
}

// 벤더 삭제
export async function deleteVendor(id: string) {
  return db.vendor.delete({
    where: { id },
  });
}

// 통계 조회
export async function getAdminStats() {
  const [users, products, vendors, quotes] = await Promise.all([
    db.user.count(),
    db.product.count(),
    db.vendor.count(),
    db.quote.count(),
  ]);

  const recentUsers = await db.user.count({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 최근 30일
      },
    },
  });

  const recentQuotes = await db.quote.count({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    },
  });

  return {
    users: {
      total: users,
      recent: recentUsers,
    },
    products: {
      total: products,
    },
    vendors: {
      total: vendors,
    },
    quotes: {
      total: quotes,
      recent: recentQuotes,
    },
  };
}






