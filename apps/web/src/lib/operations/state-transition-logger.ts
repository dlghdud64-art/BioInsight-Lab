/**
 * P7-1 — State Transition Logger
 *
 * Wraps existing ActivityLog to provide a domain-specific transition logging API.
 * Also provides CTA execution logging.
 *
 * Never throws — failures are caught and warned.
 */

import type { Prisma, ActivityType } from "@prisma/client";
import type { OperationDomain } from "./state-definitions";
import { createActivityLog } from "@/lib/activity-log";

// ══════════════════════════════════════════════════════════════════════════════
// Domain → ActivityType mapping
// ══════════════════════════════════════════════════════════════════════════════

const DOMAIN_ACTIVITY_TYPE: Record<OperationDomain, ActivityType> = {
  QUOTE: "QUOTE_STATUS_CHANGED",
  PURCHASE: "PURCHASE_REQUEST_CREATED",
  RECEIVING: "INVENTORY_RESTOCK_REVIEWED",
  INVENTORY: "INVENTORY_RESTOCK_SUGGESTED",
  ORDER: "ORDER_STATUS_CHANGED",
};

// ══════════════════════════════════════════════════════════════════════════════
// State Transition Logger
// ══════════════════════════════════════════════════════════════════════════════

export interface StateTransitionParams {
  domain: OperationDomain;
  entityId: string;
  fromStatus: string;
  toStatus: string;
  actorId: string;
  organizationId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Log a state transition using the existing ActivityLog system.
 * Maps domain to the appropriate ActivityType and records before/after status.
 */
export async function logStateTransition(
  params: StateTransitionParams,
  txClient?: Prisma.TransactionClient,
): Promise<void> {
  try {
    await createActivityLog(
      {
        activityType: DOMAIN_ACTIVITY_TYPE[params.domain],
        entityType: params.domain,
        entityId: params.entityId,
        beforeStatus: params.fromStatus,
        afterStatus: params.toStatus,
        userId: params.actorId,
        organizationId: params.organizationId,
        metadata: {
          ...params.metadata,
          transitionDomain: params.domain,
          ...(params.reason ? { reason: params.reason } : {}),
        },
      },
      txClient,
    );
  } catch (err) {
    console.warn("[StateTransitionLogger] Failed to log transition:", err);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CTA Execution Logger
// ══════════════════════════════════════════════════════════════════════════════

export interface CTAExecutionParams {
  ctaId: string;
  actor: string;
  sourceScreen: string;
  targetScreen: string;
  entityType: string;
  entityId: string;
  outcome: "success" | "failure";
  organizationId?: string | null;
  note?: string | null;
}

/**
 * Log a CTA execution event.
 */
export async function logCTAExecution(
  params: CTAExecutionParams,
  txClient?: Prisma.TransactionClient,
): Promise<void> {
  try {
    await createActivityLog(
      {
        activityType: "QUOTE_VIEWED", // Generic event; CTA details in metadata
        entityType: params.entityType,
        entityId: params.entityId,
        userId: params.actor,
        organizationId: params.organizationId,
        metadata: {
          ctaId: params.ctaId,
          sourceScreen: params.sourceScreen,
          targetScreen: params.targetScreen,
          outcome: params.outcome,
          ...(params.note ? { note: params.note } : {}),
        },
      },
      txClient,
    );
  } catch (err) {
    console.warn("[CTAExecutionLogger] Failed to log CTA execution:", err);
  }
}
