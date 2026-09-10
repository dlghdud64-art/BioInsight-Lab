/**
 * P1-1 Slice-1C — PrismaStabilizationAuditRepository
 *
 * Append-only. No update or delete operations.
 *
 * 🛑 §audit-sibling-triage (2026-09-11) — **도달 0 · 미배선.**
 *   API 라우트/페이지 진입점 428개 어디에서도 이 파일에 import 그래프가 닿지 않는다
 *   (검출력 대조: 같은 검출기로 lib/db.ts 는 319 진입점 도달). 그래서 prod
 *   `StabilizationAuditEvent` 0행은 사건 부재가 아니라 **호출 경로 부재**다.
 *   이력: 저장층 진입(`bootstrapPersistence` · `getPersistenceAdapters`)은 2026-03-15~16
 *   P1~P6 에서 만들어졌고 `src/app` 에서 추가·제거된 적 0 → **회귀가 아니라 미완성 설계**다.
 *   처분: 호영님 판정 "제거 아님 · 보류 + 표기". 테이블만 지우면 없는 테이블에 쓰는
 *   이 클래스가 남고, 클래스까지 지우면 설계를 지우는 것이라 되돌림 비용이 다르다.
 *   배선하려는 사람은 여기서 시작한다 — 진입은 `../bootstrap.ts` 의 getPersistenceAdapters().
 */

import type { StabilizationAuditRepository } from "../repositories";
import type {
  RepositoryResult,
  ListQuery,
  ListResult,
  PersistedStabilizationAuditEvent,
  CreateStabilizationAuditEventInput,
} from "../types";
import { ok, fail } from "../types";
import { mapDbToStabilizationAuditEvent } from "./mappers";
import { buildOrderBy, buildPagination, isUniqueConstraintError } from "./query-helpers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClient = any;

export class PrismaStabilizationAuditRepository implements StabilizationAuditRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async appendAuditEvent(
    input: CreateStabilizationAuditEventInput
  ): Promise<RepositoryResult<PersistedStabilizationAuditEvent>> {
    try {
      const row = await this.prisma.stabilizationAuditEvent.create({
        data: {
          eventId: input.eventId,
          eventType: input.eventType,
          correlationId: input.correlationId,
          incidentId: input.incidentId,
          baselineId: input.baselineId,
          snapshotId: input.snapshotId,
          actor: input.actor,
          reasonCode: input.reasonCode,
          severity: input.severity,
          sourceModule: input.sourceModule,
          entityType: input.entityType,
          entityId: input.entityId,
          resultStatus: input.resultStatus,
          occurredAt: input.occurredAt,
          // recordedAt: set by DB default (now())
        },
      });
      return ok(mapDbToStabilizationAuditEvent(row));
    } catch (e) {
      if (isUniqueConstraintError(e)) {
        return fail("DUPLICATE", `Audit event eventId=${input.eventId} already exists`, "StabilizationAuditEvent");
      }
      return fail("STORAGE_UNAVAILABLE", "Failed to append audit event", "StabilizationAuditEvent", e);
    }
  }

  async findAuditEventByEventId(
    eventId: string
  ): Promise<RepositoryResult<PersistedStabilizationAuditEvent>> {
    try {
      const row = await this.prisma.stabilizationAuditEvent.findUnique({
        where: { eventId },
      });
      if (!row) {
        return fail("NOT_FOUND", `Audit event eventId=${eventId} not found`, "StabilizationAuditEvent");
      }
      return ok(mapDbToStabilizationAuditEvent(row));
    } catch (e) {
      return fail("STORAGE_UNAVAILABLE", "Failed to find audit event", "StabilizationAuditEvent", e);
    }
  }

  async listAuditEventsByCorrelationId(
    correlationId: string,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedStabilizationAuditEvent>>> {
    return this._listBy({ correlationId }, query);
  }

  async listAuditEventsByIncidentId(
    incidentId: string,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedStabilizationAuditEvent>>> {
    return this._listBy({ incidentId }, query);
  }

  async listAuditEventsByBaselineId(
    baselineId: string,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedStabilizationAuditEvent>>> {
    return this._listBy({ baselineId }, query);
  }

  async listAuditEventsByEventType(
    eventType: string,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedStabilizationAuditEvent>>> {
    return this._listBy({ eventType }, query);
  }

  // ── Private ──

  private async _listBy(
    where: Record<string, string>,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedStabilizationAuditEvent>>> {
    try {
      const pagination = buildPagination(query);
      const orderBy = buildOrderBy(query, "occurredAt");
      const rows = await this.prisma.stabilizationAuditEvent.findMany({
        where,
        orderBy,
        ...pagination,
      });
      const items = rows.map(mapDbToStabilizationAuditEvent);
      const nextCursor = items.length === (pagination.take ?? 100) ? items[items.length - 1].id : null;
      return ok({ items, nextCursor });
    } catch (e) {
      return fail("STORAGE_UNAVAILABLE", "Failed to list audit events", "StabilizationAuditEvent", e);
    }
  }
}
