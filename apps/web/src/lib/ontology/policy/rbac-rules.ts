/**
 * RBAC Rules — Future Extension Slot
 *
 * 역할 기반 접근 제어 규칙이 들어올 자리.
 *
 * 현재 비어 있음 (YAGNI). 미래에 다음과 같은 형태로 채울 예정:
 *
 *   export const RBAC_RULES: RbacRule[] = [
 *     { actionName: "FinalizeApproval", allowedRoles: ["approver", "admin"] },
 *     { actionName: "ReceiveOrder",     allowedRoles: ["receiver", "admin"] },
 *   ];
 *
 *   export function checkRbac(actionName: string, actorRole: string | null): boolean { ... }
 *
 * 본 슬롯이 채워질 때, evaluatePolicy()가 본 모듈의 checkRbac을 위임 호출한다.
 * 호출 측 Action 코드는 변경되지 않는다.
 */

export {};
