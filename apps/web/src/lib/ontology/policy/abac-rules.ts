/**
 * ABAC Rules — Future Extension Slot
 *
 * 속성 기반 접근 제어 규칙이 들어올 자리.
 *
 * 현재 비어 있음 (YAGNI). 미래에 다음과 같은 형태로 채울 예정:
 *
 *   export const ABAC_RULES: AbacRule[] = [
 *     {
 *       actionName: "FinalizeApproval",
 *       condition: (ctx) => ctx.targetAttributes?.amount < ctx.actorAttributes?.approvalLimit,
 *       reason: "승인 한도 초과",
 *     },
 *     {
 *       actionName: "ReceiveOrder",
 *       condition: (ctx) => ctx.environment?.tenantId === ctx.targetAttributes?.tenantId,
 *       reason: "다른 tenant 자원에 접근 불가",
 *     },
 *   ];
 *
 *   export function checkAbac(actionName: string, ctx: PolicyContext): AbacEvaluation { ... }
 *
 * 본 슬롯이 채워질 때, evaluatePolicy()가 본 모듈의 checkAbac을 위임 호출한다.
 * 호출 측 Action 코드는 변경되지 않는다.
 */

export {};
