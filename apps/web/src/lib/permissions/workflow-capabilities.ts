/**
 * §11.193d Phase 2 #workflow-capabilities
 *
 * 1인 운영자가 동시에 여러 workflow capability 를 보유 가능하도록 하는
 * canonical helper. 기존 `OrganizationRole` (RBAC) 과 별도 layer 로 운영
 * tag 추가 — RBAC permission-checker 변경 0.
 *
 * 호영님 prototype 시안: "Lab Manager + Approver + Requester 동시 보유".
 *
 * 데이터 layer:
 *   - canonical: `OrganizationMember.workflowCapabilities Json` (DB)
 *   - whitelist: 본 모듈 의 `WORKFLOW_CAPABILITIES` const
 *   - resolver: `resolveWorkflowCapabilities(member)` (Phase 2.2 추가, role 기반 fallback)
 *
 * 매핑 (Phase 2.2 backfill 기준):
 *   - ADMIN → ["LAB_MANAGER"]
 *   - OWNER → ["LAB_MANAGER", "APPROVER"]
 *   - APPROVER → ["APPROVER"]
 *   - REQUESTER → ["REQUESTER"]
 *   - VIEWER → []
 *
 * lock §11.142 정합:
 *   - canonical truth = DB column (변경 시 mutation 필수)
 *   - raw key 노출 0 (settings UI 는 라벨 매핑 거쳐 표시)
 *   - permission-checker 변경 0 (RBAC layer 분리)
 */

/** workflow capability 3종 enum (시안 정합). */
export const WORKFLOW_CAPABILITIES = [
  "LAB_MANAGER",
  "APPROVER",
  "REQUESTER",
] as const;

/** WORKFLOW_CAPABILITIES 의 union type. */
export type WorkflowCapability = (typeof WORKFLOW_CAPABILITIES)[number];

/** runtime whitelist check 용 Set (filter 효율). */
const CAPABILITY_SET: ReadonlySet<string> = new Set(WORKFLOW_CAPABILITIES);

/**
 * member 의 workflow capabilities 추출 (defensive parse).
 *
 * - DB Json column 이라 array / null / object / string 등 어떤 값이든 들어올
 *   수 있으므로 type guard + whitelist filter 필수.
 * - 비-whitelist 값은 filter (raw key 노출 차단).
 * - array 가 아니면 빈 배열 fallback.
 *
 * Phase 2.2 의 `resolveWorkflowCapabilities` 는 본 함수 결과가 빈 배열 시
 * `member.role` 기반 fallback derive (별도 모듈).
 */
export function getWorkflowCapabilities(member: {
  workflowCapabilities?: unknown;
}): WorkflowCapability[] {
  const raw = member.workflowCapabilities;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (v): v is WorkflowCapability =>
      typeof v === "string" && CAPABILITY_SET.has(v),
  );
}

/**
 * capability 별 한국어 라벨 (settings UI + organizations 멤버 dialog 공통).
 *
 * §11.193d Phase 3 — CLAUDE.md "visible label 한국어 정합" + "raw enum 노출 0"
 * 강제 정합. 영문 ("Lab Manager / Approver / Requester") 였던 §11.193d
 * Phase 2.3 톤을 한국어로 swap. settings page multi-badge 가 본 LABEL 을
 * canonical source 로 사용하므로 자동 반영 (코드 변경 0).
 */
export const WORKFLOW_CAPABILITY_LABEL: Record<WorkflowCapability, string> = {
  LAB_MANAGER: "운영 책임자",
  APPROVER: "승인자",
  REQUESTER: "요청자",
};

/**
 * capability 별 badge 색상 (settings UI multi-badge 색상 정합).
 * §11.197 — 시안 정합 톤 (Lab Manager blue / Requester amber / Approver
 * emerald). 이전 §11.193d 톤 (LAB_MANAGER purple / REQUESTER blue) →
 * 시안 prototype 정합으로 swap. 시각 hierarchy: blue (운영 책임자) /
 * amber (요청자, 주의 톤) / emerald (승인 권한, 안정 톤).
 */
export const WORKFLOW_CAPABILITY_BADGE_CLS: Record<WorkflowCapability, string> = {
  LAB_MANAGER: "bg-blue-50 text-blue-700 border-blue-200",
  APPROVER: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REQUESTER: "bg-yellow-50 text-yellow-700 border-yellow-200",
};

/**
 * §11.193d Phase 2.2 — OrganizationRole → 자동 mirror capabilities.
 *
 * 기존 single-role member 가 backfill 받기 전이거나, role 변경 직후라
 * workflowCapabilities 가 비어있을 때 안전 fallback. 매핑은 시안 정합.
 */
export const ROLE_TO_CAPABILITIES_FALLBACK: Record<string, WorkflowCapability[]> = {
  ADMIN: ["LAB_MANAGER"],
  OWNER: ["LAB_MANAGER", "APPROVER"],
  APPROVER: ["APPROVER"],
  REQUESTER: ["REQUESTER"],
  VIEWER: [],
  // legacy MEMBER (운영 중인 enum 외 값) — 빈 배열 (보수적)
  MEMBER: [],
};

/**
 * §11.193d Phase 2.2 — canonical resolver.
 *
 * 우선순위:
 *   1. DB Json column (`getWorkflowCapabilities` 결과) — non-empty 시 그대로
 *   2. role 기반 자동 mirror (`ROLE_TO_CAPABILITIES_FALLBACK`)
 *   3. 빈 배열 (모든 fallback 누락 시)
 *
 * Phase 2.2 backfill script 실행 후엔 대부분 (1) 경로 — (2) 는 누락 안전망.
 */
export function resolveWorkflowCapabilities(member: {
  workflowCapabilities?: unknown;
  role?: string | null;
}): WorkflowCapability[] {
  // (1) DB 우선
  const fromDb = getWorkflowCapabilities(member);
  if (fromDb.length > 0) return fromDb;

  // (2) role 기반 fallback
  if (member.role && ROLE_TO_CAPABILITIES_FALLBACK[member.role]) {
    return [...ROLE_TO_CAPABILITIES_FALLBACK[member.role]];
  }

  // (3) 빈 배열
  return [];
}
