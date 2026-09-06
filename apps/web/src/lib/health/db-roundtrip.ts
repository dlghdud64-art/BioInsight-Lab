/**
 * §db-roundtrip (호영님 2026-09-06) — 왕복을 **함수가 도는 자리에서** 잰다.
 *
 * 왜 이 축이 필요한가:
 *   `/api/health` 의 `runtime.region` 이 **`iad1`(미국 동부)** 로 나왔다. DB 는
 *   Supabase `aws-1-ap-northeast-1`(도쿄)이다. 함수와 DB 사이에 태평양이 있다.
 *
 *   🛑 operator 가 잰 38ms(서울 → 도쿄 · 로컬, 2026-09-05)는 **이 판정에 쓸 수 없다.** 그 값으로
 *   "13왕복 494ms → 타임아웃 아님" 이라고 결론냈는데, 그건 서울↔도쿄 왕복이었다.
 *   판정에 필요한 것은 iad1↔도쿄 왕복이고, 그건 거기서만 잴 수 있다.
 *
 * 판정 기준(호영님):
 *   150ms 이상이면 P2028 원인 확정 — 13왕복 × 175ms ≈ 2.3초에 콜드스타트·순간 지연이
 *   겹치면 5초를 넘는다. 그때 처방은 **코드가 아니라 배포 리전**이다.
 *
 * 🛑 1회 측정으로 판정하지 않는다. 순간 지연이 섞이면 한 번의 값이 전체를 대표하지 못한다
 *   (오늘 `unknownCount` 를 1회로 읽고 11분을 헛돈 것과 같은 형태).
 *   표본을 여러 개 잡고 **중앙값과 함께 원값도** 싣는다.
 */

export interface DbRoundTrip {
  /** 표본 개수. */
  samples: number;
  /** 중앙값 ms — 판정에 쓰는 값. */
  medianMs: number;
  /** 최소·최대 — 순간 지연이 섞였는지 본다. */
  minMs: number;
  maxMs: number;
  /** 원값 전부. 가공값만 믿지 않게 함께 싣는다. */
  rawMs: number[];
  /** 측정 실패 시 사유. 성공이면 null — 값을 지어내지 않는다. */
  error: string | null;
}

/** `SELECT 1` 한 번을 실행할 수 있는 최소 클라이언트. */
export interface RoundTripClient {
  $queryRawUnsafe(query: string): Promise<unknown>;
}

const SAMPLES = 3;

/**
 * `SELECT 1` 왕복을 여러 번 재고 요약한다.
 *
 * 첫 호출은 커넥션 확보가 섞일 수 있어 **워밍업 1회를 버린다** — 그 값을 넣으면
 * 중앙값이 커넥션 비용까지 포함해 "왕복" 이 아닌 다른 것을 재게 된다.
 */
export async function measureDbRoundTrip(
  db: RoundTripClient,
): Promise<DbRoundTrip> {
  const rawMs: number[] = [];
  try {
    await db.$queryRawUnsafe("SELECT 1"); // 워밍업 — 버린다
    for (let i = 0; i < SAMPLES; i++) {
      const t0 = Date.now();
      await db.$queryRawUnsafe("SELECT 1");
      rawMs.push(Date.now() - t0);
    }
  } catch (err) {
    return {
      samples: rawMs.length,
      medianMs: -1,
      minMs: -1,
      maxMs: -1,
      rawMs,
      error: err instanceof Error ? err.message.slice(0, 120) : String(err).slice(0, 120),
    };
  }
  const sorted = [...rawMs].sort((a, b) => a - b);
  return {
    samples: sorted.length,
    medianMs: sorted[Math.floor(sorted.length / 2)],
    minMs: sorted[0],
    maxMs: sorted[sorted.length - 1],
    rawMs,
    error: null,
  };
}
