// Prisma Client 동기 초기화
// async IIFE 방식은 요청이 초기화 완료 전에 오면 db=undefined 타이밍 레이스가 발생함
// require()를 사용하여 모듈 로드 시 즉시 동기적으로 초기화

let db: any;
let isPrismaAvailable = false;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaClient } = require("@prisma/client");

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
      findUnique: () => Promise.resolve(null),
      findFirst: () => Promise.resolve(null),
    },
    productVendor: {
      upsert: () => Promise.reject(new Error("Prisma Client not generated. Run: pnpm db:generate")),
      findMany: () => Promise.resolve([]),
    },
    searchHistory: {
      create: () => Promise.resolve({}),
    },
    // 이하: API route에서 사용하는 모델 더미 (모두 명확한 에러 반환)
    organizationMember: {
      findMany: () => Promise.reject(new Error("Prisma Client not generated. Run: pnpm db:generate")),
      findFirst: () => Promise.resolve(null),
      findUnique: () => Promise.resolve(null),
      create: () => Promise.reject(new Error("Prisma Client not generated. Run: pnpm db:generate")),
    },
    quote: {
      create: () => Promise.reject(new Error("Prisma Client not generated. Run: pnpm db:generate")),
      findUnique: () => Promise.resolve(null),
      findMany: () => Promise.resolve([]),
    },
    quoteListItem: {
      create: () => Promise.reject(new Error("Prisma Client not generated. Run: pnpm db:generate")),
      createMany: () => Promise.reject(new Error("Prisma Client not generated. Run: pnpm db:generate")),
    },
    quoteShare: {
      create: () => Promise.reject(new Error("Prisma Client not generated. Run: pnpm db:generate")),
      findFirst: () => Promise.resolve(null),
    },
    quoteVendorRequest: {
      create: () => Promise.reject(new Error("Prisma Client not generated. Run: pnpm db:generate")),
    },
    productInventory: {
      findMany: () => Promise.resolve([]),
      createMany: () => Promise.reject(new Error("Prisma Client not generated. Run: pnpm db:generate")),
      findUnique: () => Promise.resolve(null),
    },
    organization: {
      findUnique: () => Promise.resolve(null),
      findMany: () => Promise.resolve([]),
    },
    $transaction: () => Promise.reject(new Error("Prisma Client not generated. Run: pnpm db:generate")),
    $disconnect: () => Promise.resolve(),
  };
  isPrismaAvailable = false;
}

export { db, isPrismaAvailable };
