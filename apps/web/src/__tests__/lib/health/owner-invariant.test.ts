/**
 * §org-create-limit — 조직 소유권 데이터 불변식 단언 (호영님 지시 2026-08-29).
 *
 * 🛑 주석은 발화하지 않는다. OWNER 필터의 안전은 코드가 아니라 prod 데이터 상태가
 *   보증하고 있었다 — 2026-08-29 실측이 OWNER 4 · ADMIN 0 인 것은 백필이 돌았기
 *   때문이고, 백업 복원 · 다른 환경 · 수동 삽입 어느 쪽도 되살린다.
 */

import { describe, it, expect, vi } from "vitest";
import {
  evaluateOwnerInvariant,
  probeOwnerlessOrganizations,
} from "@/lib/health/owner-invariant";

const client = (impl: () => Promise<unknown>) =>
  ({ $queryRawUnsafe: vi.fn(impl) }) as unknown as Parameters<
    typeof probeOwnerlessOrganizations
  >[0];

describe("§org-create-limit — OWNER 0인 조직 = 0 불변식", () => {
  it("순수 판정 — 0이면 성립, 1 이상이면 깨진다", () => {
    expect(evaluateOwnerInvariant(0)).toBe(true);
    expect(evaluateOwnerInvariant(1)).toBe(false);
    expect(evaluateOwnerInvariant(42)).toBe(false);
  });

  it("ownerless 0 → clean", async () => {
    const r = await probeOwnerlessOrganizations(client(async () => [{ n: 0 }]));
    expect(r).toMatchObject({ ok: true, ownerlessCount: 0, clean: true });
  });

  it("🛑 ownerless 1+ → clean false (한도가 풀리는 방향으로 뒤집힌 상태)", async () => {
    const r = await probeOwnerlessOrganizations(client(async () => [{ n: 3 }]));
    expect(r).toMatchObject({ ok: true, ownerlessCount: 3, clean: false });
  });

  it("bigint COUNT 도 수로 정규화한다", async () => {
    const r = await probeOwnerlessOrganizations(client(async () => [{ n: BigInt(2) }]));
    expect(r).toMatchObject({ ownerlessCount: 2, clean: false });
  });

  it("DB 도달 실패는 clean 을 참칭하지 않는다 — reachable false", async () => {
    const r = await probeOwnerlessOrganizations(
      client(async () => {
        throw new Error("connect ECONNREFUSED");
      })
    );
    expect(r).toMatchObject({ ok: false, reachable: false });
    expect(r).not.toHaveProperty("clean");
  });

  it("빈 결과셋을 0으로 읽지만 ok 는 유지 (행 없음 = 위반 없음)", async () => {
    const r = await probeOwnerlessOrganizations(client(async () => []));
    expect(r).toMatchObject({ ok: true, ownerlessCount: 0, clean: true });
  });

  it("쿼리가 OWNER 역할로 NOT EXISTS 를 건다", async () => {
    const spy = vi.fn(async (_q: string) => [{ n: 0 }]);
    await probeOwnerlessOrganizations(
      { $queryRawUnsafe: spy } as unknown as Parameters<
        typeof probeOwnerlessOrganizations
      >[0]
    );
    const sql = String(spy.mock.calls[0][0]);
    expect(sql).toMatch(/NOT EXISTS/i);
    expect(sql).toMatch(/role\s*=\s*'OWNER'/);
    expect(sql).toMatch(/"Organization"/);
  });
});
