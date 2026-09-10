/**
 * §entity-type-canonical (호영님 2026-09-10) —
 * **`ActivityLog` · `AuditLog` 의 `entityType` 정본 집합.**
 *
 * ── 왜 필요한가 (prod 실측 2026-09-10) ──
 *
 * 두 테이블의 `entityType` 은 스키마에서 **`String`** 이라 아무 문자열이나 들어간다.
 * 그 결과 같은 개념이 두 표기로 쌓였다:
 * ```
 * ActivityLog  quote=30 · QUOTE=5 · order=2 · ORDER=2 · INVENTORY=5
 * AuditLog     ORDER=3 · QUOTE=1 · OrganizationMember=1
 * ```
 * 그런데 읽는 쪽은 **정확 일치**로 거른다(`api/activity-logs` GET: `where.entityType = q`).
 * → `entityType === "QUOTE"` 로 조회하면 35건 중 **5건만** 잡힌다.
 *   활동 피드·감사 조회가 조용히 6/7 을 버린다. 이건 잠복이 아니라 지금 동작하는 결함이다.
 *
 * ── 정본 표기를 대문자 SCREAMING_SNAKE 로 정한 근거 (취향 아님) ──
 *
 * 세 감사 테이블 중 **`DataAuditLog` 은 이미 enum(`AuditEntityType`)으로 강제**되고 있고
 * 그 도메인이 전부 대문자다. 그래서 그 테이블만 데이터가 깨끗하다
 * (`INVENTORY_RESTOCK` · `INSPECTION` · `QUOTE_STATUS` — 소문자 0).
 * 나머지 둘이 `String` 이라 갈렸다. **이미 있는 정본을 따른다.**
 *
 * 🛑 그 enum 을 그대로 재사용하지 않는 이유: 도메인이 다르다.
 *   `ActivityLog` 은 `ORGANIZATION_VENDOR` · `PRODUCT` · `ANALYTICS_EVENT` 처럼
 *   `AuditEntityType` 에 없는 값을 쓴다. 없는 값을 억지로 enum 에 밀어 넣으면
 *   `DataAuditLog` 의 도메인이 오염된다. **표기 규칙만 승계하고 집합은 따로 둔다.**
 *
 * 🔑 이 파일은 **집합**을 소유한다. 데이터 소급 보정(기존 행의 소문자 표기)은
 *   별건 DML 이며 호영님 승인 사안이다 — 코드가 먼저다. 코드를 안 고치고 데이터만
 *   고치면 다음 행부터 다시 갈린다(호영님 2026-09-10 순서 지시).
 */

/** 정본 표기 — 추가할 때도 SCREAMING_SNAKE 를 지킨다. */
export const ACTIVITY_ENTITY_TYPES = [
  "AI_ACTION",
  "ANALYTICS_EVENT",
  "BUDGET",
  "INSPECTION",
  "INVENTORY",
  "INVENTORY_RESTOCK",
  "INVENTORY_USE",
  "ORDER",
  "ORGANIZATION",
  "ORGANIZATION_MEMBER",
  "ORGANIZATION_VENDOR",
  "ORGANIZATION_VENDOR_PRODUCT",
  "PRODUCT",
  /* §operations 도메인 — `lib/operations/state-definitions.ts` 의 `OperationDomain` 이
   *   이미 대문자로 정의해 둔 값이다. tsc 가 이 둘의 부재를 잡아냈다(리터럴 스캔은 못 봤다 —
   *   `logStateTransition` 이 `params.domain` 을 그대로 넘기는 **동적 경로**라서다). */
  "PURCHASE",
  "PURCHASE_REQUEST",
  "RECEIVING",
  "QUOTE",
  "QUOTE_RESPONSE",
  "QUOTE_STATUS",
  "SETTINGS",
  "USER",
  "WORKSPACE",
  "WORKSPACE_MEMBER",
] as const;

export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number];

const CANONICAL = new Set<string>(ACTIVITY_ENTITY_TYPES);

/** 정본 집합에 속하는가. 요청 body 유래 값은 저장 **전에** 이걸 통과해야 한다. */
export function isActivityEntityType(v: unknown): v is ActivityEntityType {
  return typeof v === "string" && CANONICAL.has(v);
}

/**
 * 표기만 다른 옛 값을 정본으로 옮긴다 — **읽기 보조**이지 저장 경로가 아니다.
 *
 * 🛑 이 함수를 쓰기 경로에 두지 말 것. 그러면 아무 문자열이나 대문자로 바뀌어
 *   들어가고, 집합 강제가 사라진다(정규화가 검증을 대신하는 형태).
 *   저장은 `isActivityEntityType` 로 **거절**하고, 이건 기존 행을 조회할 때만 쓴다.
 */
export function canonicalizeEntityType(v: string): ActivityEntityType | null {
  const upper = v.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();
  return CANONICAL.has(upper) ? (upper as ActivityEntityType) : null;
}
