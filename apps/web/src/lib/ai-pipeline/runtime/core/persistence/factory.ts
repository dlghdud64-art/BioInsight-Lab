/**
 * P1-1 Slice-1B — Persistence Adapter Factory Contract
 *
 * Defines the factory that creates all 6 repositories
 * for either MEMORY or PRISMA storage mode.
 *
 * Constraints:
 * - No concrete implementations (Slice-1C/1D)
 * - No env var reading (Slice-1E)
 * - No Prisma imports
 */

import type { StorageMode } from "./types";
import type {
  BaselineRepository,
  SnapshotRepository,
  AuthorityRepository,
  IncidentRepository,
  StabilizationAuditRepository,
  CanonicalAuditRepository,
} from "./repositories";

// ══════════════════════════════════════════════════════════════════════════════
// Persistence Adapters Bundle
// ══════════════════════════════════════════════════════════════════════════════

/**
 * A complete set of repositories for a given storage mode.
 * Both MEMORY and PRISMA adapters produce the same bundle shape.
 */
export interface PersistenceAdapters {
  readonly mode: StorageMode;
  readonly baseline: BaselineRepository;
  readonly snapshot: SnapshotRepository;
  readonly authority: AuthorityRepository;
  readonly incident: IncidentRepository;
  readonly stabilizationAudit: StabilizationAuditRepository;
  readonly canonicalAudit: CanonicalAuditRepository;
}

// ══════════════════════════════════════════════════════════════════════════════
// Factory Contract
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Factory function contract.
 *
 * Slice-1C (Prisma) and Slice-1D (Memory) will each export a function
 * matching this signature:
 *
 *   export function createMemoryAdapters(): PersistenceAdapters;
 *   export function createPrismaAdapters(prismaClient: unknown): PersistenceAdapters;
 *
 * Slice-1E will wire them together:
 *
 *   export function createPersistenceAdapters(mode?: StorageMode): PersistenceAdapters;
 *
 * For now, only the type contract is defined.
 */
export type PersistenceAdapterFactory = (mode: StorageMode) => PersistenceAdapters;

// ══════════════════════════════════════════════════════════════════════════════
// Provider Config Contract
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Configuration for persistence provider selection.
 * Slice-1E will read these from environment variables.
 */
export interface PersistenceProviderConfig {
  /** Which storage backend to use */
  mode: StorageMode;
  /**
   * When mode=PRISMA, the Prisma client instance must be provided.
   * When mode=MEMORY, this is ignored.
   * Type is `unknown` here to avoid Prisma dependency in interface layer.
   */
  prismaClient?: unknown;
}

/**
 * Default config: MEMORY mode, no Prisma client.
 * This ensures zero-config startup for development and existing tests.
 */
export const DEFAULT_PERSISTENCE_CONFIG: PersistenceProviderConfig = {
  mode: "MEMORY",
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// Adapter Registration Contract
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Registry for adapter factories.
 * Allows Slice-1C and Slice-1D to register their factories
 * without circular imports.
 *
 * Usage pattern (Slice-1E):
 *   registerAdapterFactory("MEMORY", createMemoryAdapters);
 *   registerAdapterFactory("PRISMA", createPrismaAdapters);
 *   const adapters = resolveAdapters(config);
 */
export interface AdapterRegistry {
  register(mode: StorageMode, factory: () => PersistenceAdapters): void;
  resolve(config: PersistenceProviderConfig): PersistenceAdapters;
  isRegistered(mode: StorageMode): boolean;
}
