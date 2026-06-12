// §11.369-3 (횡단 stale-lock) — concurrency 키 스킴 (순수). 호영님 P-track 2026-06-12
//   전역 'unknown' lock(60+ route 공유) → route+resource/user 격리.
//   - routePath  : cross-route 충돌 소멸(한 route leak 이 타 route 잠그지 않음).
//   - targetEntityId(실제 resource) : per-resource 정밀.
//   - userId fallback('unknown'/없음) : double-submit 보호 보존(같은 user+route 재호출 충돌).
//   ⚠️ per-call UUID/timestamp 절대 금지 — 호출마다 unique 면 beginMutation no-op →
//      double-submit/idempotency 보호 통째 제거(중복 실행 latent). 결정적 키여야 보호 성립.
//   canonical 경계: TTL·release(ACTIVE_MUTATIONS/hasActiveLock) 불변. 본 머신은 키 derive 만.

export interface ConcurrencyKeyInput {
  action: string;
  routePath: string;
  /** 실제 resource id. 'unknown'/없음이면 userId 로 fallback(per-user double-submit 보호). */
  targetEntityId: string | null | undefined;
  userId: string;
}

export function deriveConcurrencyKey(input: ConcurrencyKeyInput): string {
  const { action, routePath, targetEntityId, userId } = input;
  const resource =
    targetEntityId && targetEntityId !== "unknown" ? targetEntityId : userId;
  return `${action}:${routePath}:${resource}`;
}
