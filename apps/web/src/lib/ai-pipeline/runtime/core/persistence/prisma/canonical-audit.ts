/**
 * P1-1 Slice-1C — PrismaCanonicalAuditRepository
 *
 * Append-only. Supports reconstruction chain via parentEventId.
 *
 * 🛑 §audit-sibling-triage (2026-09-11) — **도달 0 · 미배선.**
 *   API 라우트/페이지 진입점 428개 어디에서도 이 파일에 import 그래프가 닿지 않는다
 *   (검출력 대조: 같은 검출기로 lib/db.ts 는 319 진입점 도달). 그래서 prod
 *   `CanonicalAuditEvent` 0행은 사건 부재가 아니라 **호출 경로 부재**다.
 *   이력: 저장층 진입(`bootstrapPersistence` · `getPersistenceAdapters`)은 2026-03-15~16
 *   P1~P6 에서 만들어졌고 `src/app` 에서 추가·제거된 적 0 → **회귀가 아니라 미완성 설계**다.
 *   처분: 호영님 판정 "제거 아님 · 보류 + 표기". 테이블만 지우면 없는 테이블에 쓰는
 *   이 클래스가 남고, 클래스까지 지우면 설계를 지우는 것이라 되돌림 비용이 다르다.
 *   배선하려는 사람은 여기서 시작한다 — 진입은 `../bootstrap.ts` 의 getPersistenceAdapters().
 */

import type { CanonicalAuditRepository } from "../repositories";
import type {
  RepositoryResult,
  ListQuery,
  ListResult,
  PersistedCanonicalAuditEvent,
  CreateCanonicalAuditEventInput,
} from "../types";
import { ok, fail } from "../types";
import { mapDbToCanonicalAuditEvent, stringArrayToJson } from "./mappers";
import { buildOrderBy, buildPagination, isUniqueConstraintError } from "./query-helpers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClient = any;

export class PrismaCanonicalAuditRepository implements CanonicalAuditRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async appendCanonicalEvent(
    input: CreateCanonicalAuditEventInput
  ): Promise<RepositoryResult<PersistedCanonicalAuditEvent>> {
    try {
      const row = await this.prisma.canonicalAuditEvent.create({
        data: {
          eventId: input.eventId,
          eventType: input.eventType,
          eventStage: input.eventStage,
          correlationId: input.correlationId,
          incidentId: input.incidentId,
          timelineId: input.timelineId,
          baselineId: input.baselineId,
          baselineVersion: input.baselineVersion,
          baselineHash: input.baselineHash,
          lifecycleState: input.lifecycleState,
          releaseMode: input.releaseMode,
          actor: input.actor,
          sourceModule: input.sourceModule,
          entityType: input.entityType,
          entityId: input.entityId,
          reasonCode: input.reasonCode,
          severity: input.severity,
          occurredAt: input.occurredAt,
          // recordedAt: set by DB default (now())
          snapshotBeforeId: input.snapshotBeforeId,
          snapshotAfterId: input.snapshotAfterId,
          affectedScopes: stringArrayToJson(input.affectedScopes),
          resultStatus: input.resultStatus,
          parentEventId: input.parentEventId,
        },
      });
      return ok(mapDbToCanonicalAuditEvent(row));
    } catch (e) {
      if (isUniqueConstraintError(e)) {
        return fail("DUPLICATE", `Canonical event eventId=${input.eventId} already exists`, "CanonicalAuditEvent");
      }
      return fail("STORAGE_UNAVAILABLE", "Failed to append canonical event", "CanonicalAuditEvent", e);
    }
  }

  async findCanonicalEventByEventId(
    eventId: string
  ): Promise<RepositoryResult<PersistedCanonicalAuditEvent>> {
    try {
      const row = await this.prisma.canonicalAuditEvent.findUnique({
        where: { eventId },
      });
      if (!row) {
        return fail("NOT_FOUND", `Canonical event eventId=${eventId} not found`, "CanonicalAuditEvent");
      }
      return ok(mapDbToCanonicalAuditEvent(row));
    } catch (e) {
      return fail("STORAGE_UNAVAILABLE", "Failed to find canonical event", "CanonicalAuditEvent", e);
    }
  }

  async listCanonicalEventsByCorrelationId(
    correlationId: string,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedCanonicalAuditEvent>>> {
    return this._listBy({ correlationId }, query);
  }

  async listCanonicalEventsByTimelineId(
    timelineId: string,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedCanonicalAuditEvent>>> {
    return this._listBy({ timelineId }, query);
  }

  async listCanonicalEventsByIncidentId(
    incidentId: string,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedCanonicalAuditEvent>>> {
    return this._listBy({ incidentId }, query);
  }

  async listCanonicalEventsByParentEventId(
    parentEventId: string,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedCanonicalAuditEvent>>> {
    return this._listBy({ parentEventId }, query);
  }

  // ── Private ──

  private async _listBy(
    where: Record<string, string>,
    query?: ListQuery
  ): Promise<RepositoryResult<ListResult<PersistedCanonicalAuditEvent>>> {
    try {
      const pagination = buildPagination(query);
      const orderBy = buildOrderBy(query, "occurredAt");
      const rows = await this.prisma.canonicalAuditEvent.findMany({
        where,
        orderBy,
        ...pagination,
      });
      const items = rows.map(mapDbToCanonicalAuditEvent);
      const nextCursor = items.length === (pagination.take ?? 100) ? items[items.length - 1].id : null;
      return ok({ items, nextCursor });
    } catch (e) {
      return fail("STORAGE_UNAVAILABLE", "Failed to list canonical events", "CanonicalAuditEvent", e);
    }
  }
}
