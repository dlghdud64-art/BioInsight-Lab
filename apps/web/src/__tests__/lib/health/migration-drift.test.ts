/**
 * §migration-order-drift-guard Phase 1 — drift 계산·probe 계약 (RED → Phase 2 GREEN).
 *
 * 계약 (계획서 §12 Phase 0 확정, 2026-08-04):
 *   C1. 관측: pending = M − A, unknown = A − M, unfinished/rolled_back count 상시 계산.
 *       (0801-사고 시그니처: 부분 시야 deploy 트리의 적용 → main 기준 pending 지속/unknown.)
 *   C2. rolled-back 행은 "적용됨"이 아니다 — manifest에 있으면 pending에 남는다.
 *   C3. false-ok 차단: probe의 DB 도달 불가/쿼리 실패는 { ok:false, reachable:false }.
 *       drift 0(clean)으로 위장 절대 금지 (placeholder success 금지).
 *
 * 커버리지 경계:
 *   - 순수 계산 + mock client probe만. 실제 prod SELECT·health 라우트 wiring은
 *     Phase 3(라우트 통합 테스트)·Phase 4(prod smoke) 몫.
 *   - manifest "생성"은 generate-migration-manifest.test.ts가 잠근다 (여기 아님).
 */
import { describe, it, expect } from "vitest";
import {
  computeMigrationDrift,
  probeMigrationDrift,
  type MigrationManifest,
  type AppliedMigrationRow,
  type RawQueryClient,
} from "@/lib/health/migration-drift";

const manifest = (names: string[]): MigrationManifest => ({
  migrations: names,
  generatedAt: "2026-08-04T00:00:00.000Z",
});

const applied = (
  name: string,
  opts: { finished?: boolean; rolledBack?: boolean } = {},
): AppliedMigrationRow => ({
  migration_name: name,
  finished_at: opts.finished === false ? null : "2026-08-01T16:19:15.564Z",
  rolled_back_at: opts.rolledBack ? "2026-08-02T00:00:00.000Z" : null,
});

describe("§migration-order-drift-guard C1 — pending/unknown/counts 관측", () => {
  it("정합 상태: M == A → pending 0·unknown 0·clean true", () => {
    const d = computeMigrationDrift(manifest(["20260731120000_a", "20260801120000_b"]), [
      applied("20260731120000_a"),
      applied("20260801120000_b"),
    ]);
    expect(d.pending).toEqual([]);
    expect(d.unknown).toEqual([]);
    expect(d.appliedCount).toBe(2);
    expect(d.unfinishedCount).toBe(0);
    expect(d.rolledBackCount).toBe(0);
    expect(d.clean).toBe(true);
  });

  it("사고 재현(silent gap): repo에 0731+0801, prod에 0801만 → pending=[0731]·clean false", () => {
    const d = computeMigrationDrift(
      manifest(["20260731120000_receiving_document", "20260801120000_receiving_inspection_decision"]),
      [applied("20260801120000_receiving_inspection_decision")],
    );
    expect(d.pending).toEqual(["20260731120000_receiving_document"]);
    expect(d.unknown).toEqual([]);
    expect(d.clean).toBe(false);
  });

  it("부분 시야 시그니처(unknown): prod 적용 행이 manifest에 없음 → unknown 노출·clean false", () => {
    const d = computeMigrationDrift(manifest(["20260731120000_a"]), [
      applied("20260731120000_a"),
      applied("20260899000000_from_other_tree"),
    ]);
    expect(d.unknown).toEqual(["20260899000000_from_other_tree"]);
    expect(d.pending).toEqual([]);
    expect(d.clean).toBe(false);
  });

  it("unfinished 카운트: finished_at null && rolled_back null → unfinished·clean false", () => {
    const d = computeMigrationDrift(manifest(["20260731120000_a"]), [
      applied("20260731120000_a", { finished: false }),
    ]);
    expect(d.unfinishedCount).toBe(1);
    expect(d.clean).toBe(false);
  });

  it("pending은 이름 오름차순 정렬 (운영자 판독 안정성)", () => {
    const d = computeMigrationDrift(
      manifest(["20260803000000_c", "20260701000000_a", "20260802000000_b"]),
      [],
    );
    expect(d.pending).toEqual([
      "20260701000000_a",
      "20260802000000_b",
      "20260803000000_c",
    ]);
  });
});

describe("§migration-order-drift-guard C2 — rolled-back은 적용이 아니다", () => {
  it("rolled-back 행: rolledBackCount 집계 + 해당 migration은 pending 유지·applied 미집계", () => {
    const d = computeMigrationDrift(manifest(["20260731120000_a"]), [
      applied("20260731120000_a", { rolledBack: true }),
    ]);
    expect(d.rolledBackCount).toBe(1);
    expect(d.appliedCount).toBe(0);
    expect(d.pending).toEqual(["20260731120000_a"]);
    expect(d.clean).toBe(false);
  });
});

describe("§migration-order-drift-guard C3 — probe false-ok 차단", () => {
  it("쿼리 성공: ok true·reachable true·drift 포함·manifestGeneratedAt 전달", async () => {
    const client = {
      $queryRawUnsafe: async () => [
        applied("20260731120000_a"),
      ],
    };
    const res = await probeMigrationDrift(client as unknown as RawQueryClient, manifest(["20260731120000_a"]));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.reachable).toBe(true);
      expect(res.drift.clean).toBe(true);
      expect(res.manifestGeneratedAt).toBe("2026-08-04T00:00:00.000Z");
    }
  });

  it("쿼리 실패(도달 불가): ok false·reachable false — drift 필드 자체가 없다 (clean 위장 불가)", async () => {
    const client = {
      $queryRawUnsafe: async () => {
        throw new Error("connect ETIMEDOUT");
      },
    };
    const res = await probeMigrationDrift(client as unknown as RawQueryClient, manifest(["20260731120000_a"]));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reachable).toBe(false);
      expect(res.error).toContain("ETIMEDOUT");
      expect("drift" in res).toBe(false);
    }
  });
});
