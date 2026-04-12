// Prisma Client 동기 초기화
// async IIFE 방식은 요청이 초기화 완료 전에 오면 db=undefined 타이밍 레이스가 발생함
// require()를 사용하여 모듈 로드 시 즉시 동기적으로 초기화

let db: any;
let isPrismaAvailable = false;

// ── Prisma 미생성 시 fallback: Proxy 기반 안전 더미 ──
// 어떤 모델이든 db.modelName.findMany() 등을 호출하면
// 에러 대신 빈 결과를 반환하여 서버가 500으로 죽지 않게 합니다.
const STUB_ERROR_MSG = "Prisma Client not generated. Run: pnpm db:generate";

/** 읽기 전용 메서드는 빈 결과, 쓰기 메서드는 명확한 에러를 반환 */
function createModelStub(modelName: string) {
  const readMethods: Record<string, () => any> = {
    findMany: () => Promise.resolve([]),
    findFirst: () => Promise.resolve(null),
    findUnique: () => Promise.resolve(null),
    count: () => Promise.resolve(0),
    aggregate: () => Promise.resolve({ _count: 0, _sum: {}, _avg: {}, _min: {}, _max: {} }),
    groupBy: () => Promise.resolve([]),
  };

  const writeMethods: Record<string, () => any> = {
    create: () => Promise.reject(new Error(STUB_ERROR_MSG)),
    createMany: () => Promise.reject(new Error(STUB_ERROR_MSG)),
    update: () => Promise.reject(new Error(STUB_ERROR_MSG)),
    updateMany: () => Promise.reject(new Error(STUB_ERROR_MSG)),
    upsert: () => Promise.reject(new Error(STUB_ERROR_MSG)),
    delete: () => Promise.reject(new Error(STUB_ERROR_MSG)),
    deleteMany: () => Promise.reject(new Error(STUB_ERROR_MSG)),
  };

  return new Proxy({} as any, {
    get(_target, prop: string) {
      if (prop in readMethods) return readMethods[prop];
      if (prop in writeMethods) return writeMethods[prop];
      // 알 수 없는 메서드 — 읽기 fallback (빈 배열)
      if (typeof prop === "string" && !prop.startsWith("_")) {
        return () => Promise.resolve([]);
      }
      return undefined;
    },
  });
}

function createDummyDb() {
  return new Proxy(
    {
      $transaction: (...args: any[]) => {
        // $transaction([...promises]) 패턴 지원
        if (Array.isArray(args[0])) return Promise.all(args[0]);
        return Promise.reject(new Error(STUB_ERROR_MSG));
      },
      $disconnect: () => Promise.resolve(),
      $connect: () => Promise.resolve(),
      $queryRaw: () => Promise.resolve([]),
      $executeRaw: () => Promise.resolve(0),
    } as any,
    {
      get(target, prop: string) {
        // $로 시작하는 유틸리티 메서드는 target에서 직접 반환
        if (prop in target) return target[prop];
        // 모델 접근 → 자동으로 stub 생성
        if (typeof prop === "string" && prop[0] !== "_") {
          const stub = createModelStub(prop);
          // 캐싱하여 동일 모델 재접근 시 같은 stub 반환
          target[prop] = stub;
          return stub;
        }
        return undefined;
      },
    },
  );
}

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaClient } = require("@prisma/client");

  const globalForPrisma = globalThis as unknown as {
    prisma: any | undefined;
  };

  db =
    globalForPrisma.prisma ??
    new PrismaClient({
      // "query" 로그 제거: HMR 시마다 수천 줄 쿼리 로그가 서버 터미널 부하를 일으킴
      log: ["error"],
    });

  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
  isPrismaAvailable = true;
} catch (error: any) {
  console.warn("⚠️ Prisma Client not found. Please run: pnpm db:generate");
  console.warn("⚠️ Error:", error.message);
  db = createDummyDb();
  isPrismaAvailable = false;
}

export { db, isPrismaAvailable };
