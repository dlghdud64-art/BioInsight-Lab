/**
 * Policy Engine — Future Extension Slot
 *
 * 목적:
 *   권한 관리(RBAC / ABAC / ReBAC)를 지금 당장 구현하지 않고, 미래에 코어 Action을
 *   수정하지 않은 채로 정책 엔진만 갈아끼울 수 있도록 **슬롯만** 열어두는 모듈.
 *
 * YAGNI 원칙:
 *   본 모듈은 실제 정책 평가 로직을 가지지 않는다. 현재 호출되면 항상
 *   `{ allowed: true }`를 반환한다. 나중에 RBAC/ABAC/ReBAC 엔진이 들어올 때,
 *   본 함수의 시그니처만 유지한 채 내부 구현만 교체하면 된다.
 *
 * 고정 규칙:
 * 1. 본 모듈은 canonical truth를 흔들지 않는다. read-only evaluator.
 * 2. Action 본체는 본 함수의 시그니처에만 의존해야 한다. 내부 구현 변경 시
 *    Action 코드는 수정 없이 계속 동작해야 한다.
 * 3. 호출이 실패하면(예: 미래의 정책 엔진이 throw) Action은 conservative하게
 *    거부 처리한다. 본 dummy는 실패하지 않으므로 현재 시점에는 무영향.
 * 4. 본 모듈은 deterministic + side-effect-free여야 한다 (정책 평가는 audit 가능).
 * 5. 기존의 하드코딩된 가드레일(예: SoD, 예산 잔액)은 본 슬롯이 아니라
 *    Action 본체의 precondition 검사에 그대로 둔다. 본 슬롯은 그 위에
 *    추가 정책 레이어를 얹기 위한 자리일 뿐이다.
 *
 * 호출 위치:
 *   현재 wiring된 Action:
 *   - executeFinalizeApproval (cross-object-actions.ts)
 *   - executeReceiveOrder (cross-object-actions.ts)
 *
 *   추가 wiring 시에도 동일한 패턴 사용:
 *     const policy = await evaluatePolicy("ActionName", { ...context });
 *     if (!policy.allowed) return precondition_fail;
 */

// ══════════════════════════════════════════════════════════════════════════════
// Public Types — 본 시그니처는 안정 contract
// ══════════════════════════════════════════════════════════════════════════════

/**
 * 정책 평가 대상 Action 이름.
 * 미래에 enum으로 강타입화할 수 있도록 string으로 시작.
 */
export type PolicyActionName = string;

/**
 * 정책 평가에 필요한 컨텍스트.
 *
 * 미래의 RBAC: subject(user role) + object(target role/scope)
 * 미래의 ABAC: subject attributes + object attributes + environment
 * 미래의 ReBAC: subject ↔ object relation graph
 *
 * 현재는 모든 필드 optional. caller가 가용한 만큼만 채우면 된다.
 */
export interface PolicyContext {
  /** 행위 주체 (사용자/시스템 actor 식별자) */
  actor?: string | null;
  /** 행위 주체의 role (RBAC) */
  actorRole?: string | null;
  /** 행위 주체의 attributes (ABAC) */
  actorAttributes?: Record<string, unknown>;
  /** 대상 객체 식별자 (PO/Quote/Inventory id 등) */
  targetObjectId?: string | null;
  /** 대상 객체 type (OntologyObjectType) */
  targetObjectType?: string | null;
  /** 대상 객체의 attributes (ABAC) */
  targetAttributes?: Record<string, unknown>;
  /** 환경 컨텍스트 (시각, IP, tenant 등 — ABAC) */
  environment?: Record<string, unknown>;
}

/**
 * 정책 평가 결과.
 *
 * 미래의 정책 엔진이 채울 필드들:
 * - matchedRule: 어느 RBAC/ABAC 규칙이 적용되었는지 (audit 추적)
 * - reason: 사용자 노출 가능한 한국어 거부 사유
 * - severity: hard(차단) vs soft(경고만)
 *
 * 현재 dummy는 항상 { allowed: true, matchedRule: "dummy_allow_all" }.
 */
export interface PolicyEvaluationResult {
  allowed: boolean;
  /** 적용된 규칙 이름 (audit용) */
  matchedRule: string;
  /** 거부 사유 (사용자 노출용) */
  reason: string | null;
  /** 차단 강도 — hard는 즉시 차단, soft는 경고만 */
  severity: "hard" | "soft" | "none";
}

// ══════════════════════════════════════════════════════════════════════════════
// Dummy Evaluator — 현재 구현
// ══════════════════════════════════════════════════════════════════════════════

/**
 * 정책 평가 — 현재는 항상 허용.
 *
 * 이 함수는 실제 정책 로직을 가지지 않는다. 미래에 RBAC/ABAC/ReBAC 엔진이
 * 도입될 때, 이 함수의 본문만 교체하면 모든 호출 지점이 자동으로 새 정책을 따른다.
 *
 * **시그니처 안정성**: 본 함수의 입출력 contract는 향후에도 유지되어야 한다.
 * 새 필드는 PolicyContext에 optional로만 추가하고, 기존 필드 의미를 변경하지 않는다.
 *
 * @param actionName  실행하려는 Action 이름 (예: "FinalizeApproval", "ReceiveOrder")
 * @param context     평가 컨텍스트 (subject/object/environment)
 * @returns           평가 결과 — 현재는 항상 allowed=true
 */
export async function evaluatePolicy(
  actionName: PolicyActionName,
  context: PolicyContext,
): Promise<PolicyEvaluationResult> {
  // YAGNI: 실제 정책 엔진은 미래에 도입.
  // 현재는 모든 호출을 통과시키되, 시그니처 contract만 안정적으로 유지한다.
  //
  // 호출 측은 이 결과의 `allowed` 플래그만 확인하면 되며, 미래에
  // RBAC/ABAC/ReBAC 규칙이 들어오면 본 함수 본체만 교체한다.
  //
  // 호출 측 코드 변경 없이 정책 엔진을 갈아끼우기 위한 슬롯이다.
  void actionName;
  void context;

  return {
    allowed: true,
    matchedRule: "dummy_allow_all",
    reason: null,
    severity: "none",
  };
}

/**
 * 동기 버전 — 미래의 캐시된 정책 결정용 슬롯.
 *
 * 일부 호출 지점은 await 없는 동기 검사가 필요할 수 있다 (UI guard 등).
 * 본 동기 슬롯도 contract만 잡고 현재는 항상 허용.
 */
export function evaluatePolicySync(
  actionName: PolicyActionName,
  context: PolicyContext,
): PolicyEvaluationResult {
  void actionName;
  void context;

  return {
    allowed: true,
    matchedRule: "dummy_allow_all",
    reason: null,
    severity: "none",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 향후 슬롯 — 현재 빈 모듈을 re-export만 한다 (구현 시 본 슬롯에 채움)
// ══════════════════════════════════════════════════════════════════════════════

export * from "./rbac-rules";
export * from "./abac-rules";
