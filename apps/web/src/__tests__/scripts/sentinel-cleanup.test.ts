/**
 * ADR-001 §6.2 regression — sentinel cleanup must touch only the four
 * exact sentinel IDs (org / workspace / user / product), never anything
 * else. This is the safety net for ADR-001 §11.2 (the pre-existing #16c
 * evidence must survive every cleanup).
 */

import { describe, it, expect, vi } from "vitest";
import {
  SENTINEL_ORG_ID,
  SENTINEL_WORKSPACE_ID,
  SENTINEL_USER_ID,
  SENTINEL_PRODUCT_ID,
  buildCleanupPlan,
} from "../../../scripts/smoke/sentinel";
import {
  parseMode,
  runCleanup,
  type CleanupPrismaClient,
} from "../../../scripts/smoke/sentinel-cleanup";

type EntityPresence = {
  org?: boolean;
  ws?: boolean;
  user?: boolean;
  product?: boolean;
};

function makeMockPrisma(existing: EntityPresence) {
  const present = {
    org: existing.org ?? false,
    ws: existing.ws ?? false,
    user: existing.user ?? false,
    product: existing.product ?? false,
  };
  return {
    organization: {
      findUnique: vi
        .fn()
        .mockResolvedValue(present.org ? { id: SENTINEL_ORG_ID } : null),
      delete: vi.fn().mockResolvedValue({ id: SENTINEL_ORG_ID }),
    },
    workspace: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          present.ws ? { id: SENTINEL_WORKSPACE_ID } : null,
        ),
      delete: vi.fn().mockResolvedValue({ id: SENTINEL_WORKSPACE_ID }),
    },
    user: {
      findUnique: vi
        .fn()
        .mockResolvedValue(present.user ? { id: SENTINEL_USER_ID } : null),
      delete: vi.fn().mockResolvedValue({ id: SENTINEL_USER_ID }),
    },
    product: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          present.product ? { id: SENTINEL_PRODUCT_ID } : null,
        ),
      delete: vi.fn().mockResolvedValue({ id: SENTINEL_PRODUCT_ID }),
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
  it("contains exactly the four sentinel IDs in the declared order", () => {
    const plan = buildCleanupPlan();
    expect(plan.deleteByExactId).toHaveLength(4);
    const ids = plan.deleteByExactId.map((o) => o.id);
    expect(ids).toEqual([
      SENTINEL_WORKSPACE_ID,
      SENTINEL_USER_ID,
      SENTINEL_ORG_ID,
      SENTINEL_PRODUCT_ID,
    ]);
  });

  it("each entry's id has no SQL wildcard or glob characters", () => {
    const plan = buildCleanupPlan();
    for (const op of plan.deleteByExactId) {
      expect(op.id).not.toMatch(/[%*?]/);
      expect(op.id).toMatch(
        /^(org|workspace|user|product)-smoke-(isolated|sentinel)$/,
      );
    }
  });

  it("includes workspace / user / organization / product exactly once each", () => {
    const plan = buildCleanupPlan();
    const models = plan.deleteByExactId.map((o) => o.model).sort();
    expect(models).toEqual([
      "organization",
      "product",
      "user",
      "workspace",
    ]);
  });
});

describe("runCleanup — dry-run mode", () => {
  it("reads all four entities but never calls delete", async () => {
    const prisma = makeMockPrisma({
      org: true,
      ws: true,
      user: true,
      product: true,
    });
    const result = await runCleanup("dry-run", prisma as unknown as CleanupPrismaClient);

    expect(result.mode).toBe("dry-run");
    expect(result.found).toEqual({
      organization: true,
      workspace: true,
      user: true,
      product: true,
    });
    expect(result.deletedCalls).toEqual([]);

    expect(prisma.organization.delete).not.toHaveBeenCalled();
    expect(prisma.workspace.delete).not.toHaveBeenCalled();
    expect(prisma.user.delete).not.toHaveBeenCalled();
    expect(prisma.product.delete).not.toHaveBeenCalled();

    expect(prisma.organization.findUnique).toHaveBeenCalledWith({
      where: { id: SENTINEL_ORG_ID },
    });
    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
      where: { id: SENTINEL_WORKSPACE_ID },
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: SENTINEL_USER_ID },
    });
    expect(prisma.product.findUnique).toHaveBeenCalledWith({
      where: { id: SENTINEL_PRODUCT_ID },
    });
  });

  it("reports all four as not-found when absent", async () => {
    const prisma = makeMockPrisma({});
    const result = await runCleanup("dry-run", prisma as unknown as CleanupPrismaClient);

    expect(result.found).toEqual({
      organization: false,
      workspace: false,
      user: false,
      product: false,
    });
    expect(prisma.organization.delete).not.toHaveBeenCalled();
    expect(prisma.workspace.delete).not.toHaveBeenCalled();
    expect(prisma.user.delete).not.toHaveBeenCalled();
    expect(prisma.product.delete).not.toHaveBeenCalled();
  });
});

describe("runCleanup — apply mode", () => {
  it("deletes all four in the documented order when all exist", async () => {
    const prisma = makeMockPrisma({
      org: true,
      ws: true,
      user: true,
      product: true,
    });
    const result = await runCleanup("apply", prisma as unknown as CleanupPrismaClient);

    expect(result.deletedCalls).toEqual([
      { model: "workspace", id: SENTINEL_WORKSPACE_ID },
      { model: "user", id: SENTINEL_USER_ID },
      { model: "organization", id: SENTINEL_ORG_ID },
      { model: "product", id: SENTINEL_PRODUCT_ID },
    ]);
    expect(prisma.workspace.delete).toHaveBeenCalledExactlyOnceWith({
      where: { id: SENTINEL_WORKSPACE_ID },
    });
    expect(prisma.user.delete).toHaveBeenCalledExactlyOnceWith({
      where: { id: SENTINEL_USER_ID },
    });
    expect(prisma.organization.delete).toHaveBeenCalledExactlyOnceWith({
      where: { id: SENTINEL_ORG_ID },
    });
    expect(prisma.product.delete).toHaveBeenCalledExactlyOnceWith({
      where: { id: SENTINEL_PRODUCT_ID },
    });
  });

  it("is a safe no-op when nothing exists", async () => {
    const prisma = makeMockPrisma({});
    const result = await runCleanup("apply", prisma as unknown as CleanupPrismaClient);

    expect(result.deletedCalls).toEqual([]);
    expect(prisma.organization.delete).not.toHaveBeenCalled();
    expect(prisma.workspace.delete).not.toHaveBeenCalled();
    expect(prisma.user.delete).not.toHaveBeenCalled();
    expect(prisma.product.delete).not.toHaveBeenCalled();
  });

  it("skips deletes for entities that are already gone", async () => {
    // Mixed state: org + product present, workspace + user already gone.
    const prisma = makeMockPrisma({
      org: true,
      ws: false,
      user: false,
      product: true,
    });
    const result = await runCleanup("apply", prisma as unknown as CleanupPrismaClient);

    expect(result.deletedCalls).toEqual([
      { model: "organization", id: SENTINEL_ORG_ID },
      { model: "product", id: SENTINEL_PRODUCT_ID },
    ]);
    expect(prisma.workspace.delete).not.toHaveBeenCalled();
    expect(prisma.user.delete).not.toHaveBeenCalled();
    expect(prisma.organization.delete).toHaveBeenCalledOnce();
    expect(prisma.product.delete).toHaveBeenCalledOnce();
  });

  it("deletes user even when the organization is already gone (#16c isolation)", async () => {
    // User must be droppable independently — User.quotes cascade is the
    // only thing that guarantees smoke Quote rows get cleaned up, because
    // Quote.organization is onDelete: SetNull (not Cascade).
    const prisma = makeMockPrisma({
      org: false,
      ws: false,
      user: true,
      product: false,
    });
    const result = await runCleanup("apply", prisma as unknown as CleanupPrismaClient);

    expect(result.deletedCalls).toEqual([
      { model: "user", id: SENTINEL_USER_ID },
    ]);
    expect(prisma.user.delete).toHaveBeenCalledExactlyOnceWith({
      where: { id: SENTINEL_USER_ID },
    });
  });

  it("never uses deleteMany or filter-based delete (#16c protection)", async () => {
    const prisma = makeMockPrisma({
      org: true,
      ws: true,
      user: true,
      product: true,
    }) as unknown as Record<
      "organization" | "workspace" | "user" | "product",
      Record<string, unknown>
    >;
    for (const model of ["organization", "workspace", "user", "product"] as const) {
      expect(prisma[model].deleteMany).toBeUndefined();
    }

    await runCleanup("apply", prisma as unknown as CleanupPrismaClient);

    for (const model of ["organization", "workspace", "user", "product"] as const) {
      const calls = (prisma[model].delete as unknown as {
        mock: { calls: unknown[][] };
      }).mock.calls;
      for (const call of calls) {
        // Every delete is `{ where: { id: <exact sentinel id> } }`
        expect(call[0]).toMatchObject({
          where: { id: expect.stringMatching(/^(org|workspace|user|product)-smoke-/) },
        });
      }
    }
  });
});
