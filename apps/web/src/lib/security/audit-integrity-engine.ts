/**
 * Audit Integrity Engine — **상태 해시만 남았다.**
 *
 * ── 2026-09-07 (가) 승인 · 메모리 감사 facade 제거 ──────────────────
 *
 * 원래 이 파일에는 append-only hash chain 이 있었다: `appendAuditEnvelope` 가 봉투를 만들어
 * 모듈 최상위 `let auditStore` 에 쌓고, `verifyAuditChain` 이 그 사슬의 무결성을 검증하는 구조.
 *
 * 🛑 그런데 그 체인이 지키던 대상이 **인스턴스 메모리**였다. 서버리스에서 요청이 끝나면
 *   사라진다. **사라지는 것을 위조 방지하는 것은 의미가 없다.**
 *   `verifyAuditChain` 호출 0은 그 결과지 원인이 아니다 — 검증할 가치가 없어서
 *   아무도 안 불렀다(호영님 2026-09-07).
 *
 * 실측 근거 (prod, 2026-09-07):
 *   `MutationAuditEvent` 1행(수기 보정) · `GovernanceAuditLog` 0 · `CanonicalAuditEvent` 0 ·
 *   `StabilizationAuditEvent` 0 · `IngestionAuditLog` 0 — 감사 테이블 5개가 전부 비어 있었다.
 *   `enforceAction` 을 쓰는 147개 라우트 중 `complete()` 를 부르는 116개의 기록이
 *   **존재한 적이 없다.**
 *
 * 같은 배치에서 `audit-persistence-adapter.ts` 도 제거했다 — `PrismaAuditAdapter` 가
 * 완성돼 있었으나 **외부 호출자가 0**이었다(`GovernanceAuditLog` 0행이 그 증거).
 * 인프라를 만들고 마지막 한 줄을 안 이은 세 번째 사례였다.
 *
 * 🔑 감사는 이제 `src/lib/audit/durable-audit.ts` 가 `MutationAuditEvent` 에 직접 남긴다
 *   (응답 경로 밖 · `waitUntil`). 계약은 `__tests__/regression/audit-durability.test.ts` 가 잠근다.
 *   구 SH15(append-only) · SH17(전후 상태 실캡처) 명제는 그리로 이관했다.
 *
 * 남긴 것은 `computeStateHash` 뿐이다 — 체인과 무관하게 상태 비교에 쓰인다.
 */

// ═══════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════

/**
 * 이벤트의 보안 등급. `event-provenance-engine` 이 분류에 쓴다.
 * (체인과 무관하므로 facade 제거 후에도 남는다.)
 */
export type SecurityClassification =
  | 'internal_only'
  | 'governance_restricted'
  | 'audit_evidence'
  | 'supplier_facing';

// ═══════════════════════════════════════════════════════
// Hash 함수 (브라우저/Node 양쪽 호환)
// ═══════════════════════════════════════════════════════

/**
 * 결정론적 해시 생성 — SHA-256 대체 (순수 JS)
 * 실제 production에서는 crypto.subtle.digest 사용 권장
 */
function computeHash(input: string): string {
  // DJB2 기반 확장 해시 — 충분히 결정적이면서 빠름
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = ((h1 ^ c) * 0x01000193) >>> 0;
    h2 = ((h2 ^ c) * 0x811c9dc5) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

/** 객체를 결정론적 문자열로 직렬화 (key 정렬) */
function deterministicStringify(obj: Record<string, unknown>): string {
  const sorted = Object.keys(obj).sort().reduce((acc, key) => {
    acc[key] = obj[key];
    return acc;
  }, {} as Record<string, unknown>);
  return JSON.stringify(sorted);
}

/** 상태 객체에서 해시 생성 — 같은 상태면 key 순서가 달라도 같은 값. */
export function computeStateHash(state: Record<string, unknown>): string {
  return computeHash(deterministicStringify(state));
}
