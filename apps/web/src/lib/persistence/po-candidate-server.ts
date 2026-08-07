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
  /**
   * §pocandidate-root-fix — 발주 대상 견적 결속 (POCandidate.quoteId FK).
   * 입력 계약만 준비 (향후 생성 caller 대비 — 실제 생성 흐름 wiring 은
   * 별건 §pocandidate-creation-flow). NULL candidate 는 변환 풀에서 제외됨.
   */
  quoteId?: string | null;
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
  // §pocandidate-empty-items-order — 입구 가드. items 0건 candidate 는
  // 내역 없는 발주서의 근원이므로 생성 자체를 거부한다 (변환부 거부와 이중 방어).
  if (!input.items || input.items.length === 0) {
    throw new Error(
      "POCandidate 생성 거부: items 가 비어 있습니다 (§pocandidate-empty-items-order)",
    );
  }
  const row = await prisma.pOCandidate.create({
    data: {
      userId: input.userId,
      organizationId: input.organizationId ?? null,
      quoteId: input.quoteId ?? null,
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

// ── §pocandidate-creation-flow — 결재 통과 시 자동 생성 ──

/** approve tx 재사용을 위한 최소 클라이언트 형태 (PrismaClient 또는 TransactionClient) */
export interface POCandidateCreateClient {
  pOCandidate: { create(args: unknown): Promise<unknown> };
}

export interface QuoteItemForCandidate {
  name: string | null;
  catalogNumber: string | null;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
  leadTime?: string | null;
}

export interface CreateFromQuoteInput {
  quote: { id: string; totalAmount: number | null; items: QuoteItemForCandidate[] };
  userId: string;
  organizationId?: string | null;
  /** selectedReply.vendorName — NULL 이면 vendor "" (변환부에서 vendorId NULL Order, legacy 동등) */
  vendorName?: string | null;
  /** PR.totalAmount 우선 (예산 차감 기준과 동일 원천) */
  totalAmount?: number | null;
  /** 결재 결과 projection — 기본 in_app_approved. 결재 truth 는 PurchaseRequest (역류 금지) */
  approvalStatus?: string;
}

/**
 * §pocandidate-creation-flow — 결재(PR) 통과 시점에 quote 로부터 candidate 생성.
 *
 * - items 0 → null 반환 (생성 skip, caller 는 legacy fallback 유지 —
 *   §pocandidate-empty-items-order 입구 가드와 동일 취지)
 * - quoteId 결속 + approvalStatus projection(승인통과집합 값) → 변환 풀 즉시 진입
 * - 멱등은 caller 책임: 3중 필터 fetch 로 기존 candidate 확인 후 0건일 때만 호출
 */
export async function createPOCandidateFromQuote(
  client: POCandidateCreateClient,
  input: CreateFromQuoteInput,
): Promise<POCandidateRow | null> {
  const items = input.quote.items ?? [];
  // S3 — items 0 은 생성 skip (내역 없는 발주 후보 금지, caller legacy 유지)
  if (items.length === 0) return null;

  const vendor = input.vendorName?.trim() ?? "";
  const sumLineTotal = items.reduce((sum, it) => sum + (it.lineTotal ?? 0), 0);
  const totalAmount = input.totalAmount ?? input.quote.totalAmount ?? sumLineTotal;
  const firstName = items[0].name ?? "발주 품목";
  const title = items.length > 1 ? `${firstName} 외 ${items.length - 1}건` : firstName;

  const row = await client.pOCandidate.create({
    data: {
      userId: input.userId,
      organizationId: input.organizationId ?? null,
      quoteId: input.quote.id,
      title,
      vendor,
      totalAmount,
      selectionReason: null,
      blockers: [],
      approvalPolicy: "in_app_approval",
      // S2 — 결재 결과 projection (승인통과집합 값). 결재 truth 는 PurchaseRequest.
      approvalStatus: input.approvalStatus ?? "in_app_approved",
      stage: "po_conversion_candidate",
      items: {
        create: items.map((item) => ({
          name: item.name ?? "(이름 없음)",
          catalogNumber: item.catalogNumber ?? "",
          quantity: item.quantity,
          unitPrice: item.unitPrice ?? 0,
          lineTotal: item.lineTotal ?? 0,
          leadTime: item.leadTime ?? "",
        })),
      },
    },
    include: { items: true },
  });
  return serializeCandidate(row);
}

// ── §pocandidate-vendor-split — 유일-응답 파생 그룹핑 (호영님 A안, 2026-08-07) ──

export interface QuoteItemForCandidateSplit extends QuoteItemForCandidate {
  /**
   * 품목별 응답 vendor 이름 목록 (caller 가 QuoteVendorResponseItem 조인으로 조립).
   * 유일(1개)할 때만 그룹핑 근거로 사용 — 다중/0 은 잔여 "" 묶음.
   * 자동 가격 판단 금지: 시스템이 구매 의사결정을 대행하지 않는다 (A안 계약).
   */
  respondedVendors?: string[] | null;
}

export interface CreateManyFromQuoteInput extends Omit<CreateFromQuoteInput, "quote"> {
  quote: { id: string; totalAmount: number | null; items: QuoteItemForCandidateSplit[] };
}

/**
 * §pocandidate-vendor-split — quote 로부터 vendor 별 candidate N개 생성.
 *
 * 하류 계약 충족: convertPOCandidatesToOrders 는 "candidate = vendor 별 1개씩"
 * 전제 (1 candidate → 1 Order). 상류에서 유일-응답 기준으로 분리해 전제를 만든다.
 *
 * - V1 유일-응답 vendor → 그 vendor 그룹 / V2 다중·0 응답 → 잔여 "" 그룹
 * - V3 분할 근거 없음(잔여 단일) → vendorName(selectedReply) 승계 = 단수형 동등
 * - V4 items 0 → null (S3 승계)
 * - V5 N>1 분할 시 totalAmount = 후보별 Σ lineTotal (PR/quote 전체액 복제 금지 —
 *   중복 합산 왜곡 방지. 예산 차감 1회는 Order 변환 M2b 계약이 담당, 무접촉)
 * - 멱등은 caller 책임 (기존 3중 필터 — quoteId 단위 0건일 때만 호출)
 */
export async function createPOCandidatesFromQuote(
  client: POCandidateCreateClient,
  input: CreateManyFromQuoteInput,
): Promise<POCandidateRow[] | null> {
  const items = input.quote.items ?? [];
  if (items.length === 0) return null; // V4 — 내역 없는 발주 후보 금지

  // 그룹핑 — 유일-응답만 vendor 확정, 그 외 잔여 "" (V1·V2)
  const groups = new Map<string, QuoteItemForCandidateSplit[]>();
  for (const item of items) {
    const unique =
      item.respondedVendors && item.respondedVendors.length === 1
        ? (item.respondedVendors[0] ?? "").trim()
        : "";
    const key = unique || "";
    const arr = groups.get(key) ?? [];
    arr.push(item);
    groups.set(key, arr);
  }

  // V3 — 분할 근거 없음(잔여 단일 그룹)이면 기존 단수형 vendorName 승계
  const soloRest = groups.size === 1 && groups.has("");
  const multi = groups.size > 1;

  const results: POCandidateRow[] = [];
  for (const [groupVendor, groupItems] of groups) {
    const vendor = soloRest ? (input.vendorName?.trim() ?? "") : groupVendor;
    const sumLineTotal = groupItems.reduce((sum, it) => sum + (it.lineTotal ?? 0), 0);
    // V5 — 분할 시 후보별 Σ, 단일이면 기존 우선순위(PR > quote > Σ) 유지
    const totalAmount = multi
      ? sumLineTotal
      : (input.totalAmount ?? input.quote.totalAmount ?? sumLineTotal);
    const firstName = groupItems[0].name ?? "발주 품목";
    const title = groupItems.length > 1 ? `${firstName} 외 ${groupItems.length - 1}건` : firstName;

    const row = await client.pOCandidate.create({
      data: {
        userId: input.userId,
        organizationId: input.organizationId ?? null,
        quoteId: input.quote.id,
        title,
        vendor,
        totalAmount,
        selectionReason: null,
        blockers: [],
        approvalPolicy: "in_app_approval",
        // V6 — projection 계약 승계 (결재 truth 는 PurchaseRequest, 역류 금지)
        approvalStatus: input.approvalStatus ?? "in_app_approved",
        stage: "po_conversion_candidate",
        items: {
          create: groupItems.map((item) => ({
            name: item.name ?? "(이름 없음)",
            catalogNumber: item.catalogNumber ?? "",
            quantity: item.quantity,
            unitPrice: item.unitPrice ?? 0,
            lineTotal: item.lineTotal ?? 0,
            leadTime: item.leadTime ?? "",
          })),
        },
      },
      include: { items: true },
    });
    results.push(serializeCandidate(row));
  }
  return results;
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
