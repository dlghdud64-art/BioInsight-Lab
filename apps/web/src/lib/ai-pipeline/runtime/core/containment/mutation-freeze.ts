/**
 * S2 — Mutation Freeze
 *
 * containment 시작 시 active mutation 즉시 정지.
 * freeze 동안 read-only status refresh만 허용.
 */

let _mutationFrozen = false;

export function activateMutationFreeze(): void {
  _mutationFrozen = true;
}

export function deactivateMutationFreeze(): void {
  _mutationFrozen = false;
}

export function isMutationFrozen(): boolean {
  return _mutationFrozen;
}

/** write attempt 검사 — frozen이면 차단 */
export function guardWrite(operation: string): { allowed: boolean; reason: string } {
  if (_mutationFrozen) {
    return {
      allowed: false,
      reason: `MUTATION_FROZEN: write operation '${operation}' blocked during containment`,
    };
  }
  return { allowed: true, reason: "write allowed" };
}

/** 테스트용 */
export function _resetMutationFreeze(): void {
  _mutationFrozen = false;
}
