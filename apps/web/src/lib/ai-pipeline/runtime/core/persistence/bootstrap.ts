/**
 * P1-1 Slice-1E — Persistence Bootstrap
 *
 * Singleton initialization for the persistence layer.
 * Reads PERSISTENCE_PROVIDER env var (MEMORY | PRISMA), registers adapter
 * factories, resolves the adapter bundle, and validates completeness.
 *
 * Design:
 * - Lazy init: getPersistenceAdapters() bootstraps on first call.
 * - Invalid config → explicit error (no silent fallback).
 * - PRISMA without prismaClient → explicit error.
 * - All 6 repositories validated at startup.
 */

import type { PersistenceAdapters, PersistenceProviderConfig } from "./factory";
import type { StorageMode } from "./types";
import {
  registerAdapterFactory,
  resolveAdapters,
  _resetAdapterRegistry,
} from "./factory";
import { createMemoryAdapters } from "./memory";

// ══════════════════════════════════════════════════════════════════════════════
// Provider Configuration
// ══════════════════════════════════════════════════════════════════════════════

const VALID_MODES: readonly string[] = ["MEMORY", "PRISMA"];

/**
 * Read and validate persistence provider config from environment.
 * Falls back to explicit config parameter if provided.
 */
function resolveProviderConfig(
  overrides?: Partial<PersistenceProviderConfig>
): PersistenceProviderConfig {
  const envMode = process.env.PERSISTENCE_PROVIDER || "MEMORY";

  // Override takes precedence over env
  const mode = (overrides && overrides.mode) ? overrides.mode : envMode;

  // Validate mode
  if (VALID_MODES.indexOf(mode) === -1) {
    throw new Error(
      `[Persistence] Invalid PERSISTENCE_PROVIDER="${mode}". ` +
      `Valid values: ${VALID_MODES.join(", ")}. ` +
      `Set PERSISTENCE_PROVIDER env var or pass config.mode explicitly.`
    );
  }

  // PRISMA requires prismaClient
  if (mode === "PRISMA") {
    const client = overrides && overrides.prismaClient;
    if (!client) {
      throw new Error(
        `[Persistence] PERSISTENCE_PROVIDER=PRISMA requires a prismaClient. ` +
        `Pass { prismaClient } in config. Silent fallback to MEMORY is not allowed.`
      );
    }
    return { mode: mode as StorageMode, prismaClient: client };
  }

  return { mode: mode as StorageMode };
}

// ══════════════════════════════════════════════════════════════════════════════
// Bundle Validation
// ══════════════════════════════════════════════════════════════════════════════

const REQUIRED_REPOS: readonly string[] = [
  "baseline",
  "snapshot",
  "authority",
  "incident",
  "stabilizationAudit",
  "canonicalAudit",
];

function validateBundle(adapters: PersistenceAdapters): void {
  const missing: string[] = [];
  for (const repo of REQUIRED_REPOS) {
    const value = (adapters as Record<string, unknown>)[repo];
    if (!value) {
      missing.push(repo);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `[Persistence] Adapter bundle incomplete. Missing repositories: ${missing.join(", ")}. ` +
      `Check that the adapter factory creates all 6 repositories.`
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Singleton
// ══════════════════════════════════════════════════════════════════════════════

let _adapters: PersistenceAdapters | null = null;

/**
 * Initialize the persistence layer.
 * Idempotent: repeated calls return the same bundle.
 *
 * @param overrides — optional config (for tests or explicit wiring)
 */
export function bootstrapPersistence(
  overrides?: Partial<PersistenceProviderConfig>
): PersistenceAdapters {
  if (_adapters) return _adapters;

  const config = resolveProviderConfig(overrides);

  // Register adapter factories
  // MEMORY is always registered (fallback & default)
  registerAdapterFactory("MEMORY", function () {
    return createMemoryAdapters();
  });

  // PRISMA registration (conditional — only when mode is PRISMA)
  if (config.mode === "PRISMA") {
    // Dynamic import to avoid pulling Prisma types into MEMORY-only builds
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createPrismaAdapters } = require("./prisma") as {
      createPrismaAdapters: (client: unknown) => PersistenceAdapters;
    };
    registerAdapterFactory("PRISMA", function () {
      return createPrismaAdapters(config.prismaClient);
    });
  }

  // Resolve
  const adapters = resolveAdapters(config);

  // Validate completeness
  validateBundle(adapters);

  // eslint-disable-next-line no-console
  console.info(`[Persistence] Bootstrapped with mode=${config.mode}`);

  _adapters = adapters;
  return adapters;
}

/**
 * Get the persistence adapter bundle.
 * Lazy: bootstraps on first call if not yet initialized.
 */
export function getPersistenceAdapters(): PersistenceAdapters {
  if (!_adapters) {
    return bootstrapPersistence();
  }
  return _adapters;
}

/**
 * Check if persistence has been bootstrapped.
 */
export function isPersistenceBootstrapped(): boolean {
  return _adapters !== null;
}

/**
 * Test-only: reset bootstrap state for test isolation.
 */
export function _resetPersistenceBootstrap(): void {
  _adapters = null;
  _resetAdapterRegistry();
}
