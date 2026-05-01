/**
 * §11.171 #operational-brief-injection-audit-log
 *
 * prompt injection 감지 시 AuditLog persistence — 보안 감사성 강화.
 *
 * 구현 정합:
 *   - createAuditLog (audit-logger.ts) 재사용 — graceful fail 패턴.
 *   - eventType: SETTINGS_CHANGED (existing enum 재사용, 신규 migration 회피).
 *     → 향후 INGESTION 패턴처럼 `OPERATIONAL_BRIEF_INJECTION_DETECTED` enum
 *     추가 트랙 (`#operational-brief-audit-event-type-add`) 으로 분리 가능.
 *   - entityType: "OperationalBriefNarrative" — entity 식별자.
 *   - action: "prompt_injection_detected" — Korean operator 친화 라벨링은 별도.
 *   - success: false — fitness fail 의미.
 *   - metadata: { pattern, factsKeys } — facts 값 자체는 PII 위험으로 미저장
 *     (key 이름과 매칭 패턴 name 만).
 *
 * Why fire-and-forget:
 *   - createAuditLog 자체가 graceful fail (catch + console.error)
 *   - lib/ai 가 db 에 동기 의존하지 않도록 격리 (성능 + circular import 회피)
 *   - audit log 실패해도 narrative 생성 동작 정상 — defense-in-depth
 */

import type { AuditEventType } from "@prisma/client";

interface InjectionAuditPayload {
  pattern: string;
  factsKeys: string[];
}

/**
 * Fire-and-forget injection audit log writer.
 *
 * dynamic import 패턴 — circular dependency + test-time db mock 회피.
 * 실패해도 caller 동작 영향 0 (silent catch).
 */
export async function logBriefInjectionAudit(payload: InjectionAuditPayload): Promise<void> {
  try {
    const { createAuditLog } = await import("@/lib/audit/audit-logger");
    await createAuditLog({
      eventType: "SETTINGS_CHANGED" as AuditEventType,
      entityType: "OperationalBriefNarrative",
      action: "prompt_injection_detected",
      success: false,
      errorMessage: "facts 에 prompt injection 패턴 감지 — LLM 호출 skip + deterministic fallback",
      metadata: {
        pattern: payload.pattern,
        factsKeys: payload.factsKeys,
        // facts 값 자체는 PII 위험 — 미저장. 운영자는 admin/audit 페이지 + console.warn 로 추적.
      },
    });
  } catch (err) {
    // silent — audit log 실패가 narrative 생성 동작 영향 0.
    console.warn("[operational-brief] injection audit log write 실패 (silent)", err);
  }
}
