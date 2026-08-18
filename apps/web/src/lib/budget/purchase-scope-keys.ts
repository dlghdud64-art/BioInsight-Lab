import { db } from "@/lib/db";

/**
 * §budget-scope-key-mismatch (프로덕션 실측 2026-08-18)
 *
 * 예산 사용액은 `PurchaseRecord.scopeKey == Budget.scopeKey` 로 집계한다.
 * 그런데 두 값이 서로 다른 키 공간이었다:
 *
 *   Budget.scopeKey          cmqp6tp92…  = organizationId   (예산 관리 화면이 씀)
 *   PurchaseRecord.scopeKey  cmqp6tpz8…  = workspaceId      (getScopeKey() 가 씀)
 *
 * 실측 결과 850,000원 구매가 기록됐는데 usedAmount 0 · remainingAmount 5,000,000 —
 * 지출이 영원히 0으로 잡혀 잔액이 실제보다 많아 보였다(과소 계상 방향).
 * UI 는 "차감 후 잔액 ₩4,150,000" 을 미리 보여주고 있었으므로 표시까지 거짓이었다.
 *
 * 해소: `Workspace.organizationId` 가 @unique(1:1) 이라 조직 → 워크스페이스가
 * 결정적으로 풀린다. 쓰기 경로(scopeKey 의 의미)는 건드리지 않고 **읽기 측에서만**
 * 같은 테넌트의 키를 모아 집계한다. 레코드 1건의 scopeKey 값은 하나뿐이라
 * OR 확장이 같은 레코드를 두 번 세지 않는다(이중 계상 없음).
 */
export async function resolveBudgetPurchaseScopeKeys(budget: {
  scopeKey: string;
  organizationId?: string | null;
  workspaceId?: string | null;
}): Promise<string[]> {
  const keys = new Set<string>();

  if (budget.scopeKey) {
    keys.add(budget.scopeKey);
    // 개인 예산 레거시 표기 `user-{userId}` → userId 도 후보.
    if (budget.scopeKey.startsWith("user-")) {
      keys.add(budget.scopeKey.slice("user-".length));
    }
  }
  if (budget.workspaceId) keys.add(budget.workspaceId);

  // 조직 예산 → 같은 조직의 workspaceId 를 후보에 추가(1:1).
  const orgId =
    budget.organizationId ??
    (budget.scopeKey && !budget.scopeKey.startsWith("user-") ? budget.scopeKey : null);
  if (orgId) {
    const workspace = await db.workspace.findUnique({
      where: { organizationId: orgId },
      select: { id: true },
    });
    if (workspace) keys.add(workspace.id);
  }

  return Array.from(keys);
}
