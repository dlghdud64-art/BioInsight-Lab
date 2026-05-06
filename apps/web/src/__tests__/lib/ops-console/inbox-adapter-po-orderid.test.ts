/**
 * §11.211 #post-approval-purchase-order-flow inbox PO orderId resolve —
 * DEPRECATED (Path V swap, 2026-05-06)
 *
 * 원래 계획: inbox-adapter 가 db.order.findUnique lookup 후 orderId
 * field populate. 하지만 caller chain (operational-brief/popup.tsx 가
 * client component, scenario-transition-runner 도 sync) 이 client
 * sync 패턴 → inbox-adapter 를 async + db import 로 전환 시 client
 * component 깨짐.
 *
 * Path V 채택 (호영님 결정 2026-05-06): inbox-adapter 변경 0. 발주
 * 관리 page 의 ActionableRow 안 useQuery 로 `/api/orders/{entityId}`
 * 호출 → orderId resolve. 4~5 row scope 이라 N+1 위험 0 (React Query
 * 캐시 정합).
 *
 * 본 파일은 deprecated. host 측에서 `git rm` 으로 삭제 권장.
 * 잠정 describe.skip 처리하여 test 무력화 (sandbox unlink 권한 0).
 */

import { describe, it, expect } from "vitest";

describe.skip("§11.211 inbox-adapter PO builder orderId resolve (DEPRECATED — Path V swap)", () => {
  it("Path V swap — useQuery 검증은 po-actionable-row-orderid-mutation.test.ts 로 이동", () => {
    expect(true).toBe(true);
  });
});
