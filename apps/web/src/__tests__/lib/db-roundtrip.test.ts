/**
 * §db-roundtrip (호영님 2026-09-06) — 왕복을 함수가 도는 자리에서 잰다.
 *
 * 왜: `/api/health` 의 `runtime.region` 이 **iad1**(미 동부)로 나왔고 DB 는 도쿄다.
 *   operator 가 한국에서 잰 38ms 로 "13왕복 494ms → 타임아웃 아님" 이라고 결론냈는데,
 *   그건 **서울↔도쿄** 왕복이었다. 판정에 필요한 건 iad1↔도쿄이고 거기서만 잴 수 있다.
 */

import { describe, it, expect } from "vitest";
import { measureDbRoundTrip } from "@/lib/health/db-roundtrip";

/** 호출마다 지정한 ms 만큼 지연하는 가짜 클라이언트. */
function fakeDb(delaysMs: number[]) {
  let i = 0;
  return {
    calls: 0,
    async $queryRawUnsafe() {
      const d = delaysMs[Math.min(i, delaysMs.length - 1)];
      i += 1;
      this.calls += 1;
      await new Promise((r) => setTimeout(r, d));
      return [{ "?column?": 1 }];
    },
  };
}

describe("§db-roundtrip — 표본을 여러 개 잡는다", () => {
  it("워밍업 1회를 버리고 3회를 잰다 (총 4회 호출)", async () => {
    // 🔑 첫 호출은 커넥션 확보가 섞인다 — 그 값을 넣으면 "왕복" 이 아닌 다른 걸 잰다.
    const db = fakeDb([0]);
    const r = await measureDbRoundTrip(db);
    expect(db.calls).toBe(4);
    expect(r.samples).toBe(3);
  });

  it("원값을 함께 싣는다 — 가공값만 믿지 않게", async () => {
    const r = await measureDbRoundTrip(fakeDb([0]));
    expect(Array.isArray(r.rawMs)).toBe(true);
    expect(r.rawMs).toHaveLength(3);
  });

  it("중앙값·최소·최대가 원값과 정합한다", async () => {
    const r = await measureDbRoundTrip(fakeDb([0]));
    const sorted = [...r.rawMs].sort((a, b) => a - b);
    expect(r.minMs).toBe(sorted[0]);
    expect(r.maxMs).toBe(sorted[sorted.length - 1]);
    expect(r.medianMs).toBe(sorted[1]);
  });

  it("순간 지연이 섞이면 min/max 로 드러난다 (1회 판정 금지의 근거)", async () => {
    // 워밍업 버림 → 실제 표본은 [10, 90, 10].
    const r = await measureDbRoundTrip(fakeDb([0, 10, 90, 10]));
    expect(r.maxMs).toBeGreaterThanOrEqual(r.minMs);
    // 중앙값이 최대값에 끌려가지 않는다 — 그게 중앙값을 쓰는 이유다.
    expect(r.medianMs).toBeLessThan(r.maxMs);
  });
});

describe("§db-roundtrip — 실패를 지어내지 않는다", () => {
  it("쿼리가 던지면 error 를 싣고 수치는 -1 (0 이 아니다)", async () => {
    const r = await measureDbRoundTrip({
      async $queryRawUnsafe() {
        throw new Error("connection refused");
      },
    });
    expect(r.error).toContain("connection refused");
    // 🛑 0 으로 두면 "왕복 0ms" 라는 거짓이 된다. -1 은 측정 실패다.
    expect(r.medianMs).toBe(-1);
    expect(r.minMs).toBe(-1);
    expect(r.maxMs).toBe(-1);
  });

  it("성공이면 error 는 null", async () => {
    const r = await measureDbRoundTrip(fakeDb([0]));
    expect(r.error).toBeNull();
  });

  it("중간에 끊겨도 그때까지의 표본 수를 정직하게 보고한다", async () => {
    let n = 0;
    const r = await measureDbRoundTrip({
      async $queryRawUnsafe() {
        n += 1;
        if (n > 2) throw new Error("dropped");
        return [];
      },
    });
    expect(r.error).toContain("dropped");
    expect(r.samples).toBe(r.rawMs.length);
  });
});
