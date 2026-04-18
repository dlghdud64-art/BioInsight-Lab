/**
 * P1-1 Slice-1D — MemoryIncidentRepository
 *
 * In-memory Map-backed incident store.
 * Lifecycle: OPEN → ACKNOWLEDGED → ESCALATED → RESOLVED → CLOSED
 * Optimistic locking on status transitions and acknowledgement.
 *
 * Note: no legacy in-memory incident store exists (this is new in P1-1).
 */

import type { IncidentRepository } from "../repositories";
import type {
  RepositoryResult,
  ListQuery,
  ListResult,
  PersistedIncident,
  CreateIncidentInput,
  IncidentStatus,
} from "../types";
import { ok, fail, INCIDENT_STATUS_LIFECYCLE } from "../types";
import { applyListQuery } from "./query-helpers";
import { monotoneNow } from "./clock";

let _idCounter = 0;
function nextId(): string {
  return "mem-inc-" + String(++_idCounter);
}

function isValidStatusTransition(from: string, to: IncidentStatus): boolean {
  const fromIdx = INCIDENT_STATUS_LIFECYCLE.indexOf(from as IncidentStatus);
  const toIdx = INCIDENT_STATUS_LIFECYCLE.indexOf(to);
  if (fromIdx === -1 || toIdx === -1) return false;
  return toIdx > fromIdx;
}

export class MemoryIncidentRepository implements IncidentRepository {
  private _store = new Map<string, PersistedIncident>();
  /** Secondary index: incidentId → id */
  private _incidentIdIndex = new Map<string, string>();

  async createIncident(input: CreateIncidentInput): Promise<RepositoryResult<PersistedIncident>> {
    if (this._incidentIdIndex.has(input.incidentId)) {
      return fail("DUPLICATE", `Incident incidentId=${input.incidentId} already exists`, "StabilizationIncident");
    }
    const now = monotoneNow();
    const entity: PersistedIncident = {
      id: nextId(),
      incidentId: input.incidentId,
      reasonCode: input.reasonCode,
      severity: input.severity,
      status: input.status,
      correlationId: input.correlationId,
      baselineId: input.baselineId,
      snapshotId: input.snapshotId,
      acknowledgedBy: null,
      acknowledgedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this._store.set(entity.id, entity);
    this._incidentIdIndex.set(entity.incidentId, entity.id);
    return ok(this._clone(entity));
  }

  async findIncidentByIncidentId(incidentId: string): Promise<RepositoryResult<PersistedIncident>> {
    const id = this._incidentIdIndex.get(incidentId);
    if (!id) {
      return fail("NOT_FOUND", `Incident incidentId=${incidentId} not found`, "StabilizationIncident");
    }
    const entry = this._store.get(id);
    if (!entry) {
      return fail("NOT_FOUND", `Incident incidentId=${incidentId} not found`, "StabilizationIncident");
    }
    return ok(this._clone(entry));
  }

  async updateIncidentStatus(
    incidentId: string,
    newStatus: IncidentStatus,
    expectedUpdatedAt: Date
  ): Promise<RepositoryResult<PersistedIncident>> {
    const id = this._incidentIdIndex.get(incidentId);
    if (!id) {
      return fail("NOT_FOUND", `Incident incidentId=${incidentId} not found`, "StabilizationIncident");
    }
    const existing = this._store.get(id);
    if (!existing) {
      return fail("NOT_FOUND", `Incident incidentId=${incidentId} not found`, "StabilizationIncident");
    }
    if (!isValidStatusTransition(existing.status, newStatus)) {
      return fail(
        "VALIDATION_FAILED",
        `Invalid status transition: ${existing.status} → ${newStatus}`,
        "StabilizationIncident"
      );
    }
    if (existing.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
      return fail(
        "OPTIMISTIC_LOCK_CONFLICT",
        `Incident incidentId=${incidentId} was modified since last read`,
        "StabilizationIncident"
      );
    }
    existing.status = newStatus;
    existing.updatedAt = monotoneNow();
    return ok(this._clone(existing));
  }

  async acknowledgeIncident(
    incidentId: string,
    acknowledgedBy: string,
    expectedUpdatedAt: Date
  ): Promise<RepositoryResult<PersistedIncident>> {
    const id = this._incidentIdIndex.get(incidentId);
    if (!id) {
      return fail("NOT_FOUND", `Incident incidentId=${incidentId} not found`, "StabilizationIncident");
    }
    const existing = this._store.get(id);
    if (!existing) {
      return fail("NOT_FOUND", `Incident incidentId=${incidentId} not found`, "StabilizationIncident");
    }
    if (existing.status !== "OPEN") {
      return fail(
        "VALIDATION_FAILED",
        `Can only acknowledge OPEN incidents, current status=${existing.status}`,
        "StabilizationIncident"
      );
    }
    if (existing.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
      return fail(
        "OPTIMISTIC_LOCK_CONFLICT",
        `Incident incidentId=${incidentId} was modified since last read`,
        "StabilizationIncident"
      );
    }
    existing.status = "ACKNOWLEDGED";
    existing.acknowledgedBy = acknowledgedBy;
    existing.acknowledgedAt = monotoneNow();
    existing.updatedAt = monotoneNow();
    return ok(this._clone(existing));
  }

  async listOpenIncidents(query?: ListQuery): Promise<RepositoryResult<ListResult<PersistedIncident>>> {
    const open = Array.from(this._store.values()).filter(
      (i) => i.status === "OPEN" || i.status === "ACKNOWLEDGED" || i.status === "ESCALATED"
    );
    const result = applyListQuery(open, query, "createdAt");
    return ok({ items: result.items.map((i) => this._clone(i)), nextCursor: result.nextCursor });
  }

  async findByCorrelationId(
    correlationId: string,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedIncident>>> {
    const filtered = Array.from(this._store.values()).filter((i) => i.correlationId === correlationId);
    const result = applyListQuery(filtered, query, "createdAt");
    return ok({ items: result.items.map((i) => this._clone(i)), nextCursor: result.nextCursor });
  }

  async findByBaselineId(
    baselineId: string,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedIncident>>> {
    const filtered = Array.from(this._store.values()).filter((i) => i.baselineId === baselineId);
    const result = applyListQuery(filtered, query, "createdAt");
    return ok({ items: result.items.map((i) => this._clone(i)), nextCursor: result.nextCursor });
  }

  private _clone(entity: PersistedIncident): PersistedIncident {
    return JSON.parse(JSON.stringify(entity));
  }

  _reset(): void {
    this._store.clear();
    this._incidentIdIndex.clear();
  }
}
