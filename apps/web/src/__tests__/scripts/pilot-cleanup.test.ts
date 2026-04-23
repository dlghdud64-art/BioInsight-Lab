/**
 * ADR-002 §4 regression — pilot cleanup must touch only the five
 * allowed models (workspaceMember, organizationMember, workspace,
 * organization, product) and NEVER the canonical User row.
 *
 * Scope guarantees enforced here
 * - Plan emits exactly 19 operations in the documented order
 *   (WM → OM → W → O → 15 products).
 * - Every operation uses exact ids or compound @@unique keys —
 *   no wildcards, no deleteMany, no filter-based delete.
 * - Dry-run never calls delete.
 * - Apply mode deletes exactly the entities that the probe found.
 * - The cleanup client surface has no `user` field, so touching
 *   the canonical user row fails typecheck (verified at runtime
 *   here as well, defensively).
 */

import { describe, it, expect, vi } from "vitest";
import {
  PILOT_ORG_ID,
  PILOT_WORKSPACE_ID,
  PILOT_OWNER_USER_ID,
  PILOT_OWNER_PROTECTION,
  PILOT_PRODUCT_IDS,
  PILOT_PRODUCT_CATALOG,
  buildPilotCleanupPlan,
} from "../../../scripts/pilot/pilot";
import {
  parseMode,
  runCleanup,
  type PilotCleanupPrismaClient,
} from "../../../scripts/pilot/pilot-cleanup";

type Presence = {
  wsMember?: boolean;
  orgMember?: boolean;
  workspace?: boolean;
  organization?: boolean;
  products?: boolean; // applies to all 15
};

function makeMockPrisma(p: Presence) {
  const present = {
    wsMember: p.wsMember ?? false,
    orgMember: p.orgMember ?? false,
    workspace: p.workspace ?? false,
    organization: p.organization ?? false,
    products: p.products ?? false,
  };
  return {
    workspaceMember: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          present.wsMember
            ? { workspaceId: PILOT_WORKSPACE_ID, userId: PILOT_OWNER_USER_ID }
            : null,
        ),
      delete: vi.fn().mockResolvedValue({ ok: true }),
    },
    organizationMember: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          present.orgMember
            ? { userId: PILOT_OWNER_USER_ID, organizationId: PILOT_ORG_ID }
            : null,
        ),
      delete: vi.fn().mockResolvedValue({ ok: true }),
    },
    workspace: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          present.workspace ? { id: PILOT_WORKSPACE_ID } : null,
        ),
      delete: vi.fn().mockResolvedValue({ ok: true }),
    },
    organization: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          present.organization ? { id: PILOT_ORG_ID } : null,
        ),
      delete: vi.fn().mockResolvedValue({ ok: true }),
    },
    product: {
      // present.products toggles all 15 products at once
      findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve(present.products ? { id: where.id } : null),
      ),
      delete: vi.fn().mockResolvedValue({ ok: true }),
    },
  };
}

describe("parseMode", () => {
  it("returns dry-run by default", () => {
    expect(parseMode([])).toBe("dry-run");
  });

  it("returns dry-run when irrelevant flags are present", () => {
    expect(parseMode(["--foo", "--bar"])).toBe("dry-run");
  });

  it("returns apply when --apply is present", () => {
    expect(parseMode(["--apply"])).toBe("apply");
  });

  it("returns apply when --apply appears after other args", () => {
    expect(parseMode(["--verbose", "--apply", "--other"])).toBe("apply");
  });
});

describe("buildPilotCleanupPlan — scoping structure", () => {
  it("emits exactly 19 operations", () => {
    const plan = buildPilotCleanupPlan();
    expect(plan.operations).toHaveLength(19);
  });

  it("places workspaceMember → organizationMember → workspace → organization → products in the documented order", () => {
    const plan = buildPilotCleanupPlan();
    const models = plan.operations.map((o) => o.model);
    expect(models[0]).toBe("workspaceMember");
    expect(models[1]).toBe("organizationMember");
    expect(models[2]).toBe("workspace");
    expect(models[3]).toBe("organization");
    // remaining 15 are product
    expect(models.slice(4)).toEqual(new Array(15).fill("product"));
  });

  it("covers all 15 pilot product ids exactly once", () => {
    const plan = buildPilotCleanupPlan();
    const productOps = plan.operations.filter((o) => o.model === "product");
    const ids = productOps.map((o) => (o.where as { id: string }).id).sort();
    const expected = [...PILOT_PRODUCT_IDS].sort();
    expect(ids).toEqual(expected);
    expect(new Set(ids).size).toBe(ids.length); // no duplicates
    expect(PILOT_PRODUCT_CATALOG.length).toBe(15); // catalog integrity
  });

  it("uses compound @@unique keys for membership rows (no raw userId filter)", () => {
    const plan = buildPilotCleanupPlan();
    const ws = plan.operations.find((o) => o.model === "workspaceMember");
    const org = plan.operations.find((o) => o.model === "organizationMember");
    expect(ws?.where).toEqual({
      workspaceId_userId: {
        workspaceId: PILOT_WORKSPACE_ID,
        userId: PILOT_OWNER_USER_ID,
      },
    });
    expect(org?.where).toEqual({
      userId_organizationId: {
        userId: PILOT_OWNER_USER_ID,
        organizationId: PILOT_ORG_ID,
      },
    });
  });

  it("never lists a `user` model in the plan (canonical user protection)", () => {
    const plan = buildPilotCleanupPlan();
    for (const op of plan.operations) {
      // Cast is safe: the union cannot widen past the declared models,
      // but we assert defensively so a schema drift would fail here.
      expect(op.model as string).not.toBe("user");
    }
  });

  it("each product id has no SQL wildcard or glob characters", () => {
    const plan = buildPilotCleanupPlan();
    for (const op of plan.operations) {
      if (op.model !== "product") continue;
      const id = (op.where as { id: string }).id;
      expect(id).not.toMatch(/[%*?]/);
      expect(id).toMatch(/^product-pilot-/);
    }
  });
});

describe("runCleanup — dry-run mode", () => {
  it("probes all 19 entities but never calls delete", async () => {
    const prisma = makeMockPrisma({
      wsMember: true,
      orgMember: true,
      workspace: true,
      organization: true,
      products: true,
    });
    const result = await runCleanup(
      "dry-run",
      prisma as unknown as PilotCleanupPrismaClient,
    );
    expect(result.mode).toBe("dry-run");
    expect(result.probes).toHaveLength(19);
    expect(result.deletedCalls).toEqual([]);

    expect(prisma.workspaceMember.delete).not.toHaveBeenCalled();
    expect(prisma.organizationMember.delete).not.toHaveBeenCalled();
    expect(prisma.workspace.delete).not.toHaveBeenCalled();
    expect(prisma.organization.delete).not.toHaveBeenCalled();
    expect(prisma.product.delete).not.toHaveBeenCalled();
  });

  it("reports all entities as not present when absent, still no delete", async () => {
    const prisma = makeMockPrisma({});
    const result = await runCleanup(
      "dry-run",
      prisma as unknown as PilotCleanupPrismaClient,
    );
    expect(result.probes.every((p) => p.present === false)).toBe(true);
    expect(result.deletedCalls).toEqual([]);
  });
});

describe("runCleanup — apply mode", () => {
  it("deletes all 19 entities in order when every row is present", async () => {
    const prisma = makeMockPrisma({
      wsMember: true,
      orgMember: true,
      workspace: true,
      organization: true,
      products: true,
    });
    const result = await runCleanup(
      "apply",
      prisma as unknown as PilotCleanupPrismaClient,
    );
    expect(result.deletedCalls).toHaveLength(19);
    const models = result.deletedCalls.map((d) => d.model);
    expect(models[0]).toBe("workspaceMember");
    expect(models[1]).toBe("organizationMember");
    expect(models[2]).toBe("workspace");
    expect(models[3]).toBe("organization");
    expect(models.slice(4)).toEqual(new Array(15).fill("product"));

    expect(prisma.workspaceMember.delete).toHaveBeenCalledExactlyOnceWith({
      where: {
        workspaceId_userId: {
          workspaceId: PILOT_WORKSPACE_ID,
          userId: PILOT_OWNER_USER_ID,
        },
      },
    });
    expect(prisma.organizationMember.delete).toHaveBeenCalledExactlyOnceWith({
      where: {
        userId_organizationId: {
          userId: PILOT_OWNER_USER_ID,
          organizationId: PILOT_ORG_ID,
        },
      },
    });
    expect(prisma.workspace.delete).toHaveBeenCalledExactlyOnceWith({
      where: { id: PILOT_WORKSPACE_ID },
    });
    expect(prisma.organization.delete).toHaveBeenCalledExactlyOnceWith({
      where: { id: PILOT_ORG_ID },
    });
    expect(prisma.product.delete).toHaveBeenCalledTimes(15);
  });

  it("is a safe no-op when nothing is present", async () => {
    const prisma = makeMockPrisma({});
    const result = await runCleanup(
      "apply",
      prisma as unknown as PilotCleanupPrismaClient,
    );
    expect(result.deletedCalls).toEqual([]);
    expect(prisma.workspaceMember.delete).not.toHaveBeenCalled();
    expect(prisma.organizationMember.delete).not.toHaveBeenCalled();
    expect(prisma.workspace.delete).not.toHaveBeenCalled();
    expect(prisma.organization.delete).not.toHaveBeenCalled();
    expect(prisma.product.delete).not.toHaveBeenCalled();
  });

  it("skips entities that are already gone (partial state)", async () => {
    // Only workspace is gone; everything else present
    const prisma = makeMockPrisma({
      wsMember: true,
      orgMember: true,
      workspace: false,
      organization: true,
      products: true,
    });
    const result = await runCleanup(
      "apply",
      prisma as unknown as PilotCleanupPrismaClient,
    );
    expect(result.deletedCalls).toHaveLength(18); // minus the absent workspace
    const models = result.deletedCalls.map((d) => d.model);
    expect(models).not.toContain("workspace");
    expect(prisma.workspace.delete).not.toHaveBeenCalled();
  });

  it("uses only exact keys — probe arguments never widen", async () => {
    const prisma = makeMockPrisma({
      wsMember: true,
      orgMember: true,
      workspace: true,
      organization: true,
      products: true,
    });
    await runCleanup(
      "apply",
      prisma as unknown as PilotCleanupPrismaClient,
    );
    // Every probe call must match { where: <exact key> }
    const checkExact = (fn: ReturnType<typeof vi.fn>) => {
      for (const call of fn.mock.calls) {
        const arg = call[0] as { where: unknown };
        expect(arg).toHaveProperty("where");
        // where must not be a partial like { userId: ... }; it must
        // be one of the 3 accepted shapes. Checked via discriminant.
        const whereKeys = Object.keys(arg.where as object);
        expect(
          whereKeys.length === 1 &&
            ["id", "workspaceId_userId", "userId_organizationId"].includes(
              whereKeys[0],
            ),
        ).toBe(true);
      }
    };
    checkExact(prisma.workspaceMember.findUnique);
    checkExact(prisma.organizationMember.findUnique);
    checkExact(prisma.workspace.findUnique);
    checkExact(prisma.organization.findUnique);
    checkExact(prisma.product.findUnique);
  });

  it("never reaches for deleteMany — client surface does not expose it", () => {
    // This is a surface-level assertion: the mock (and therefore the
    // declared interface) deliberately does not provide deleteMany.
    const prisma = makeMockPrisma({
      wsMember: true,
      orgMember: true,
      workspace: true,
      organization: true,
      products: true,
    }) as unknown as Record<
      "workspaceMember"
      | "organizationMember"
      | "workspace"
      | "organization"
      | "product",
      Record<string, unknown>
    >;
    for (const model of [
      "workspaceMember",
      "organizationMember",
      "workspace",
      "organization",
      "product",
    ] as const) {
      expect(prisma[model].deleteMany).toBeUndefined();
    }
  });
});

describe("PILOT_OWNER_PROTECTION message", () => {
  it("contains the pilot owner user id so logs make the guarantee visible", () => {
    expect(PILOT_OWNER_PROTECTION).toContain(PILOT_OWNER_USER_ID);
  });

  it("explicitly mentions OrganizationMember and WorkspaceMember scope", () => {
    expect(PILOT_OWNER_PROTECTION).toMatch(/OrganizationMember/);
    expect(PILOT_OWNER_PROTECTION).toMatch(/WorkspaceMember/);
  });
});
