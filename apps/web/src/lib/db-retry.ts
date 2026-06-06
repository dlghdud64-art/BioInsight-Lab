/**
 * §11.366-server #cold-start-transient-retry — DB 일시 장애 재시도 래퍼.
 *
 * 문제: 서버 cold start 시 첫 요청이 Prisma connection transient(P1001/P1017/
 *   P2024)로 실패 → /api/dashboard/stats 500 → 대시보드 첫 진입 검은/0 KPI/
 *   온보딩 오판. "다시 시도" 1회로 성공(cold→warm).
 *
 * 해법: cold connection 시점 쿼리를 transient 한정 1회(기본) 재시도로 감싸
 *   첫 실패를 서버가 흡수. non-transient(P2002 unique 등)·검증/로직 에러는
 *   즉시 전파한다(무한 재시도·에러 은폐 금지).
 *
 * 적용 범위: dashboard/stats 의 early count gate(첫 connection 시점)만. 이후
 *   Phase 쿼리는 warm 이므로 클라(react-query retry)·스켈레톤 상한(§11.366)이
 *   그대로 처리한다.
 *
 * 선례: app/api/products/search/route.ts 의 inline P1001/P1017 감지 패턴과 동근
 *   (본 util 은 공유 헬퍼화 — products/search 정합은 후속 별도 작업).
 */

/** cold connection 등 일시 장애로 분류해 재시도할 Prisma 에러 코드 화이트리스트. */
const TRANSIENT_DB_CODES = new Set([
  "P1001", // Can't reach database server
  "P1017", // Server has closed the connection
  "P2024", // Timed out fetching a new connection from the pool
]);

/** 주어진 에러가 재시도 가능한 DB 일시 장애인지 판정. 그 외(검증/유니크/로직)는 false. */
export function isTransientDbError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && TRANSIENT_DB_CODES.has(code);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface WithDbRetryOptions {
  /** transient 에러 시 추가 재시도 횟수(기본 1). */
  retries?: number;
  /** 재시도 전 대기(ms, 기본 300). cold connection 흡수용 짧은 지연. */
  delayMs?: number;
}

/**
 * fn 을 실행하고, transient DB 에러일 때만 최대 `retries` 회 재시도한다.
 * non-transient 에러 또는 재시도 소진 시 마지막 에러를 그대로 throw 한다.
 */
export async function withDbRetry<T>(
  fn: () => Promise<T>,
  options: WithDbRetryOptions = {},
): Promise<T> {
  const retries = options.retries ?? 1;
  const delayMs = options.delayMs ?? 300;

  let attempt = 0;
  // 최초 1회 + retries 회.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (!isTransientDbError(error) || attempt >= retries) {
        throw error;
      }
      attempt += 1;
      if (delayMs > 0) await sleep(delayMs);
    }
  }
}
