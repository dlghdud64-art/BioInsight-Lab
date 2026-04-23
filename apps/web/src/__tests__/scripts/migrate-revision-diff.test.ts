/**
 * ADR-001 §7 criteria 3 — pure diff logic for migrate-revision-diff.
 *
 * We test the pure helpers only. The script's filesystem + Prisma
 * integration is verified by a manual run against the smoke project
 * (ADR-001 Phase 3 manager step).
 */

import { describe, it, expect } from "vitest";
import {
  diffMigrationSets,
  filterMigrationDirNames,
} from "../../../scripts/smoke/migrate-revision-diff";

const M1 = "0_init";
const M2 = "20260417120000_add_workspace_organization_id_nullable";
const M3 = "20260417120100_workspace_organization_id_unique_not_null";
const M4 = "20260418120000_add_stripe_event_dedupe";

describe("diffMigrationSets", () => {
  it("reports zero missing / zero extra when repo and DB match", () => {
    const diff = diffMigrationSets([M1, M2, M3, M4], [M1, M2, M3, M4]);
    expect(diff.matches).toBe(4);
    expect(diff.missing).toEqual([]);
    expect(diff.extra).toEqual([]);
  });

  it("reports applied-but-not-in-repo migrations under `extra`", () => {
    const diff = diffMigrationSets(
      [M1, M2],
      [M1, M2, "99999999_orphan"],
    );
    expect(diff.matches).toBe(2);
    expect(diff.missing).toEqual([]);
    expect(diff.extra).toEqual(["99999999_orphan"]);
  });

  it("reports in-repo-but-not-applied migrations under `missing`", () => {
    const diff = diffMigrationSets([M1, M2, M3], [M1]);
    expect(diff.matches).toBe(1);
    expect(diff.missing).toEqual([M2, M3]);
    expect(diff.extra).toEqual([]);
  });

  it("handles both missing and extra at the same time", () => {
    const diff = diffMigrationSets(
      [M1, M2, M3],
      [M1, "orphan-a", "orphan-b"],
    );
    expect(diff.matches).toBe(1);
    expect(diff.missing).toEqual([M2, M3]);
    expect(diff.extra).toEqual(["orphan-a", "orphan-b"]);
  });

  it("is idempotent over ordering (sorted output)", () => {
    const a = diffMigrationSets([M4, M2, M1, M3], [M3, M1, M2, M4]);
    const b = diffMigrationSets([M1, M2, M3, M4], [M1, M2, M3, M4]);
    expect(a.expected).toEqual(b.expected);
    expect(a.applied).toEqual(b.applied);
    expect(a.missing).toEqual([]);
    expect(a.extra).toEqual([]);
  });

  it("deduplicates repeated entries in either side", () => {
    const diff = diffMigrationSets([M1, M1, M2], [M1, M2, M2]);
    expect(diff.matches).toBe(2);
    expect(diff.missing).toEqual([]);
    expect(diff.extra).toEqual([]);
  });

  it("handles both sides being empty", () => {
    const diff = diffMigrationSets([], []);
    expect(diff.matches).toBe(0);
    expect(diff.missing).toEqual([]);
    expect(diff.extra).toEqual([]);
  });
});

describe("filterMigrationDirNames", () => {
  it("keeps timestamp-prefixed directory entries and drops files", () => {
    const names = filterMigrationDirNames([
      { name: M1, isDirectory: true },
      { name: M2, isDirectory: true },
      { name: "migration_lock.toml", isDirectory: false },
      { name: "README.md", isDirectory: false },
    ]);
    expect(names).toEqual([M1, M2]);
  });

  it("drops dotfiles even if they are directories", () => {
    const names = filterMigrationDirNames([
      { name: M1, isDirectory: true },
      { name: ".cache", isDirectory: true },
    ]);
    expect(names).toEqual([M1]);
  });

  it("returns empty for an empty listing", () => {
    expect(filterMigrationDirNames([])).toEqual([]);
  });

  it("returns sorted output regardless of input order", () => {
    const names = filterMigrationDirNames([
      { name: M4, isDirectory: true },
      { name: M2, isDirectory: true },
      { name: M1, isDirectory: true },
      { name: M3, isDirectory: true },
    ]);
    expect(names).toEqual([M1, M2, M3, M4]);
  });
});
