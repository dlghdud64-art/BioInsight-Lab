/**
 * POCandidate Server Persistence
 *
 * MOCK_CANDIDATES를 대체하는 DB CRUD.
 * Prisma client 를 통해 POCandidate + POCandidateItem 을 관리한다.
 *
 * 규칙:
 * - canonical truth 는 이 layer 에서만 mutate.
 * - presentation seed 역할 — order_queue store overlay 는 프론트에서 유지.
 * - items 는 always include 로 eager load.
 */

import { db as prisma } from "@/lib/db";

// ── Types (Prisma inferred + front-end compatible) ──

export interface POCandidateItemData {
  name: string;
  catalogNumber: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  leadTime: string;
}

export interface POCandidateCreateInput {
  userId: string;
  organizationId?: string | null;
  title: string;
  vendor: string;
  totalAmount: number;
  expectedDelivery?: string | null;
  selectionReason?: string | null;
  blockers?: string[];
  approvalPolicy?: string;
  approvalStatus?: string;
  stage?: string;
  items: POCandidateItemData[];
}

export interface POCandidateRow {
  id: string;
  userId: string;
  organizationId: string | null;
  title: string;
  vendor: string;
  totalAmount: number;
  expectedDelivery: string | null;
  selectionReason: string | null;
  blockers: string[];
  approvalPolicy: string;
  approvalStatus: string;
  stage: string;
  createdAt: string;
  updatedAt: string;
  items: POCandidateItemData[];
}

// ── Helpers ──

function serializeCandidate(raw: any): POCandidateRow {
  return {
    id: raw.id,
    userId: raw.userId,
    organizationId: raw.organizationId,
    title: raw.title,
    vendor: raw.vendor,
    totalAmount: raw.totalAmount,
    expectedDelivery: raw.expectedDelivery?.toISOString() ?? null,
    selectionReason: raw.selectionReason,
    blockers: raw.blockers ?? [],
    approvalPolicy: raw.approvalPolicy,
    approvalStatus: raw.approvalStatus,
    stage: raw.stage,
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
    items: (raw.items ?? []).map((i: any) => ({
      name: i.name,
      catalogNumber: i.catalogNumber,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
      leadTime: i.leadTime,
    })),
  };
}

// ── CRUD ──

/** 특정 user 의 PO candidates 조회 (stage 필터 옵션) */
export async function listPOCandidates(
  userId: string,
  opts?: { stage?: string; organizationId?: string },
): Promise<POCandidateRow[]> {
  const rows = await prisma.pOCandidate.findMany({
    where: {
      userId,
      ...(opts?.stage ? { stage: opts.stage } : {}),
      ...(opts?.organizationId ? { organizationId: opts.organizationId } : {}),
    },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(serializeCandidate);
}

/** 단건 조회 */
export async function getPOCandidate(id: string): Promise<POCandidateRow | null> {
  const row = await prisma.pOCandidate.findUnique({
    where: { id },
    include: { items: true },
  });
  return row ? serializeCandidate(row) : null;
}

/** 후보 생성 (items 포함) */
export async function createPOCandidate(input: POCandidateCreateInput): Promise<POCandidateRow> {
  const row = await prisma.pOCandidate.create({
    data: {
      userId: input.userId,
      organizationId: input.organizationId ?? null,
      title: input.title,
      vendor: input.vendor,
      totalAmount: input.totalAmount,
      expectedDelivery: input.expectedDelivery ? new Date(input.expectedDelivery) : null,
      selectionReason: input.selectionReason ?? null,
      blockers: input.blockers ?? [],
      approvalPolicy: input.approvalPolicy ?? "none",
      approvalStatus: input.approvalStatus ?? "not_required",
      stage: input.stage ?? "po_conversion_candidate",
      items: {
        create: input.items.map((item) => ({
          name: item.name,
          catalogNumber: item.catalogNumber,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
          leadTime: item.leadTime,
        })),
      },
    },
    include: { items: true },
  });
  return serializeCandidate(row);
}

/** stage 업데이트 */
export async function updatePOCandidateStage(
  id: string,
  stage: string,
  updates?: { approvalStatus?: string },
): Promise<POCandidateRow | null> {
  const row = await prisma.pOCandidate.update({
    where: { id },
    data: {
      stage,
      ...(updates?.approvalStatus ? { approvalStatus: updates.approvalStatus } : {}),
    },
    include: { items: true },
  });
  return serializeCandidate(row);
}

/** 후보 삭제 (cascade 로 items 도 삭제) */
export async function deletePOCandidate(id: string): Promise<void> {
  await prisma.pOCandidate.delete({ where: { id } });
}

/** Bulk seed — 개발/테스트용. 기존 MOCK 데이터를 DB 에 삽입 */
export async function seedPOCandidates(
  userId: string,
  candidates: POCandidateCreateInput[],
): Promise<POCandidateRow[]> {
  const results: POCandidateRow[] = [];
  for (const c of candidates) {
    results.push(await createPOCandidate({ ...c, userId }));
  }
  return results;
}
