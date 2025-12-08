let db: any;
let isPrismaAvailable = false;

// 중복 정의 제거 - Prisma Client를 동적으로 로드 (비동기)
(async () => {
  try {
    const prismaModule = await import("@prisma/client");
    const PrismaClient = prismaModule.PrismaClient;
    
    const globalForPrisma = globalThis as unknown as {
      prisma: any | undefined;
    };
    
    db =
      globalForPrisma.prisma ??
      new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
      });

    if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
    isPrismaAvailable = true;
  } catch (error: any) {
    console.warn("⚠️ Prisma Client not found. Please run: pnpm db:generate");
    console.warn("⚠️ Error:", error.message);
    // Prisma Client가 없을 때를 위한 더미 객체 (서버가 시작되도록)
    db = {
      product: { 
        findMany: () => Promise.resolve([]), 
        count: () => Promise.resolve(0),
        upsert: () => Promise.reject(new Error("Prisma Client not generated. Run: pnpm db:generate")),
        findUnique: () => Promise.resolve(null),
      },
      vendor: { 
        upsert: () => Promise.reject(new Error("Prisma Client not generated. Run: pnpm db:generate")),
      },
      productVendor: { 
        upsert: () => Promise.reject(new Error("Prisma Client not generated. Run: pnpm db:generate")),
      },
      searchHistory: {
        create: () => Promise.resolve({}),
      },
    };
    isPrismaAvailable = false;
  }
})();

export { db, isPrismaAvailable };
