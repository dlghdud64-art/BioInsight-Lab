/**
 * §scan-registration-reason (호영님 2026-09-04) — 500 사유 요약 unit.
 *
 * 배경: smart-receiving 의 catch-all 이 고정 문구만 반환해 `"OTHER" as ProductCategory`
 *       (존재하지 않는 enum 값)가 prod 에서 완전히 침묵했다. 신규 품목 등록 100% 실패.
 *       사유가 붙지 않으면 다음 실패도 같은 자리로 돌아온다.
 */

import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { describeFailure } from "@/lib/api-failure-reason";

describe("§scan-registration-reason — describeFailure", () => {
  it("Prisma known 에러는 코드와 위반 대상을 싣는다", () => {
    const err = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "5.22.0",
      meta: { target: ["organizationId", "productId"] },
    });
    const out = describeFailure(err);
    expect(out).toContain("P2002");
    expect(out).toContain("organizationId,productId");
  });

  it("Prisma validation 에러는 마지막 유의미 줄(원인)을 싣는다 — 이번 결함의 형태", () => {
    const err = new Prisma.PrismaClientValidationError(
      "Invalid `prisma.product.create()` invocation:\n\n\nInvalid value for argument `category`. Expected ProductCategory.",
      { clientVersion: "5.22.0" },
    );
    const out = describeFailure(err);
    expect(out).toContain("prisma validation");
    // 존재하지 않는 enum 값이 화면까지 도달해야 한다 — 이게 침묵을 깬다.
    expect(out).toContain("Expected ProductCategory");
  });

  it("평범한 Error 는 name 과 message 를 싣는다", () => {
    expect(describeFailure(new TypeError("x is not a function"))).toBe(
      "TypeError: x is not a function",
    );
  });

  it("Error 가 아닌 throw 도 문자열로 요약한다", () => {
    expect(describeFailure("boom")).toBe("boom");
    expect(describeFailure(null)).toBe("null");
  });

  it("길이 상한 — 300자 초과는 자른다(모달 문구 폭주 방지)", () => {
    const out = describeFailure(new Error("y".repeat(5000)));
    expect(out.length).toBeLessThanOrEqual(301);
    expect(out.endsWith("…")).toBe(true);
  });

  it("여러 줄·공백은 한 줄로 접는다", () => {
    const out = describeFailure(new Error("a\n\n  b   c\n"));
    expect(out).toBe("Error: a b c");
  });

  it("절대 throw 하지 않는다 — getter 가 터지는 객체도 삼킨다", () => {
    const hostile = {
      get message() {
        throw new Error("nope");
      },
    };
    expect(() => describeFailure(hostile)).not.toThrow();
  });
});
