/**
 * P1-1 Slice-1C — Prisma Adapter Factory
 *
 * Creates a PersistenceAdapters bundle backed by Prisma.
 * The prismaClient parameter is typed as `unknown` at the boundary
 * to prevent Prisma types from leaking into the interface layer.
 */

import type { PersistenceAdapters } from "../factory";
import { PrismaBaselineRepository } from "./baseline";
import { PrismaSnapshotRepository } from "./snapshot";
import { PrismaAuthorityRepository } from "./authority";
import { PrismaIncidentRepository } from "./incident";
import { PrismaStabilizationAuditRepository } from "./stabilization-audit";
import { PrismaCanonicalAuditRepository } from "./canonical-audit";
import { PrismaLockRepository } from "./lock";

/**
 * Create Prisma-backed persistence adapters.
 *
 * @param prismaClient - The Prisma client instance (typed as unknown at boundary)
 * @returns PersistenceAdapters with mode="PRISMA"
 */
export function createPrismaAdapters(prismaClient: unknown): PersistenceAdapters {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = prismaClient as any;

  return {
    mode: "PRISMA",
    baseline: new PrismaBaselineRepository(client),
    snapshot: new PrismaSnapshotRepository(client),
    authority: new PrismaAuthorityRepository(client),
    incident: new PrismaIncidentRepository(client),
    stabilizationAudit: new PrismaStabilizationAuditRepository(client),
    canonicalAudit: new PrismaCanonicalAuditRepository(client),
    lock: new PrismaLockRepository(client),
  };
}

// Re-export individual repositories for direct usage if needed
export { PrismaBaselineRepository } from "./baseline";
export { PrismaSnapshotRepository } from "./snapshot";
export { PrismaAuthorityRepository } from "./authority";
export { PrismaIncidentRepository } from "./incident";
export { PrismaStabilizationAuditRepository } from "./stabilization-audit";
export { PrismaCanonicalAuditRepository } from "./canonical-audit";
export { PrismaLockRepository } from "./lock";
