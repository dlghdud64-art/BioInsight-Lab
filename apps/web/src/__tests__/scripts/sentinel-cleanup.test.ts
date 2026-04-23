/**
 * ADR-001 §6.2 regression — sentinel cleanup must touch only the two
 * exact IDs, never anything else. This is the safety net for ADR-001
 * §11.2 (the pre-existing #16c evidence must survive every cleanup).
 */

import { describe, it, expect, vi } from "vitest";
import {
  SENTINEL_ORG_ID,
  SENTINEL_WORKSPACE_ID,
  buildCleanupPlan,
} from "../../../scripts/smoke/sentinel";
import {
  parseMode,
  runCleanup,
  type CleanupPrismaClient,
} from "../../../scripts/smoke/sentinel-cleanup";

function makeMockPrisma(existing: {
  org: boolean;
  ws: boolean;
}): CleanupPrismaClient & {
  organization: {
    findUnique: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  workspace: {
    findUnique: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
} {
  return {
    organization: {
      findUnique: vi
        .fn()
        .mockResolvedValue(existing.org ? { id: SENTINEL_ORG_ID } : null),
      delete: vi.fn().mockResolvedValue({ id: SENTINEL_ORG_ID }),
    },
    workspace: {
      findUnique: vi
        .fn()
        .mockResolvedValue(existing.ws ? { id: SENTINEL_WORKSPACE_ID } : null),
      delete: vi.fn().mockResolvedValue({ id: SENTINEL_WORKSPACE_ID }),
    },
  };
}

describe("parseMode", () => {
  it("returns dry-run when no flags are given (safe default)", () => {
    expect(parseMode([])).toBe("dry-run");
  });

  it("returns dry-run when irrelevant flags are passed", () => {
    expect(parseMode(["--foo", "--bar=baz"])).toBe("dry-run");
  });

  it("returns apply when --apply is present", () => {
    expect(parseMode(["--apply"])).toBe("apply");
  });

  it("returns apply when --apply appears after other args", () => {
    expect(parseMode(["--verbose", "--apply"])).toBe("apply");
  });
});

describe("buildCleanupPlan — scoping structure", () => {
  it("contains only the two sentinel IDs and nothing else", () => {
    const plan = buildCleanupPlan();
    expect(plan.deleteByExactId).toHaveLength(2);
    const ids = plan.deleteByExactId.map((o) => o.id);
    expect(ids).toEqual([SENTINEL_WORKSPACE_ID, SENTINEL_ORG_ID]);
  });

  it("each entry's id has no SQL wildcard or glob characters", () => {
    const plan = buildCleanupPlan();
    for (const op of plan.deleteByExactId) {
      expect(op.id).not.toMatch(/[%*?]/);
      expect(op.id).toMatch(/^(org|workspace)-smoke-isolated$/);
    }
  });

  it("includes workspace and organization exactly once each", () => {
    const plan = buildCleanupPlan();
    const models = plan.deleteByExactId.map((o) => o.model).sort();
    expect(models).toEqual(["organization", "workspace"]);
  });
});

describe("runCleanup — dry-run mode", () => {
  it("reads both entities but never calls delete", async () => {
    const prisma = makeMockPrisma({ org: true, ws: true });
    const result = await runCleanup("dry-run", prisma);

    expect(result.mode).toBe("dry-run");
    expect(result.found).toEqual({ organization: true, workspace: true });
    expect(result.deletedCalls).toEqual([]);

    expect(prisma.organization.findUnique).toHaveBeenCalledWith({
      where: { id: SENTINEL_ORG_ID },
    });
    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
      where: { id: SENTINEL_WORKSPACE_ID },
    });
    expect(prisma.organization.delete).not.toHaveBeenCalled();
    expect(prisma.workspace.delete).not.toHaveBeenCalled();
  });

  it("reports false/false when the sentinels are not present", async () => {
    const prisma = makeMockPrisma({ org: false, ws: false });
    const result = await runCleanup("dry-run", prisma);

    expect(result.found).toEqual({
      organization: false,
      workspace: false,
    });
    expect(prisma.organization.delete).not.toHaveBeenCalled();
    expect(prisma.workspace.delete).not.toHaveBeenCalled();
  });
});

describe("runCleanup — apply mode", () => {
  it("deletes workspace and organization by exact ID when both exist", async () => {
    const prisma = makeMockPrisma({ org: true, ws: true });
    const result = await runCleanup("apply", prisma);

    expect(result.deletedCalls).toEqual([
      { model: "workspace", id: SENTINEL_WORKSPACE_ID },
      { model: "organization", id: SENTINEL_ORG_ID },
    ]);
    expect(prisma.workspace.delete).toHaveBeenCalledExactlyOnceWith({
      where: { id: SENTINEL_WORKSPACE_ID },
    });
    expect(prisma.organization.delete).toHaveBeenCalledExactlyOnceWith({
      where: { id: SENTINEL_ORG_ID },
    });
  });

  it("is a safe no-op when both sentinels are absent", async () => {
    const prisma = makeMockPrisma({ org: false, ws: false });
    const result = await runCleanup("apply", prisma);

    expect(result.deletedCalls).toEqual([]);
    expect(prisma.organization.delete).not.toHaveBeenCalled();
    expect(prisma.workspace.delete).not.toHaveBeenCalled();
  });

  it("deletes only the organization when the workspace is already gone", async () => {
    const prisma = makeMockPrisma({ org: true, ws: false });
    const result = await runCleanup("apply", prisma);

    expect(result.deletedCalls).toEqual([
      { model: "organization", id: SENTINEL_ORG_ID },
    ]);
    expect(prisma.workspace.delete).not.toHaveBeenCalled();
    expect(prisma.organization.delete).toHaveBeenCalledExactlyOnceWith({
      where: { id: SENTINEL_ORG_ID },
    });
  });

  it("deletes only the workspace when the organization is already gone", async () => {
    // Edge case: org cascade would have removed ws, but we also allow
    // standalone workspace cleanup in case data drift leaves only ws.
    const prisma = makeMockPrisma({ org: false, ws: true });
    const result = await runCleanup("apply", prisma);

    expect(result.deletedCalls).toEqual([
      { model: "workspace", id: SENTINEL_WORKSPACE_ID },
    ]);
    expect(prisma.workspace.delete).toHaveBeenCalledExactlyOnceWith({
      where: { id: SENTINEL_WORKSPACE_ID },
    });
    expect(prisma.organization.delete).not.toHaveBeenCalled();
  });

  it("never invokes deleteMany or filter-based delete (#16c protection)", async () => {
    const prisma = makeMockPrisma({ org: true, ws: true }) as unknown as {
      organization: Record<string, unknown>;
      workspace: Record<string, unknown>;
    };
    // Neither delete surface includes deleteMany — confirm by absence.
    expect(prisma.organization.deleteMany).toBeUndefined();
    expect(prisma.workspace.deleteMany).toBeUndefined();

    // And every delete call we did make used exact id only.
    const orgDeleteMock = (prisma.organization.delete as unknown as {
      mock: { calls: unknown[][] };
    }).mock;
    const wsDeleteMock = (prisma.workspace.delete as unknown as {
      mock: { calls: unknown[][] };
    }).mock;
    await runCleanup("apply", prisma as unknown as CleanupPrismaClient);
    for (const call of orgDeleteMock.calls) {
      expect(call[0]).toEqual({ where: { id: SENTINEL_ORG_ID } });
    }
    for (const call of wsDeleteMock.calls) {
      expect(call[0]).toEqual({ where: { id: SENTINEL_WORKSPACE_ID } });
    }
  });
});
