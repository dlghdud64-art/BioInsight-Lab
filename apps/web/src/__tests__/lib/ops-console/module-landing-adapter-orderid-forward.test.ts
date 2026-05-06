/**
 * §11.211 module-landing-adapter orderId forward — DEPRECATED
 * (Path V swap, 2026-05-06)
 *
 * Path V 채택: ActionableRow 안 useQuery 로 orderId resolve.
 * module-landing-adapter 변경 0. 본 test 는 deprecated.
 * host 측 `git rm` 으로 삭제 권장.
 */

import { describe, it, expect } from "vitest";

describe.skip("§11.211 module-landing-adapter orderId forward (DEPRECATED — Path V swap)", () => {
  it("Path V swap — useQuery 검증은 po-actionable-row-orderid-mutation.test.ts 로 이동", () => {
    expect(true).toBe(true);
  });
});
