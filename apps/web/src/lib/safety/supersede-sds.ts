/**
 * §msds-audit-versioning AV-P2 (호영님 2026-07-04) — MSDS 개정본 supersession.
 *
 * 신규 SDS(sds) 등록 시 **같은 제품의 이전 현행본**을 supersededAt 세팅으로 대체한다.
 * 최신 업로드본만 supersededAt=null(현행) → classifyMsdsVersion 이 이전본을 stale 로 판정.
 * MSDS 는 주기적 개정 → 최신본 여부 추적이 규제 대응(GMP/산안법)의 실질.
 *
 * supersededAt 은 soft-state(삭제 금지, 추적성 보존). 순수 DB 업데이트(canonical).
 */
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/** productId 의 현행 sds 문서 중 keepDocId 를 제외한 나머지를 supersede. 반환=대체 건수. */
export async function supersedePriorSds(
  productId: string,
  keepDocId: string,
  tx?: Prisma.TransactionClient,
): Promise<number> {
  const client = (tx ?? db) as typeof db;
  const res = await client.sDSDocument.updateMany({
    where: { productId, docType: "sds", supersededAt: null, id: { not: keepDocId } },
    data: { supersededAt: new Date() },
  });
  return res.count;
}
