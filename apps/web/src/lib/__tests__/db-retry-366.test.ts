/**
 * §11.366-server (RED→GREEN) — cold-start transient DB 재시도 래퍼
 *
 * 증상: 대시보드 첫 진입 시 cold-start Prisma transient(연결 미준비)로 stats 500.
 *   "다시 시도" 1회로 성공(cold→warm). 401 은 클라 enabled 가드로 이미 배제.
 *
 * Fix: stats early count Promise.all 을 transient(P1001/P1017/P2024) 한정 1회
 *   재시도로 감싸 첫 connection 실패를 서버가 흡수. non-transient 는 즉시 전파
 *   (무한 재시도·에러 은폐 금지). 클라 retry·스켈레톤 상한은 불변.
 *
 * 순수 로직 단위 테스트(클로드코드 vitest 실행). sandbox 는 @rollup 부재로 실행 불가.
 */
import { describe, it, expect, vi } from "vitest";
import { withDbRetry, isTransientDbError } from "../db-retry";

function prismaErr(code: string): Error {
  const e = new Error(`prisma ${code}`) as Error & { code: string };
  e.code = code;
  return e;
}

describe("§11.366 — isTransientDbError 화이트리스트", () => {
  it("P1001/P1017/P2024 는 transient", () => {
    expect(isTransientDbError(prismaErr("P1001"))).toBe(true);
    expect(isTransientDbError(prismaErr("P1017"))).toBe(true);
    expect(isTransientDbError(prismaErr("P2024"))).toBe(true);
  });

  it("non-transient(P2002 unique 등)·일반 에러는 false", () => {
    expect(isTransientDbError(prismaErr("P2002"))).toBe(false);
    expect(isTransientDbError(new Error("validation"))).toBe(false);
    expect(isTransientDbError(null)).toBe(false);
  });
});

describe("§11.366 — withDbRetry transient 1회 재시도", () => {
  it("첫 시도 P1001 실패 → 1회 재시도 후 성공값 반환", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(prismaErr("P1001"))
      .mockResolvedValueOnce("ok");
    const result = await withDbRetry(fn, { retries: 1, delayMs: 0 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("non-transient(P2002) 는 즉시 전파(재시도 0)", async () => {
    const fn = vi.fn().mockRejectedValue(prismaErr("P2002"));
    await expect(withDbRetry(fn, { retries: 1, delayMs: 0 })).rejects.toMatchObject({
      code: "P2002",
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("transient 가 retries 초과로 지속되면 throw(무한 재시도 금지)", async () => {
    const fn = vi.fn().mockRejectedValue(prismaErr("P1017"));
    await expect(withDbRetry(fn, { retries: 1, delayMs: 0 })).rejects.toMatchObject({
      code: "P1017",
    });
    expect(fn).toHaveBeenCalledTimes(2); // 최초 1 + 재시도 1
  });

  it("정상 경로는 재시도 없이 1회 호출", async () => {
    const fn = vi.fn().mockResolvedValue(42);
    const result = await withDbRetry(fn, { retries: 1, delayMs: 0 });
    expect(result).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
