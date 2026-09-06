/**
 * §receiving-tx-metrics (호영님 2026-09-05, (A)) — 트랜잭션이 얼마나 걸렸는지 말한다.
 *
 * 사고: 4품목 등록이 P2028 로 실패했는데 화면은 코드만 보여줬다.
 *   **얼마나 걸렸는지는 말해주지 않았다.** 그래서 가설 둘을 세워 둘 다 반증됐다.
 *
 * 🛑 계측이 (B)(C)(D) 보다 먼저다(호영님). 계측 없이 timeout 을 올리면
 *   올린 게 먹었는지도 모른다 — `finishReason` 때와 같은 자리다.
 */

export interface TxMetrics {
  /** 트랜잭션 진입부터 실패/완료까지 ms. */
  elapsedMs: number;
  /** 처리 대상 라인 수. */
  lines: number;
  /** 기존 재고 증가 라인(분기 A) 수 — 라인당 3왕복. */
  existingLines: number;
  /** 신규 품목 라인(분기 B) 수 — 라인당 4왕복(+감사 1회는 배치). */
  newLines: number;
  /** 실제로 발행한 DB 왕복 수(감사 배치 포함). */
  roundTrips: number;
}

/** 왕복 수를 **세지 말고 계산하지 말고** 실제로 센다 — 추정은 이번에 이미 틀렸다. */
export class TxMetricsCollector {
  private readonly startedAt = Date.now();
  private trips = 0;
  private existing = 0;
  private added = 0;

  constructor(private readonly lines: number) {}

  /** DB 왕복 1회 기록. 쓰기 직전에 부른다. */
  trip(n = 1): void {
    this.trips += n;
  }

  markExisting(): void {
    this.existing += 1;
  }

  markNew(): void {
    this.added += 1;
  }

  snapshot(): TxMetrics {
    return {
      elapsedMs: Date.now() - this.startedAt,
      lines: this.lines,
      existingLines: this.existing,
      newLines: this.added,
      roundTrips: this.trips,
    };
  }
}

/** 실패 사유에 덧붙일 한 줄. */
export function describeTxMetrics(m: TxMetrics): string {
  return [
    `tx=${m.elapsedMs}ms`,
    `lines=${m.lines}(기존 ${m.existingLines}·신규 ${m.newLines})`,
    `roundTrips=${m.roundTrips}`,
  ].join(" · ");
}
