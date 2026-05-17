/**
 * #cron-monitoring-admin-dashboard #execution-logger — Vercel cron 실행 wrapper.
 *
 * 호영님 backlog audit P0 (b). 5 cron route handler 를 본 wrapper 로 감싸면
 *   CronExecutionLog table 에 자동 INSERT (startedAt / completedAt / durationMs
 *   / success / errorMessage / metadata). admin/cron page 가 본 row 를 시각화.
 *
 * Strategy:
 *   - handler 호출 전 startedAt 기록.
 *   - try: handler 실행 → 결과 reuse + completedAt + durationMs + success:true.
 *   - catch: error 캡처 + completedAt + durationMs + success:false +
 *     errorMessage truncate (max 500 chars).
 *   - finally: db.cronExecutionLog.create (graceful try/catch — INSERT 실패 시
 *     cron 운영 영향 0, console.error 만).
 *   - handler 결과 그대로 반환 (success) 또는 throw (failure) — cron 응답
 *     시그니처 보존.
 *
 * canonical truth lock:
 *   - CronExecutionLog = canonical history.
 *   - handler 결과/throw 의 시그니처 보존 (caller 호환 100%).
 *   - logger fail 가 cron 운영 영향 0 (graceful fallback).
 *   - metadata Json? 으로 handler 결과 (예: {processed: 12, dispatched: 3})
 *     선택적 캡처.
 */

import { db } from "@/lib/db";

const ERROR_MESSAGE_MAX = 500;

/**
 * cron handler 를 wrap하여 실행 로그를 CronExecutionLog 에 INSERT.
 *
 * @param cronPath - 식별자 (예: "/api/cron/inventory-check"). admin dashboard 에
 *                   서 cron 별 aggregation key.
 * @param handler  - 실제 cron 로직 async 함수. 결과는 metadata 에 캡처될 수 있음.
 * @returns handler 결과 그대로 (success) 또는 throw (failure).
 */
export async function logCronExecution<T>(
  cronPath: string,
  handler: () => Promise<T>,
): Promise<T> {
  const startedAt = new Date();
  let completedAt: Date | null = null;
  let durationMs = 0;
  let success = false;
  let errorMessage: string | null = null;
  let metadata: unknown = null;
  let resultToReturn: T | undefined = undefined;
  let errorToThrow: unknown = null;

  try {
    const result = await handler();
    completedAt = new Date();
    durationMs = completedAt.getTime() - startedAt.getTime();
    success = true;
    // handler 결과가 JSON-serializable object 면 metadata 로 캡처.
    if (result && typeof result === "object") {
      metadata = result;
    }
    resultToReturn = result;
  } catch (err) {
    completedAt = new Date();
    durationMs = completedAt.getTime() - startedAt.getTime();
    success = false;
    const rawMessage = err instanceof Error ? err.message : String(err);
    errorMessage = rawMessage.length > ERROR_MESSAGE_MAX
      ? rawMessage.slice(0, ERROR_MESSAGE_MAX)
      : rawMessage;
    errorToThrow = err;
  }

  // graceful INSERT — logger fail 가 cron 운영 영향 0.
  try {
    await db.cronExecutionLog.create({
      data: {
        cronPath,
        startedAt,
        completedAt,
        durationMs,
        success,
        errorMessage,
        metadata: metadata as never,
      },
    });
  } catch (dbErr) {
    console.error(
      "[logCronExecution] CronExecutionLog INSERT 실패 (cron 영향 0):",
      dbErr,
    );
  }

  if (errorToThrow) throw errorToThrow;
  return resultToReturn as T;
}
