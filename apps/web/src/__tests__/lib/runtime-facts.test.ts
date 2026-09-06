/**
 * §runtime-facts · §receiving-tx-metrics (호영님 2026-09-05, (A)) — 실패를 가르는 축.
 *
 * 왜 이 축들이 필요한가:
 *   P2028 이 났는데 **원인을 확정하지 못했다.** 가설 둘을 세워 둘 다 실측으로 반증했다.
 *     ① 트랜잭션 타임아웃 → 왕복 38ms · 13왕복 ≈ 494ms (5000ms 근처도 아니다)
 *     ② pgbouncer interactive tx 미지원 → 로컬에서 40쿼리까지 통과 (재현 실패)
 *   남은 관측은 `or was obtained before disconnecting` 뿐이고 커넥션 유실을 가리키지만
 *   근거가 없다. 이 축들이 있으면 **다음 실패 1회로** 두 방향이 갈린다.
 */

import { describe, it, expect } from "vitest";
import {
  TxMetricsCollector,
  describeTxMetrics,
} from "@/lib/inventory/receiving-tx-metrics";
import { readRuntimeFacts, describeRuntimeFacts } from "@/lib/runtime-facts";

describe("§receiving-tx-metrics — 왕복을 추정하지 않고 센다", () => {
  it("trip() 호출 수가 그대로 왕복 수다", () => {
    // 🔑 추정은 이번에 이미 틀렸다(13왕복 494ms 로 계산했는데 실패했다).
    const c = new TxMetricsCollector(4);
    c.trip();
    c.trip();
    c.trip(2);
    expect(c.snapshot().roundTrips).toBe(4);
  });

  it("분기별 라인 수를 따로 센다 (기존 3왕복 · 신규 4왕복)", () => {
    const c = new TxMetricsCollector(4);
    c.markExisting();
    c.markExisting();
    c.markExisting();
    c.markNew();
    const m = c.snapshot();
    expect(m.lines).toBe(4);
    expect(m.existingLines).toBe(3);
    expect(m.newLines).toBe(1);
  });

  it("경과 시간이 음수가 아니고 스냅샷마다 갱신된다", () => {
    const c = new TxMetricsCollector(1);
    expect(c.snapshot().elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it("사유 한 줄에 세 축이 전부 실린다", () => {
    const c = new TxMetricsCollector(4);
    c.markExisting();
    c.markNew();
    c.trip(9);
    const line = describeTxMetrics(c.snapshot());
    expect(line).toMatch(/tx=\d+ms/);
    expect(line).toMatch(/lines=4\(기존 1·신규 1\)/);
    expect(line).toMatch(/roundTrips=9/);
  });
});

describe("§runtime-facts — 실행 환경 축", () => {
  it("connection_limit·pgbouncer·포트를 URL 형태에서 읽는다", () => {
    const prev = process.env.DATABASE_URL;
    process.env.DATABASE_URL =
      "postgresql://u:p@aws-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require";
    const f = readRuntimeFacts();
    expect(f.connectionLimit).toBe(1);
    expect(f.pgbouncer).toBe(true);
    expect(f.dbPort).toBe(6543);
    process.env.DATABASE_URL = prev;
  });

  it("session pooler(5432·pgbouncer 없음)도 구분한다", () => {
    const prev = process.env.DATABASE_URL;
    process.env.DATABASE_URL =
      "postgresql://u:p@aws-1.pooler.supabase.com:5432/postgres?sslmode=require";
    const f = readRuntimeFacts();
    expect(f.dbPort).toBe(5432);
    expect(f.pgbouncer).toBe(false);
    expect(f.connectionLimit).toBeNull();
    process.env.DATABASE_URL = prev;
  });

  it("URL 이 없어도 던지지 않는다", () => {
    const prev = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    const f = readRuntimeFacts();
    expect(f.connectionLimit).toBeNull();
    expect(f.dbPort).toBeNull();
    expect(f.pgbouncer).toBe(false);
    process.env.DATABASE_URL = prev;
  });

  it("🛑 접속 문자열·자격증명을 싣지 않는다 (분류·형태만)", () => {
    const prev = process.env.DATABASE_URL;
    process.env.DATABASE_URL =
      "postgresql://postgres.abc:SUPERSECRET@host:6543/postgres?pgbouncer=true&connection_limit=1";
    const line = describeRuntimeFacts(readRuntimeFacts());
    expect(line).not.toMatch(/SUPERSECRET/);
    expect(line).not.toMatch(/postgres\.abc/);
    expect(line).not.toMatch(/postgresql:\/\//);
    process.env.DATABASE_URL = prev;
  });

  it("invocation 이 호출마다 늘어 콜드스타트를 판별한다", () => {
    const a = readRuntimeFacts().invocation;
    const b = readRuntimeFacts().invocation;
    expect(b).toBe(a + 1);
  });

  it("사유 한 줄에 판별 축이 전부 실린다", () => {
    const line = describeRuntimeFacts(readRuntimeFacts());
    for (const k of ["region=", "instanceAge=", "invocation=", "connLimit=", "pgbouncer=", "dbPort="]) {
      expect(line, `축 누락: ${k}`).toContain(k);
    }
  });
});
