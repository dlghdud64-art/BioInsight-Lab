/**
 * §audit-durability (호영님 2026-09-07 승인) —
 * **감사 기록을 응답 경로 밖에서, 내구 저장소에 남긴다.**
 *
 * 사고: `enforceAction().complete()` 가 `appendAuditEnvelope` 로 가는데 그 종착지가
 *   모듈 최상위 `let auditStore`(**인스턴스 메모리**)였다. 서버리스에서 요청이 끝나면
 *   사라지므로, `enforceAction` 을 쓰는 **147개 라우트 중 감사 의도가 있는 116개**의
 *   기록이 존재한 적이 없다(prod 실측: `MutationAuditEvent` 0행).
 *   해시 체인을 읽는 곳도 0이었다 — 감사의 외형만 있고 실체가 없었다.
 *
 * ── 설계 결정 3가지 ─────────────────────────────────────────────
 *
 * ① **응답 경로 밖에서 쓴다.** `await` 로 바꾸면 감사 대상 요청 전량이 왕복 1회만큼
 *    느려진다. 실측(2026-09-07 · operator-shell 한국 → DB ap-northeast-1):
 *      세션 풀러 5432 단독 38ms · 트랜잭션 풀러 6543 단독 196ms
 *      13쿼리 트랜잭션 안에서는 쿼리당 43.5ms / 84.6ms
 *      prod(`/api/health`, iad1) 단독 왕복 **737~770ms**
 *    → 리전을 옮겨도 풀러 축이 남는다(196ms). `await` 는 어느 쪽이든 받을 수 없다.
 *
 * ② **의존성을 추가하지 않는다.** `@vercel/functions` 의 `waitUntil` 은 실측상 한 줄이다:
 *      `const waitUntil = (p) => getContext().waitUntil?.(p)`
 *      `getContext = () => globalThis[Symbol.for("@vercel/request-context")]?.get?.() ?? {}`
 *    그런데 `npm install` 이 락파일에서 **next-auth 5.0.0-beta.30 → beta.25 다운그레이드**,
 *    `html5-qrcode`(스캐너)·radix dropdown 항목 제거를 함께 끌고 왔다(실측 2026-09-07).
 *    이 저장소가 이미 겪은 `27f406f6`(React 18/19 혼재)·`82520045` 계열이라,
 *    한 줄을 위해 트리를 흔들지 않는다. **같은 심볼을 직접 읽는다.**
 *    🔑 그 심볼이 실제로 붙는지는 `/api/health` 의 `waitUntilProbe` 가 배포본에서 답한다
 *      (2026-09-07 실측: `contextPresent: true · waitUntilCallable: true`).
 *
 * ③ **절대 throw 하지 않는다** (호영님 조건). 감사 쓰기 실패가 업무 요청을 500 으로
 *    만들면 안 된다. 다만 **삼키되 기록한다** — 실패 사유를 `console.error` 로 남긴다.
 *    오늘 스윕 대상이 될 silent-catch 를 새로 쓰지 않기 위해 처음부터 박는다.
 */

import { db } from "@/lib/db";

/** `@vercel/functions` 가 컨텍스트를 찾는 자리와 **같은 심볼**. 값을 베끼지 않고 맞춘다. */
const SYMBOL_FOR_REQ_CONTEXT = Symbol.for("@vercel/request-context");

/**
 * 응답을 막지 않고, 인스턴스가 얼기 전까지 프라미스를 살려 둔다.
 *
 * 🛑 컨텍스트가 없으면 **no-op** 이다(Vercel 밖·로컬). 그때도 프라미스는 이미 실행을
 *   시작했고 로컬은 이벤트루프가 받는다. 즉 "없으면 조용히 안 된다" 가 아니라
 *   "없으면 붙잡아 주지 않는다" 이고, 붙잡아 주는지는 위 프로브가 감시한다.
 */
export function waitUntilCompat(promise: Promise<unknown>): void {
  try {
    const holder = (globalThis as Record<symbol, unknown>)[SYMBOL_FOR_REQ_CONTEXT] as
      | { get?: () => { waitUntil?: (p: Promise<unknown>) => void } }
      | undefined;
    holder?.get?.()?.waitUntil?.(promise);
  } catch {
    /* 컨텍스트 접근 실패는 감사 실패로 번지지 않는다 — 프라미스는 이미 돌고 있다. */
  }
}

export interface DurableAuditInput {
  /** 없을 수 있다. 활성 조직으로 **유도하지 않는다** — 틀린 조직을 적느니 null 이 정직하다. */
  organizationId?: string | null;
  /** §audit-org-required — 호출자가 조직을 **아직 정하지 않았다**(UNRESOLVED_ORG). null(조직 없음)과 가른다. */
  orgUnresolved?: boolean;
  actorId: string;
  /** `/api/organizations/id/subscription` 같은 정규화 경로. */
  route: string;
  action: string;
  entityType: string;
  entityId: string;
  correlationId: string;
  result: "success" | "blocked" | "error";
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  rationale?: string;
  sourceSurface?: string;
}

/** 같은 사건이 두 번 적히지 않게 — 스키마의 `auditEventKey @unique` 형식을 따른다. */
function auditEventKey(input: DurableAuditInput, at: Date): string {
  return [
    input.organizationId ?? "no-org",
    input.route,
    input.entityId,
    input.action,
    at.getTime(),
  ].join(":");
}

/**
 * 감사 1건을 DB 에 남긴다. **결코 throw 하지 않는다.**
 *
 * 반환하는 프라미스는 항상 resolve 한다 — 호출자가 `waitUntilCompat` 에 그대로 넘길 수 있다.
 */
export async function recordDurableAudit(input: DurableAuditInput): Promise<void> {
  const at = new Date();
  try {
    await db.mutationAuditEvent.create({
      data: {
        auditEventKey: auditEventKey(input, at),
        occurredAt: at,
        // §audit-durability DDL(20260907090000) 로 nullable 이 됐다.
        orgId: input.organizationId ?? null,
        actorId: input.actorId,
        route: input.route,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        result: input.result,
        correlationId: input.correlationId,
        decisionBasis: {
          beforeState: input.beforeState ?? null,
          afterState: input.afterState ?? null,
          rationale: input.rationale ?? null,
          sourceSurface: input.sourceSurface ?? null,
          // 조직이 왜 비었는지를 값과 함께 남긴다 — null 이 사고인지 설계인지 구분된다.
          orgIdOmitted: input.organizationId == null,
          // §audit-org-required — 위 null 이 "조직 없음(명시)" 인지 "아직 안 정함" 인지 가른다.
          orgUnresolved: input.orgUnresolved ?? false,
        },
      },
    });
  } catch (error) {
    /* 🛑 삼키되 기록한다. 감사 실패가 업무 요청을 깨뜨리지 않지만,
     *   실패했다는 사실이 로그에 없으면 다음 조사가 이 자리를 의심하지 못한다. */
    console.error("[audit] 내구 감사 기록 실패:", {
      route: input.route,
      action: input.action,
      entityId: input.entityId,
      correlationId: input.correlationId,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
